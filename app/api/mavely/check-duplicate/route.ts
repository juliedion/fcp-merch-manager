import { NextResponse } from "next/server";
import { mavelyProductInputSchema } from "@/lib/mavely-validation";
import { findPotentialDuplicates } from "@/lib/mavely-duplicates";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = mavelyProductInputSchema.parse(body.input ?? body);
    const matches = await findPotentialDuplicates(input, body.existingId || undefined);
    return NextResponse.json({
      matches: matches.map(d => ({
        id: d.row.id,
        title: d.row.title,
        matchedOn: d.matchedOn,
        shopifyProductId: d.row.shopify_product_id,
        shopifyAdminUrl: d.row.shopify_admin_url
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Duplicate check failed." }, { status: 500 });
  }
}
