import { NextResponse } from "next/server";
import { getSupabaseAdmin, MAVELY_TABLE } from "@/lib/mavely-supabase";
import { mavelyProductInputSchema } from "@/lib/mavely-validation";
import { inputToRowFields } from "@/lib/mavely-serialize";
import { deleteShopifyProduct, ShopifyAuthError, ShopifyRateLimitError, ShopifyUserError } from "@/lib/mavely-shopify";
import { ZodError } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(MAVELY_TABLE).select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: `Not found: ${error.message}` }, { status: 404 });
  return NextResponse.json({ item: data });
}

/** Updates the local Supabase record only. To push changes to Shopify, use /api/mavely/publish. */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const input = mavelyProductInputSchema.parse(body);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(MAVELY_TABLE)
      .update(inputToRowFields(input))
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Missing or invalid fields.", fieldErrors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update product." }, { status: 500 });
  }
}

/**
 * Deletes the local record. If `deleteShopifyToo=true` is passed AND the record has a
 * Shopify product ID, also deletes the live Shopify product. The UI must show an explicit
 * confirmation step before calling this with deleteShopifyToo=true — this route does not
 * ask for confirmation itself.
 */
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(req.url);
  const deleteShopifyToo = url.searchParams.get("deleteShopifyToo") === "true";
  const archiveOnly = url.searchParams.get("archiveOnly") === "true";

  try {
    const supabase = getSupabaseAdmin();

    if (archiveOnly) {
      const { data, error } = await supabase.from(MAVELY_TABLE).update({ archived: true }).eq("id", id).select().single();
      if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
      return NextResponse.json({ item: data, archived: true });
    }

    const { data: existing, error: fetchError } = await supabase.from(MAVELY_TABLE).select("*").eq("id", id).single();
    if (fetchError) return NextResponse.json({ error: `Not found: ${fetchError.message}` }, { status: 404 });

    if (deleteShopifyToo && existing.shopify_product_id) {
      await deleteShopifyProduct(existing.shopify_product_id);
    }

    const { error: deleteError } = await supabase.from(MAVELY_TABLE).delete().eq("id", id);
    if (deleteError) return NextResponse.json({ error: `Supabase error: ${deleteError.message}` }, { status: 500 });

    return NextResponse.json({ deleted: true, shopifyDeleted: deleteShopifyToo && Boolean(existing.shopify_product_id) });
  } catch (error) {
    if (error instanceof ShopifyAuthError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ShopifyRateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof ShopifyUserError) return NextResponse.json({ error: error.message, details: error.errors }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete product." }, { status: 500 });
  }
}
