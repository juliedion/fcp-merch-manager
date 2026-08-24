// Affiliate-product metafield support plus storefront merchandising copy.
// These values are written on publish so Shopify has a complete record for every affiliate product.

export type AffiliateMetafieldSource = {
  isAffiliateProduct?: boolean;
  affiliateUrl?: string | null;
  amazonUrl?: string | null;
  url?: string | null;
  productType?: string | null;
  productSource?: string | null;
  affiliateNetwork?: string | null;
  merchant?: string | null;
  ctaButtonText?: string | null;
  fcpVerdict?: string | null;
  benefits?: string[] | null;
  bullets?: string[] | null;
};

export type ShopifyMetafieldInput = {
  ownerId: string;
  namespace: "custom" | "fort_crazypants";
  key: string;
  type: string;
  value: string;
};

function cleanLines(values?: string[] | null, max = 6) {
  return (values || []).map(v => String(v || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, max);
}

function clean(value?: string | null) { return String(value || "").trim(); }

export function buildAffiliateMetafieldsPayload(ownerId: string, product: AffiliateMetafieldSource): ShopifyMetafieldInput[] {
  const isAmazon = product.productType === "amazon_affiliate" || /amazon/i.test(clean(product.merchant)) || /amazon/i.test(clean(product.affiliateNetwork));
  const isAffiliate = Boolean(product.isAffiliateProduct || isAmazon || clean(product.affiliateUrl));
  const sourceUrl = clean(product.url || product.amazonUrl);
  const affiliateUrl = clean(product.affiliateUrl || product.amazonUrl);
  const merchant = clean(product.merchant) || (isAmazon ? "Amazon" : "");
  const affiliateNetwork = clean(product.affiliateNetwork) || (isAmazon ? "Amazon Associates" : "");
  const productSource = clean(product.productSource) || (isAmazon ? "amazon" : isAffiliate ? "affiliate" : "shopify");
  const ctaText = clean(product.ctaButtonText) || (isAmazon ? "Buy on Amazon" : isAffiliate ? "View Product" : "Buy Now");
  const whyYoullLoveIt = (clean(product.fcpVerdict) || cleanLines(product.benefits, 3).join(" ")).trim();
  const purchaseBullets = cleanLines(product.bullets, 6).join("\n");

  const candidates: ShopifyMetafieldInput[] = [
    { ownerId, namespace: "custom", key: "is_affiliate_product", type: "boolean", value: String(isAffiliate) },
    { ownerId, namespace: "custom", key: "affiliate_url", type: "url", value: affiliateUrl },
    { ownerId, namespace: "custom", key: "affiliate_network", type: "single_line_text_field", value: affiliateNetwork },
    { ownerId, namespace: "custom", key: "merchant", type: "single_line_text_field", value: merchant },
    { ownerId, namespace: "custom", key: "cta_text", type: "single_line_text_field", value: ctaText },
    { ownerId, namespace: "custom", key: "fcp_verdict", type: "multi_line_text_field", value: whyYoullLoveIt },
    { ownerId, namespace: "custom", key: "purchase_bullets", type: "multi_line_text_field", value: purchaseBullets },
    { ownerId, namespace: "custom", key: "product_source", type: "single_line_text_field", value: productSource },
    { ownerId, namespace: "custom", key: "amazon_url", type: "url", value: isAmazon ? sourceUrl : "" },
    { ownerId, namespace: "fort_crazypants", key: "source_url", type: "url", value: sourceUrl }
  ];

  return candidates.filter(f => {
    if (f.key === "is_affiliate_product") return true;
    if (!isAffiliate && ["affiliate_url","affiliate_network","merchant","amazon_url"].includes(f.key)) return false;
    return f.value !== "";
  });
}

const METAFIELD_DEFINITIONS: { namespace?: "custom" | "fort_crazypants"; key: string; name: string; type: string; description: string }[] = [
  { key: "is_affiliate_product", name: "Is Affiliate Product", type: "boolean", description: "Whether this product links out to an external merchant instead of using Shopify checkout." },
  { key: "affiliate_url", name: "Affiliate URL", type: "url", description: "The external affiliate-tagged purchase URL." },
  { key: "affiliate_network", name: "Affiliate Network", type: "single_line_text_field", description: "Affiliate network, such as Amazon Associates, Impact, CJ, ShareASale, Awin, Rakuten, or Mavely." },
  { key: "merchant", name: "Merchant", type: "single_line_text_field", description: "Retail merchant such as Amazon, Walmart, Target, or Mavely." },
  { key: "cta_text", name: "CTA Text", type: "single_line_text_field", description: "Customer-facing purchase button label." },
  { key: "fcp_verdict", name: "FCP Verdict", type: "multi_line_text_field", description: "Customer-facing Why You'll Love It summary." },
  { key: "purchase_bullets", name: "Purchase Bullets", type: "multi_line_text_field", description: "Benefit-led product feature bullets shown on the storefront product page." },
  { key: "product_source", name: "Product Source", type: "single_line_text_field", description: "Source classification such as amazon, affiliate, zendrop, or shopify." },
  { key: "amazon_url", name: "Amazon URL", type: "url", description: "Original Amazon product listing URL." }
];

export type ShopifyGraphQLClient = (query: string, variables: Record<string, unknown>) => Promise<{ data?: unknown; errors?: unknown }>;

export async function ensureAffiliateMetafieldDefinitions(graphql: ShopifyGraphQLClient): Promise<{ created: string[]; skipped: string[]; errors: { key: string; error: unknown }[] }> {
  const created: string[] = [], skipped: string[] = [], errors: { key: string; error: unknown }[] = [];
  const listQuery = `query { metafieldDefinitions(first: 100, ownerType: PRODUCT, namespace: "custom") { nodes { key } } }`;
  const listResult = await graphql(listQuery, {});
  const existingKeys = new Set(((listResult.data as { metafieldDefinitions?: { nodes?: { key: string }[] } } | undefined)?.metafieldDefinitions?.nodes ?? []).map(n => n.key));
  for (const def of METAFIELD_DEFINITIONS) {
    if (existingKeys.has(def.key)) { skipped.push(def.key); continue; }
    const mutation = `mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) { metafieldDefinitionCreate(definition: $definition) { createdDefinition { id key } userErrors { field message code } } }`;
    const variables = { definition: { name: def.name, namespace: def.namespace || "custom", key: def.key, description: def.description, type: def.type, ownerType: "PRODUCT" } };
    try {
      const result = await graphql(mutation, variables);
      const userErrors = (result.data as { metafieldDefinitionCreate?: { userErrors?: unknown[] } } | undefined)?.metafieldDefinitionCreate?.userErrors;
      if (result.errors || (userErrors && userErrors.length > 0)) errors.push({ key: def.key, error: result.errors || userErrors }); else created.push(def.key);
    } catch (e) { errors.push({ key: def.key, error: e instanceof Error ? e.message : String(e) }); }
  }
  return { created, skipped, errors };
}
