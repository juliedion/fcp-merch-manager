import { NextResponse } from "next/server";
import { buildAffiliateMetafieldsPayload } from "@/lib/shopifyMetafields";

async function getAccessToken(domain: string): Promise<string> {
  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;
  if (!clientId || !clientSecret) throw new Error("SHOPIFY_API_KEY / SHOPIFY_API_SECRET are not configured.");
  const r = await fetch(`https://${domain}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }) });
  const data = await r.json();
  if (!r.ok || !data.access_token) throw new Error(data.error_description || "Could not obtain a Shopify access token.");
  return data.access_token as string;
}

export async function POST(req: Request) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const version = process.env.SHOPIFY_API_VERSION || "2025-10";
  if (!domain) return NextResponse.json({ error: "Shopify credentials are not configured." }, { status: 503 });
  let token: string;
  try { token = await getAccessToken(domain); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Could not authenticate with Shopify." }, { status: 502 }); }
  const product = await req.json();
  if (product.isAffiliateProduct && !/^https:\/\//i.test(String(product.affiliateUrl || product.amazonUrl || ""))) return NextResponse.json({ error: "Affiliate products require a valid https:// Affiliate URL." }, { status: 400 });

  const descriptionHtml = product.descriptionHtml || "";
  const metafields = product.productType === "amazon_affiliate" && product.url ? [{ namespace: "fort_crazypants", key: "source_url", type: "url", value: String(product.url) }] : undefined;
  const variantOptions: { name: string; values: string[] }[] = Array.isArray(product.variantOptions) ? product.variantOptions.filter((o: unknown): o is { name: string; values: string[] } => !!o && typeof o === "object" && typeof (o as { name?: unknown }).name === "string" && Array.isArray((o as { values?: unknown }).values) && (o as { values: unknown[] }).values.length > 0) : [];
  const variantCombos: { values: string[]; price: number }[] = Array.isArray(product.variants) ? product.variants : [];
  const mutation = `mutation productCreate($product: ProductCreateInput!) { productCreate(product: $product) { product { id title handle status } userErrors { field message } } }`;
  const variables = { product: { title: product.title, handle: product.handle, descriptionHtml, status: "DRAFT", productType: product.category, tags: product.tags, ...(metafields ? { metafields } : {}), ...(variantOptions.length > 0 ? { productOptions: variantOptions.map(o => ({ name: o.name, values: o.values.map(v => ({ name: v })) })) } : {}) } };
  const response = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: mutation, variables }) });
  const data = await response.json();
  if (!response.ok || data.errors || data.data?.productCreate?.userErrors?.length) return NextResponse.json({ error: data.errors || data.data?.productCreate?.userErrors || "Shopify publish failed" }, { status: 400 });
  const created = data.data.productCreate.product;

  const imageUrls: string[] = Array.isArray(product.images) ? product.images.filter((u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u)) : [];
  let mediaErrors: unknown = null;
  if (imageUrls.length > 0) {
    const q = `mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) { productCreateMedia(productId: $productId, media: $media) { media { id } mediaUserErrors { field message } } }`;
    const r = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: q, variables: { productId: created.id, media: imageUrls.slice(0, 10).map(src => ({ originalSource: src, mediaContentType: "IMAGE" })) } }) });
    const d = await r.json(); if (!r.ok || d.errors || d.data?.productCreateMedia?.mediaUserErrors?.length) mediaErrors = d.errors || d.data?.productCreateMedia?.mediaUserErrors;
  }

  // Affiliate products must NOT be inventory-tracked. Their availability comes from the external merchant,
  // and the storefront replaces Shopify checkout with the affiliate CTA. Tracking them at quantity 0 made
  // Shopify label them Sold out throughout collection/product availability UI.
  let inventoryLocked = false, inventoryError: unknown = null, priceSet = false, variantsCreated = 0;
  const isAffiliate = Boolean(product.isAffiliateProduct || product.productType === "amazon_affiliate");
  const variantQuery = `query($id: ID!) { product(id: $id) { variants(first: 1) { nodes { id } } } }`;
  const vr = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: variantQuery, variables: { id: created.id } }) });
  const vd = await vr.json(); const variantId = vd?.data?.product?.variants?.nodes?.[0]?.id;
  if (variantId) {
    const defaultPrice = variantCombos[0]?.price ?? product.price;
    const variantInput: Record<string, unknown> = { id: variantId };
    if (typeof defaultPrice === "number" && defaultPrice > 0) variantInput.price = defaultPrice.toFixed(2);
    if (isAffiliate) { variantInput.inventoryPolicy = "CONTINUE"; variantInput.inventoryItem = { tracked: false }; }
    const q = `mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { productVariants { id price inventoryPolicy } userErrors { field message } } }`;
    const r = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: q, variables: { productId: created.id, variants: [variantInput] } }) });
    const d = await r.json();
    if (!r.ok || d.errors || d.data?.productVariantsBulkUpdate?.userErrors?.length) inventoryError = d.errors || d.data?.productVariantsBulkUpdate?.userErrors; else { priceSet = typeof variantInput.price === "string"; variantsCreated = 1; }
    const remainingCombos = variantCombos.slice(1);
    if (remainingCombos.length > 0 && variantOptions.length > 0) {
      const newVariants = remainingCombos.map(combo => { const v: Record<string, unknown> = { optionValues: variantOptions.map((o, i) => ({ optionName: o.name, name: combo.values[i] })) }; if (typeof combo.price === "number" && combo.price > 0) v.price = combo.price.toFixed(2); if (isAffiliate) { v.inventoryPolicy = "CONTINUE"; v.inventoryItem = { tracked: false }; } return v; });
      const cq = `mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkCreate(productId: $productId, variants: $variants) { productVariants { id } userErrors { field message } } }`;
      const cr = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: cq, variables: { productId: created.id, variants: newVariants } }) });
      const cd = await cr.json(); if (!cr.ok || cd.errors || cd.data?.productVariantsBulkCreate?.userErrors?.length) inventoryError = cd.errors || cd.data?.productVariantsBulkCreate?.userErrors; else variantsCreated += cd.data.productVariantsBulkCreate.productVariants.length;
    }
  } else inventoryError = "Could not find the default variant to update.";

  const collectionsAdded: string[] = [], collectionErrors: unknown[] = [];
  try {
    const q = `query { collections(first: 100) { nodes { id title } } }`; const r = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: q, variables: {} }) }); const d = await r.json(); const existing: { id: string; title: string }[] = d?.data?.collections?.nodes ?? [];
    const STOPWORDS = new Set(["and","the","for","with","your","best","new","finds","picks","wins","fun"]); const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w)); const productWords = new Set<string>([...(Array.isArray(product.collections) ? product.collections : []), product.category || ""].flatMap(words)); const matchedIds = new Set<string>(); for (const c of existing) { const tw = words(c.title); if (c.title.toLowerCase() === "home page" || tw.some(w => productWords.has(w))) matchedIds.add(c.id); }
    for (const id of matchedIds) { const aq = `mutation collectionAddProductsV2($id: ID!, $productIds: [ID!]!) { collectionAddProductsV2(id: $id, productIds: $productIds) { job { id } userErrors { field message } } }`; const ar = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: aq, variables: { id, productIds: [created.id] } }) }); const ad = await ar.json(); const title = existing.find(c => c.id === id)?.title || id; if (!ar.ok || ad.errors || ad.data?.collectionAddProductsV2?.userErrors?.length) collectionErrors.push({ collection: title, error: ad.errors || ad.data?.collectionAddProductsV2?.userErrors }); else collectionsAdded.push(title); }
  } catch (e) { collectionErrors.push(e instanceof Error ? e.message : "Collection matching failed."); }

  let affiliateMetafieldsSet = false, affiliateMetafieldsError: unknown = null; const affiliateMetafields = buildAffiliateMetafieldsPayload(created.id, product);
  if (affiliateMetafields.length > 0) { const q = `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { metafields { id key } userErrors { field message } } }`; const r = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query: q, variables: { metafields: affiliateMetafields } }) }); const d = await r.json(); if (!r.ok || d.errors || d.data?.metafieldsSet?.userErrors?.length) affiliateMetafieldsError = d.errors || d.data?.metafieldsSet?.userErrors; else affiliateMetafieldsSet = true; }
  return NextResponse.json({ ...created, imagesAttached: imageUrls.length, mediaErrors, inventoryLocked, inventoryError, priceSet, variantsCreated, collectionsAdded, collectionErrors, affiliateMetafieldsSet, affiliateMetafieldsError });
}
