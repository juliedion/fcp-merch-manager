import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabaseAdmin, MAVELY_TABLE } from "@/lib/mavely-supabase";
import { mavelyProductInputSchema, validateAffiliateUrl } from "@/lib/mavely-validation";
import { inputToRowFields } from "@/lib/mavely-serialize";
import { findPotentialDuplicates } from "@/lib/mavely-duplicates";
import { publishMavelyProductToShopify, ShopifyAuthError, ShopifyRateLimitError, ShopifyUserError } from "@/lib/mavely-shopify";

/**
 * Publishes (creates or updates) a Shopify product for the given input, then upserts
 * the local Supabase record with the resulting Shopify IDs/URLs.
 *
 * Body: { input: MavelyProductInput, existingId?: string, force?: boolean }
 * `force: true` skips duplicate detection (used after the user confirms "create anyway").
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let input;
  try {
    input = mavelyProductInputSchema.parse(body.input ?? body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Missing or invalid fields.", fieldErrors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid product data." }, { status: 400 });
  }

  const existingId: string | undefined = body.existingId || undefined;
  const force: boolean = Boolean(body.force);

  const linkCheck = validateAffiliateUrl(input.mavelyLink);
  if (!linkCheck.valid) return NextResponse.json({ error: linkCheck.error }, { status: 400 });

  const supabase = getSupabaseAdmin();

  try {
    if (!force) {
      const duplicates = await findPotentialDuplicates(input, existingId);
      if (duplicates.length) {
        return NextResponse.json(
          {
            duplicateWarning: true,
            matches: duplicates.map(d => ({
              id: d.row.id,
              title: d.row.title,
              matchedOn: d.matchedOn,
              shopifyProductId: d.row.shopify_product_id,
              shopifyAdminUrl: d.row.shopify_admin_url
            }))
          },
          { status: 409 }
        );
      }
    }

    let existingRow: any = null;
    if (existingId) {
      const { data, error } = await supabase.from(MAVELY_TABLE).select("*").eq("id", existingId).single();
      if (error) return NextResponse.json({ error: `Could not load existing product: ${error.message}` }, { status: 404 });
      existingRow = data;
    }

    const shopifyResult = await publishMavelyProductToShopify(input, existingRow?.shopify_product_id ?? null);

    const rowFields = {
      ...inputToRowFields(input),
      shopify_product_id: shopifyResult.productGid,
      shopify_handle: shopifyResult.handle,
      shopify_admin_url: shopifyResult.adminUrl,
      shopify_storefront_url: shopifyResult.storefrontUrl,
      last_price_checked: new Date().toISOString().slice(0, 10)
    };

    let savedRow;
    if (existingRow) {
      const { data, error } = await supabase.from(MAVELY_TABLE).update(rowFields).eq("id", existingRow.id).select().single();
      if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
      savedRow = data;
    } else {
      const { data, error } = await supabase.from(MAVELY_TABLE).insert({ ...rowFields, archived: false }).select().single();
      if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
      savedRow = data;
    }

    return NextResponse.json({ item: savedRow, shopify: shopifyResult, linkWarning: linkCheck.warning });
  } catch (error) {
    if (error instanceof ShopifyAuthError) {
      console.error("Shopify auth error during publish");
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ShopifyRateLimitError) {
      console.error("Shopify rate limit during publish");
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof ShopifyUserError) {
      console.error("Shopify user errors during publish:", error.errors);
      return NextResponse.json({ error: error.message, details: error.errors }, { status: 400 });
    }
    console.error("Unexpected error publishing Mavely product:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to publish product." }, { status: 500 });
  }
}
