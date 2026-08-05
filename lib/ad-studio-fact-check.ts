import { AdProductSnapshot, AdScene, FactFlag, ProductFactReview } from "./ad-studio-types";

/**
 * Simple heuristic flag list per spec: words that suggest an unsupported/causal/
 * medical-ish claim unless that exact claim is verbatim present in the imported
 * product description or tags.
 */
export const FLAGGED_TERMS = ["best", "cures", "guaranteed", "clinically", "doctor", "safe for", "non-toxic", "washable", "permanent", "fabric-safe"];

function sourceText(product: AdProductSnapshot): string {
  return `${product.description} ${product.tags.join(" ")}`.toLowerCase();
}

/** Flags any generated on-screen text / voice-over text containing a term from
 * FLAGGED_TERMS unless that exact term is verbatim present in the product's own
 * description/tags (i.e. we didn't invent the claim, the retailer did). */
export function flagUnsupportedClaims(product: AdProductSnapshot, scenes: AdScene[]): FactFlag[] {
  const source = sourceText(product);
  const flags: FactFlag[] = [];

  for (const scene of scenes) {
    const texts = [scene.onScreenText, scene.voiceOverLine].filter(Boolean);
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const term of FLAGGED_TERMS) {
        if (lower.includes(term) && !source.includes(term)) {
          flags.push({
            sceneId: scene.id,
            text,
            matchedTerm: term,
            reason: `"${term}" is not present in the imported product description/tags — this looks like an unsupported claim.`
          });
        }
      }
    }
  }
  return flags;
}

function missingInfo(product: AdProductSnapshot): string[] {
  const missing: string[] = [];
  if (!product.description.trim()) missing.push("Product description");
  if (!product.images.length) missing.push("Product images");
  if (!product.price) missing.push("Price");
  if (!product.benefits.length) missing.push("Benefits/features");
  if (product.isAffiliate && !product.affiliateUrl) missing.push("Affiliate URL");
  return missing;
}

/** Builds the full product-fact review shown before the render step (spec step 9 gate). */
export function buildProductFactReview(product: AdProductSnapshot, scenes: AdScene[]): ProductFactReview {
  const importedFacts = [
    `Title: ${product.title}`,
    product.price ? `Price: $${product.price.toFixed(2)}` : "Price: not set",
    product.compareAtPrice ? `Compare-at price: $${product.compareAtPrice.toFixed(2)}` : "",
    product.vendor ? `Vendor: ${product.vendor}` : "",
    product.productType ? `Product type: ${product.productType}` : "",
    product.tags.length ? `Tags: ${product.tags.join(", ")}` : "",
    product.isAffiliate ? `Affiliate product via ${product.retailerName || "retailer"}` : "Owned Shopify product (not affiliate)"
  ].filter(Boolean);

  const generatedText = scenes.map(s => ({ sceneId: s.id, text: s.onScreenText }));

  return {
    importedFacts,
    generatedText,
    flags: flagUnsupportedClaims(product, scenes),
    missingInfo: missingInfo(product),
    priceDisclaimerNeeded: Boolean(product.price),
    isAffiliate: product.isAffiliate
  };
}

/** Default affiliate disclosure text, used when a brand kit isn't loaded yet. */
export const DEFAULT_DISCLOSURE_TEXT = "Fort Crazypants may earn a commission from qualifying purchases.";

/** Whether the affiliate disclosure should be shown on the CTA card / on-screen, per spec. */
export function shouldShowAffiliateDisclosure(product: Pick<AdProductSnapshot, "isAffiliate">): boolean {
  return Boolean(product.isAffiliate);
}
