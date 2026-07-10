import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || "2025-10";
  if (!domain || !token) return NextResponse.json({ error: "Shopify credentials are not configured." }, { status: 503 });
  const product = await req.json();
  const mutation = `mutation productCreate($product: ProductCreateInput!) { productCreate(product: $product) { product { id title handle status } userErrors { field message } } }`;
  const variables = { product: { title: product.title, handle: product.handle, descriptionHtml: product.descriptionHtml, status: "DRAFT", productType: product.category, tags: product.tags } };
  const response = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: mutation, variables }) });
  const data = await response.json();
  if (!response.ok || data.errors || data.data?.productCreate?.userErrors?.length) return NextResponse.json({ error: data.errors || data.data?.productCreate?.userErrors || "Shopify publish failed" }, { status: 400 });
  return NextResponse.json(data.data.productCreate.product);
}
