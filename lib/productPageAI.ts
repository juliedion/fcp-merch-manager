import type { GeneratedProduct, ProductInput } from "./types";

function cleanText(value: string) {
  return (value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceFacts(input: ProductInput) {
  return (input.sourceDescription || "")
    .replace(/<[^>]+>/g, " ")
    .split(/(?:\n+|•|(?<=[.!?])\s+)/)
    .map(v => v.replace(/\s+/g, " ").trim())
    .filter(v => v.length > 12 && v.length < 320);
}

function sentenceize(value: string) {
  const s = value.trim().replace(/[,:;\s]+$/, "");
  if (!s) return "";
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

function dedupe(values: string[]) {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fallback(product: GeneratedProduct, input: ProductInput): GeneratedProduct {
  const facts = dedupe(sourceFacts(input));
  const detailsFacts = facts.slice(0, 4);
  const bullets = facts.slice(0, 6).map(sentenceize).filter(Boolean);
  const why = facts.slice(0, 3).map(sentenceize).filter(Boolean);
  const title = input.name.trim() || product.title;
  const detail1 = detailsFacts.slice(0, 2).map(sentenceize).join(" ");
  const detail2 = detailsFacts.slice(2, 4).map(sentenceize).join(" ");
  const descriptionHtml = detail1
    ? `<p>${detail1}</p>${detail2 ? `<p>${detail2}</p>` : ""}`
    : `<p>${title} is shown here using the information provided by the original retailer listing.</p>`;
  const plain = cleanText(descriptionHtml);
  const meta = plain.length > 155 ? `${plain.slice(0, 152).replace(/\s+\S*$/, "")}...` : plain;
  const social = `${title}\n\n${why.join(" ")}\n\nSee the full product details and current price at Fort Crazypants.`;

  return {
    ...product,
    title,
    descriptionHtml,
    bullets,
    benefits: why,
    specifications: [],
    metaDescription: meta,
    instagramCaption: social,
    facebookPost: social,
    tiktokCaption: `${title} — ${why.slice(0, 2).join(" ")}`,
    pinterestTitle: title.slice(0, 90),
    pinterestDescription: meta,
    pinterestPinCopy: `${title}\n\n${meta}`,
    emailSubject: title,
    emailBody: `${title}\n\n${plain}`,
    googleShoppingDescription: plain,
    blogArticle: plain,
    fcpVerdict: ""
  };
}

function sourceTokenSet(input: ProductInput) {
  const text = `${input.name} ${input.sourceDescription}`.toLowerCase();
  return new Set(text.match(/[a-z0-9]{4,}/g) || []);
}

function groundedEnough(value: string, sourceTokens: Set<string>) {
  const tokens = value.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  const meaningful = tokens.filter(t => !["this","that","with","from","your","have","will","more","product","fort","crazypants"].includes(t));
  if (!meaningful.length) return false;
  const overlap = meaningful.filter(t => sourceTokens.has(t)).length;
  return overlap / meaningful.length >= 0.35;
}

export async function rewriteProductPageCopy(product: GeneratedProduct, input: ProductInput): Promise<GeneratedProduct> {
  const source = cleanText(input.sourceDescription);
  if (!source) return fallback(product, input);
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
          {
            role: "system",
            content: "You write ecommerce copy using ONLY the CURRENT retailer listing supplied in the user message. Never use memory, prior products, inferred product problems, generic category templates, or facts not explicitly supported by this listing. If the listing says kids smartwatch, every field must stay about that exact smartwatch. If a fact is not in the listing, omit it. Use polished US English and accurate punctuation."
          },
          {
            role: "user",
            content: `CURRENT PRODUCT TITLE:\n${input.name}\n\nCURRENT RETAILER LISTING COPY:\n${source}\n\nCURRENT PRICE:\n${input.price}\n\nReturn JSON with exactly these keys:\nproductDetailsHtml: 2 concise persuasive <p> paragraphs based only on the retailer copy.\npurchaseBullets: 5-6 short factual bullets based only on real listing features.\nwhyYoullLoveIt: exactly 3 short complete sentences summarizing the strongest real benefits.\nmetaDescription: compelling accurate description under 155 characters.\nsocialCaption: 80-150 words, conversational and specific to this exact product, with CTA and 3-6 relevant hashtags.\npinterestTitle: accurate compelling title under 90 characters.\npinterestDescription: accurate keyword-rich description under 450 characters.\ntiktokCaption: short caption specific to this exact product.\nemailSubject: short product-specific subject line.\nemailBody: 2 short paragraphs based only on the current retailer facts.\ngoogleShoppingDescription: concise factual product description.\n\nABSOLUTE RULE: Do not mention crafts, engraving, reminders, routines, kitchens, organizers, cleaning, or any unrelated use case unless those exact concepts are present in the CURRENT retailer listing above.`
          }
        ]
      })
    });
    if (!r.ok) return fallback(product, input);
    const data = await r.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
    const tokenSet = sourceTokenSet(input);

    const detailsHtml = typeof parsed.productDetailsHtml === "string" ? parsed.productDetailsHtml.trim() : "";
    const detailsPlain = cleanText(detailsHtml);
    const bullets = Array.isArray(parsed.purchaseBullets)
      ? dedupe(parsed.purchaseBullets.map((x: unknown) => sentenceize(String(x))).filter(Boolean)).slice(0, 6)
      : [];
    const why = String(parsed.whyYoullLoveIt || "").split(/(?<=[.!?])\s+/).map(sentenceize).filter(Boolean).slice(0, 3);

    const fieldsToCheck = [
      detailsPlain,
      ...bullets,
      ...why,
      String(parsed.metaDescription || ""),
      String(parsed.socialCaption || ""),
      String(parsed.pinterestDescription || ""),
      String(parsed.tiktokCaption || ""),
      String(parsed.emailBody || ""),
      String(parsed.googleShoppingDescription || "")
    ].filter(Boolean);

    if (!detailsHtml.includes("<p") || bullets.length < 3 || why.length < 2 || fieldsToCheck.some(v => !groundedEnough(v, tokenSet))) {
      return fallback(product, input);
    }

    return {
      ...product,
      title: input.name.trim() || product.title,
      descriptionHtml: detailsHtml,
      bullets,
      benefits: why,
      specifications: [],
      metaDescription: String(parsed.metaDescription || "").trim(),
      instagramCaption: String(parsed.socialCaption || "").trim(),
      facebookPost: String(parsed.socialCaption || "").trim(),
      tiktokCaption: String(parsed.tiktokCaption || "").trim(),
      pinterestTitle: String(parsed.pinterestTitle || input.name).trim().slice(0, 90),
      pinterestDescription: String(parsed.pinterestDescription || "").trim().slice(0, 450),
      pinterestPinCopy: `${String(parsed.pinterestTitle || input.name).trim()}\n\n${String(parsed.pinterestDescription || "").trim()}`,
      emailSubject: String(parsed.emailSubject || input.name).trim(),
      emailBody: String(parsed.emailBody || "").trim(),
      googleShoppingDescription: String(parsed.googleShoppingDescription || "").trim(),
      blogArticle: detailsPlain,
      fcpVerdict: ""
    };
  } catch {
    return fallback(product, input);
  }
}
