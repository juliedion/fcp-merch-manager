import type { GeneratedProduct, ProductInput } from "./types";

function cleanText(value: string) {
  return (value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function sentences(value: string) {
  return value.split(/(?<=[.!?])\s+/).map(v => v.trim()).filter(Boolean);
}

function fallback(product: GeneratedProduct, input: ProductInput): GeneratedProduct {
  const source = cleanText(input.sourceDescription || product.descriptionHtml);
  const facts = (input.sourceDescription || input.features || "")
    .replace(/<[^>]+>/g, " ")
    .split(/(?:\n+|•|(?<=[.!?])\s+)/)
    .map(v => v.replace(/\s+/g, " ").trim())
    .filter(v => v.length > 18 && v.length < 230);
  const uniqueFacts = Array.from(new Set(facts)).slice(0, 6);
  const details = source || `${product.title} is designed to be practical, easy to use, and useful in everyday life.`;
  const paragraphs = sentences(details);
  const p1 = paragraphs.slice(0, 2).join(" ") || details;
  const p2 = paragraphs.slice(2, 5).join(" ");
  const bullets = uniqueFacts.length ? uniqueFacts : product.bullets.slice(0, 5);
  const why = bullets.slice(0, 3).map(x => x.replace(/[.;,:\s]+$/, "") + ".");
  return {
    ...product,
    descriptionHtml: `<p>${p1}</p>${p2 ? `<p>${p2}</p>` : ""}`,
    bullets,
    benefits: why,
    specifications: product.specifications || []
  };
}

export async function rewriteProductPageCopy(product: GeneratedProduct, input: ProductInput): Promise<GeneratedProduct> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback(product, input);
  const source = cleanText(input.sourceDescription || product.descriptionHtml);
  if (!source) return fallback(product, input);

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_COPY_MODEL || "gpt-4.1-mini",
        temperature: 0.55,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are an expert ecommerce copywriter for Fort Crazypants. Rewrite only from supplied product facts. Never invent measurements, materials, capabilities, compatibility, ratings, guarantees or claims. Use polished US English, accurate punctuation and grammar. Avoid generic filler, hype clichés, repetition, and references to AI." },
          { role: "user", content: `Product: ${product.title}\nCategory: ${input.category}\nOriginal listing copy:\n${source}\n\nReturn JSON with exactly these keys:\nproductDetailsHtml: 2 concise persuasive <p> paragraphs rewriting the original description; no heading and no bullets.\npurchaseBullets: array of 5 or 6 short factual benefit-led bullets using the strongest real features.\nwhyYoullLoveIt: exactly 3 short complete sentences that summarize the three best reasons to want this product without duplicating the bullets word-for-word.\nsocialCaption: a scroll-stopping social caption (80-160 words) with a strong first line, natural conversational tone, product benefit, CTA, and 3-6 relevant hashtags. Do not claim personal testing.\npinterestTitle: compelling title under 90 characters.\npinterestDescription: keyword-rich, natural Pinterest description under 450 characters with a CTA.` }
        ]
      })
    });
    const data = await r.json();
    if (!r.ok) return fallback(product, input);
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
    const bullets = Array.isArray(parsed.purchaseBullets) ? parsed.purchaseBullets.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 6) : product.bullets;
    const whySentences = sentences(String(parsed.whyYoullLoveIt || "")).slice(0, 3);
    return {
      ...product,
      descriptionHtml: typeof parsed.productDetailsHtml === "string" && parsed.productDetailsHtml.includes("<p") ? parsed.productDetailsHtml : product.descriptionHtml,
      bullets,
      benefits: whySentences.length ? whySentences : product.benefits,
      instagramCaption: String(parsed.socialCaption || product.instagramCaption),
      facebookPost: String(parsed.socialCaption || product.facebookPost),
      pinterestTitle: String(parsed.pinterestTitle || product.pinterestTitle),
      pinterestDescription: String(parsed.pinterestDescription || product.pinterestDescription),
      pinterestPinCopy: `${String(parsed.pinterestTitle || product.pinterestTitle)}\n\n${String(parsed.pinterestDescription || product.pinterestDescription)}`
    };
  } catch {
    return fallback(product, input);
  }
}
