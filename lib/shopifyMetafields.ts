// Affiliate-product metafield support plus storefront merchandising copy.
// The existing fort_crazypants.source_url metafield remains separate and is still used by
// the price-resync cron. Everything here lives under custom.* only.

export type AffiliateMetafieldSource = {
  isAffiliateProduct?: boolean;
  affiliateUrl?: string | null;
  affiliateNetwork?: string | null;
  merchant?: string | null;
  ctaButtonText?: string | null;
  fcpVerdict?: string | null;
  benefits?: string[] | null;
  bullets?: string[] | null;
};

export type ShopifyMetafieldInput = {
  ownerId: string;
  namespace: "custom";
  key: string;
  type: string;
  value: string;
};

function cleanLines(values?: string[] | null, max = 6) {
  return (values || [])
    .map(v => String(v || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, max);
}

// fcp_verdict is retained as a legacy storage key because products/storefronts may already
// have the definition. It now stores the customer-facing 3-sentence "Why You'll Love It"
// copy when no explicit legacy verdict was supplied. The storefront no longer labels it as
// a verdict. purchase_bullets stores the distinct benefit-led feature list shown below
// Product Details.
export function buildAffiliateMetafieldsPayload(ownerId: string, product: AffiliateMetafieldSource): ShopifyMetafieldInput[] {
  const isAffiliate = Boolean(product.isAffiliateProduct);
  const whyYoullLoveIt = (product.fcpVerdict || cleanLines(product.benefits, 3).join(" ")).trim();
  const purchaseBullets = cleanLines(product.bullets, 6).join("\n");

  const candidates: ShopifyMetafieldInput[] = [
    { ownerId, namespace: "custom", key: "is_affiliate_product", type: "boolean", value: String(isAffiliate) },
    { ownerId, namespace: "custom", key: "affiliate_url", type: "url", value: product.affiliateUrl ?? "" },
    { ownerId, namespace: "custom", key: "affiliate_network", type: "single_line_text_field", value: product.affiliateNetwork ?? "" },
    { ownerId, namespace: "custom", key: "merchant", type: "single_line_text_field", value: product.merchant ?? "" },
    { ownerId, namespace: "custom", key: "cta_text", type: "single_line_text_field", value: product.ctaButtonText ?? "" },
    { ownerId, namespace: "custom", key: "fcp_verdict", type: "multi_line_text_field", value: whyYoullLoveIt },
    { ownerId, namespace: "custom", key: "purchase_bullets", type: "multi_line_text_field", value: purchaseBullets }
  ];

  return candidates.filter(f => {
    if (f.key === "is_affiliate_product") return true;
    // Product-page copy belongs to the product regardless of purchase mode.
    if (f.key === "fcp_verdict" || f.key === "purchase_bullets") return f.value !== "";
    if (!isAffiliate) return false;
    return f.value !== undefined && f.value !== null && f.value !== "";
  });
}

const METAFIELD_DEFINITIONS: { key: string; name: string; type: string; description: string }[] = [
  { key: "is_affiliate_product", name: "Is Affiliate Product", type: "boolean", description: "Whether this product links out to an external merchant instead of using Shopify checkout." },
  { key: "affiliate_url", name: "Affiliate URL", type: "url", description: "The external (affiliate-tagged) purchase URL." },
  { key: "affiliate_network", name: "Affiliate Network", type: "single_line_text_field", description: "e.g. Amazon Associates, Impact, CJ, ShareASale, Awin, Rakuten, Mavely." },
  { key: "merchant", name: "Merchant", type: "single_line_text_field", description: "e.g. Amazon, Walmart, Target, Mavely." },
  { key: "cta_text", name: "CTA Text", type: "single_line_text_field", description: "Button label shown in place of Add to Cart, e.g. \"Buy on Amazon\"." },
  { key: "fcp_verdict", name: "Why You'll Love It", type: "multi_line_text_field", description: "Three-sentence customer-facing summary of the product's strongest benefits." },
  { key: "purchase_bullets", name: "Purchase Bullets", type: "multi_line_text_field", description: "Benefit-led product feature bullets shown on the storefront product page." }
];

export type ShopifyGraphQLClient = (query: string, variables: Record<string, unknown>) => Promise<{ data?: unknown; errors?: unknown }>;

export async function ensureAffiliateMetafieldDefinitions(graphql: ShopifyGraphQLClient): Promise<{ created: string[]; skipped: string[]; errors: { key: string; error: unknown }[] }> {
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: { key: string; error: unknown }[] = [];

  const listQuery = `query { metafieldDefinitions(first: 100, ownerType: PRODUCT, namespace: "custom") { nodes { key } } }`;
  const listResult = await graphql(listQuery, {});
  const existingKeys = new Set(
    ((listResult.data as { metafieldDefinitions?: { nodes?: { key: string }[] } } | undefined)?.metafieldDefinitions?.nodes ?? []).map(n => n.key)
  );

  for (const def of METAFIELD_DEFINITIONS) {
    if (existingKeys.has(def.key)) { skipped.push(def.key); continue; }
    const mutation = `mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id key }
        userErrors { field message code }
      }
    }`;
    const variables = {
      definition: {
        name: def.name,
        namespace: "custom",
        key: def.key,
        description: def.description,
        type: def.type,
        ownerType: "PRODUCT"
      }
    };
    try {
      const result = await graphql(mutation, variables);
      const userErrors = (result.data as { metafieldDefinitionCreate?: { userErrors?: unknown[] } } | undefined)?.metafieldDefinitionCreate?.userErrors;
      if (result.errors || (userErrors && userErrors.length > 0)) {
        errors.push({ key: def.key, error: result.errors || userErrors });
      } else {
        created.push(def.key);
      }
    } catch (e) {
      errors.push({ key: def.key, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { created, skipped, errors };
}
