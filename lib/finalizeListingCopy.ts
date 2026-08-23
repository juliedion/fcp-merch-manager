import type { GeneratedProduct, ProductInput } from "./types";

function clean(value: string) {
  return (value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(value: string) {
  return clean(value).split(/(?<=[.!?])\s+|\n+/).map(v => v.trim()).filter(v => v.length > 15);
}

function punctuate(value: string) {
  const v = value.trim().replace(/[.;,:\s]+$/, "");
  return v ? `${v}.` : "";
}

function sourceFacts(input: ProductInput) {
  const raw = (input.sourceDescription || "").replace(/\r/g, "\n");
  const lines = raw.split(/\n+|•/).map(clean).filter(v => v.length > 15);
  const sentenceFacts = sentences(raw);
  return Array.from(new Set([...lines, ...sentenceFacts])).filter(v => v.length <= 500).slice(0, 12);
}

// This final pass is intentionally conservative: AI may improve wording, but the visible product
// copy is never allowed to drift away from the actual retailer listing. When sourceDescription is
// available, it becomes the factual authority for Product Details, bullets and Why You'll Love It.
export function finalizeListingCopy(product: GeneratedProduct, input: ProductInput): GeneratedProduct {
  const facts = sourceFacts(input);
  if (!facts.length) return product;

  // Keep AI prose only when it visibly overlaps the real source facts. Otherwise use a clean,
  // faithful retailer-grounded rewrite rather than publishing unrelated/generated claims.
  const sourceWords = new Set(clean(input.sourceDescription || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4));
  const overlap = (value: string) => {
    const words = clean(value).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4);
    return words.length ? words.filter(w => sourceWords.has(w)).length / words.length : 0;
  };

  const aiText = clean(product.descriptionHtml || "");
  const groundedAi = overlap(aiText) >= 0.32;

  const detailsFacts = facts.slice(0, 5).map(punctuate).filter(Boolean);
  const descriptionHtml = groundedAi
    ? (product.descriptionHtml || "").replace(/<h2>[\s\S]*?<\/h2>/gi, "").replace(/<p>\s*<strong>Fort Crazypants verdict:<\/strong>[\s\S]*?<\/p>/gi, "").trim()
    : `<p>${detailsFacts.slice(0, 2).join(" ")}</p><p>${detailsFacts.slice(2, 5).join(" ")}</p>`;

  const bullets = facts.slice(0, 6).map(punctuate).filter(Boolean);

  // Benefits are phrased as shopper-friendly takeaways but stay anchored to the same source facts.
  // Keeping one source fact per sentence prevents the old unrelated/generic copy from creeping back in.
  const benefits = facts.slice(0, 3).map(f => punctuate(f));

  return {
    ...product,
    descriptionHtml,
    bullets,
    benefits,
    fcpVerdict: ""
  };
}
