import type { GeneratedProduct, ProductInput } from "./types";

function cleanText(value: string) {
  return (value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function sentences(value: string) {
  return value.split(/(?<=[.!?])\s+|\n+/).map(v => v.trim()).filter(Boolean);
}

function sourceFacts(input: ProductInput) {
  const raw = input.sourceDescription || "";
  return Array.from(new Set(
    raw.split(/\n+|•|(?<=[.!?])\s+/)
      .map(cleanText)
      .filter(v => v.length > 18 && v.length < 500)
  )).slice(0, 12);
}

function punctuate(value: string) {
  const v = cleanText(value).replace(/[.;,:\s]+$/, "");
  return v ? `${v}.` : "";
}

function overlapRatio(candidate: string, source: string) {
  const sourceWords = new Set(cleanText(source).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4));
  const words = cleanText(candidate).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4);
  return words.length ? words.filter(w => sourceWords.has(w)).length / words.length : 0;
}

function fallback(product: GeneratedProduct, input: ProductInput): GeneratedProduct {
  const facts = sourceFacts(input);
  if (!facts.length) return product;

  const p1 = facts.slice(0, 2).map(punctuate).join(" ");
  const p2 = facts.slice(2, 5).map(punctuate).join(" ");
  const bullets = facts.slice(0, 6).map(punctuate);
  const why = facts.slice(0, 3).map(punctuate);

  return {
    ...product,
    descriptionHtml: `<p>${p1}</p>${p2 ? `<p>${p2}</p>` : ""}`,
    bullets,
    benefits: why,
    fcpVerdict: ""
  };
}

function aiCopyIsGrounded(parsed: Record<string, unknown>, source: string) {
  const description = String(parsed.productDetailsHtml || "");
  const bullets = Array.isArray(parsed.purchaseBullets) ? parsed.purchaseBullets.map(String).join(" ") : "";
  const why = String(parsed.whyYoullLoveIt || "");

  // Require strong lexical overlap with the real retailer listing. This is intentionally
  // conservative: if the model drifts into generic or unrelated copy, we discard it and use
  // a faithful source-based version instead of showing customers the wrong product story.
  return overlapRatio(description, source) >= 0.28
    && overlapRatio(bullets, source) >= 0.28
    && overlapRatio(why, source) >= 0.24;
}

export async function rewriteProductPageCopy(product: GeneratedProduct, input: ProductInput): Promise<GeneratedProduct> {
  const source = input.sourceDescription || "";
  if (!cleanText(source)) return fallback(product, input);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback(product, input);

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_COPY_MODEL || "gpt-4.1-mini",
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You rewrite ecommerce product copy. The retailer listing provided by the user is the ONLY factual source. Never infer, add, substitute, generalize, or guess product capabilities. Every sentence must clearly correspond to a fact stated in the source listing. Preserve exact product purpose and important named features. Use polished US English, correct grammar and punctuation, and no fake reviews or personal-testing claims." },
          { role: "user", content: `Product title: ${product.title}\n\nAUTHORITATIVE ORIGINAL RETAILER LISTING:\n${source}\n\nRewrite THIS EXACT PRODUCT only. If a fact is not stated above, do not mention it. Do not use category assumptions or generic filler.\n\nReturn JSON with exactly these keys:\nproductDetailsHtml: two concise <p> paragraphs that accurately rewrite the source listing. No heading, no bullets.\npurchaseBullets: 5 or 6 short purchase-focused bullets, each tied directly to a stated source fact.\nwhyYoullLoveIt: exactly 3 complete sentences summarizing the strongest stated benefits, without adding claims.\nsocialCaption: an engaging caption grounded only in the source facts, with CTA and 3-6 relevant hashtags.\npinterestTitle: accurate compelling title under 90 characters.\npinterestDescription: accurate keyword-rich Pinterest description under 450 characters with CTA.` }
        ]
      })
    });
    const data = await r.json();
    if (!r.ok) return fallback(product, input);
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}") as Record<string, unknown>;
    if (!aiCopyIsGrounded(parsed, source)) return fallback(product, input);

    const bullets = Array.isArray(parsed.purchaseBullets)
      ? parsed.purchaseBullets.map((x: unknown) => punctuate(String(x))).filter(Boolean).slice(0, 6)
      : product.bullets;
    const whySentences = sentences(String(parsed.whyYoullLoveIt || "")).slice(0, 3).map(punctuate);

    return {
      ...product,
      descriptionHtml: typeof parsed.productDetailsHtml === "string" && parsed.productDetailsHtml.includes("<p") ? parsed.productDetailsHtml : fallback(product, input).descriptionHtml,
      bullets,
      benefits: whySentences.length === 3 ? whySentences : fallback(product, input).benefits,
      instagramCaption: String(parsed.socialCaption || product.instagramCaption),
      facebookPost: String(parsed.socialCaption || product.facebookPost),
      pinterestTitle: String(parsed.pinterestTitle || product.pinterestTitle),
      pinterestDescription: String(parsed.pinterestDescription || product.pinterestDescription),
      pinterestPinCopy: `${String(parsed.pinterestTitle || product.pinterestTitle)}\n\n${String(parsed.pinterestDescription || product.pinterestDescription)}`,
      fcpVerdict: ""
    };
  } catch {
    return fallback(product, input);
  }
}
