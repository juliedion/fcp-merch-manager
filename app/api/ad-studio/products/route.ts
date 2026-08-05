import { NextResponse } from "next/server";
import { searchShopifyProducts } from "@/lib/ad-studio-shopify";

/** GET /api/ad-studio/products?q=search — live Shopify product search for the Ad
 * Studio product picker (step 1, "fresh product-picker start" entry point). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const items = await searchShopifyProducts(q, 20);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to search Shopify products." }, { status: 500 });
  }
}
