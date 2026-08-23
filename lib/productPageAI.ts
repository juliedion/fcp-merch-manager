import type { GeneratedProduct, ProductInput } from "./types";

function cleanText(value: string) {
  return (value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " ").trim();
}
function sourceFacts(input: ProductInput) {
  return (input.sourceDescription || "").replace(/<[^>]+>/g, " ").split(/(?:\n+|•|(?<=[.!?])\s+)/)
    .map(v => v.replace(/\s+/g, " ").trim()).filter(v => v.length > 12 && v.length < 320);
}
function sentenceize(value: string) { const s = value.trim().replace(/[,:;\s]+$/, ""); return s ? (/[.!?]$/.test(s) ? s : `${s}.`) : ""; }
function dedupe(values: string[]) { const seen = new Set<string>(); return values.filter(value => { const key = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); if (!key || seen.has(key)) return false; seen.add(key); return true; }); }

function fallback(product: GeneratedProduct, input: ProductInput): GeneratedProduct {
  const facts = dedupe(sourceFacts(input));
  const detailsFacts = facts.slice(0, 4);
  const bullets = facts.slice(0, 6).map(sentenceize).filter(Boolean);
  const why = facts.slice(0, 3).map(sentenceize).filter(Boolean);
  const title = input.name.trim() || product.title;
  const detail1 = detailsFacts.slice(0, 2).map(sentenceize).join(" ");
  const detail2 = detailsFacts.slice(2, 4).map(sentenceize).join(" ");
  const descriptionHtml = detail1 ? `<p>${detail1}</p>${detail2 ? `<p>${detail2}</p>` : ""}` : `<p>${title} — see the original retailer listing for complete product details.</p>`;
  const plain = cleanText(descriptionHtml);
  const meta = plain.length > 155 ? `${plain.slice(0, 152).replace(/\s+\S*$/, "")}...` : plain;
  const social = `${title}\n\n${why.join(" ")}\n\nSee the full product details and current price at Fort Crazypants.`;
  return { ...product, title, descriptionHtml, bullets, benefits: why, specifications: [], metaDescription: meta,
    recommendation: { ...product.recommendation, summary: why.join(" ") || meta },
    instagramCaption: social, facebookPost: social, tiktokCaption: `${title} — ${why.slice(0, 2).join(" ")}`,
    pinterestTitle: title.slice(0, 90), pinterestDescription: meta, pinterestPinCopy: `${title}\n\n${meta}`,
    emailSubject: title, emailBody: `${title}\n\n${plain}`, googleShoppingDescription: plain, blogArticle: plain, fcpVerdict: "" };
}

function sourceTokenSet(input: ProductInput) { return new Set(`${input.name} ${input.sourceDescription}`.toLowerCase().match(/[a-z0-9]{4,}/g) || []); }
function groundedEnough(value: string, sourceTokens: Set<string>) {
  const tokens = value.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  const meaningful = tokens.filter(t => !["this","that","with","from","your","have","will","more","product","fort","crazypants"].includes(t));
  if (!meaningful.length) return false;
  return meaningful.filter(t => sourceTokens.has(t)).length / meaningful.length >= 0.35;
}

export async function rewriteProductPageCopy(product: GeneratedProduct, input: ProductInput): Promise<GeneratedProduct> {
  const source = cleanText(input.sourceDescription);
  if (!source) return fallback(product, input);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback(product, input);
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({
      model: process.env.OPENAI_COPY_MODEL || "gpt-4.1-mini", temperature: 0.2, response_format: { type: "json_object" }, messages: [
        { role: "system", content: "Write ecommerce copy using ONLY the CURRENT retailer listing supplied below. Never use memory, prior products, inferred problems, generic templates, or unstated facts. Every output field must describe the exact current product. Use polished US English and accurate punctuation." },
        { role: "user", content: `CURRENT PRODUCT TITLE:\n${input.name}\n\nCURRENT RETAILER LISTING COPY:\n${source}\n\nCURRENT PRICE:\n${input.price}\n\nReturn JSON with exactly these keys:\nproductDetailsHtml: 2 concise persuasive <p> paragraphs based only on the retailer copy.\npurchaseBullets: 5-6 short factual purchase-focused bullets.\nwhyYoullLoveIt: exactly 3 short complete sentences summarizing the strongest real benefits.\nquickTake: 1-2 compelling sentences describing this exact product, based only on the listing.\nwhyWePickedIt: 2-3 concise sentences based only on the strongest listing facts.\nmetaDescription: accurate description under 155 characters.\nsocialCaption: 80-150 words, specific to this product, with CTA and 3-6 relevant hashtags.\npinterestTitle: accurate title under 90 characters.\npinterestDescription: accurate keyword-rich description under 450 characters.\ntiktokCaption: short product-specific caption.\nemailSubject: short product-specific subject.\nemailBody: 2 short paragraphs based only on current retailer facts.\ngoogleShoppingDescription: concise factual product description.\n\nDo not mention any use case or feature unless it appears in THIS listing.` }
      ] }) });
    if (!r.ok) return fallback(product, input);
    const data = await r.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}");
    const tokenSet = sourceTokenSet(input);
    const detailsHtml = typeof parsed.productDetailsHtml === "string" ? parsed.productDetailsHtml.trim() : "";
    const detailsPlain = cleanText(detailsHtml);
    const bullets = Array.isArray(parsed.purchaseBullets) ? dedupe(parsed.purchaseBullets.map((x: unknown) => sentenceize(String(x))).filter(Boolean)).slice(0, 6) : [];
    const why = String(parsed.whyYoullLoveIt || "").split(/(?<=[.!?])\s+/).map(sentenceize).filter(Boolean).slice(0, 3);
    const quickTake = String(parsed.quickTake || parsed.metaDescription || "").trim();
    const whyPicked = String(parsed.whyWePickedIt || parsed.whyYoullLoveIt || "").trim();
    const fieldsToCheck = [detailsPlain, ...bullets, ...why, quickTake, whyPicked, String(parsed.metaDescription || ""), String(parsed.socialCaption || ""), String(parsed.pinterestDescription || ""), String(parsed.tiktokCaption || ""), String(parsed.emailBody || ""), String(parsed.googleShoppingDescription || "")].filter(Boolean);
    if (!detailsHtml.includes("<p") || bullets.length < 3 || why.length < 2 || fieldsToCheck.some(v => !groundedEnough(v, tokenSet))) return fallback(product, input);
    return { ...product, title: input.name.trim() || product.title, descriptionHtml: detailsHtml, bullets, benefits: why, specifications: [],
      metaDescription: quickTake || String(parsed.metaDescription || "").trim(),
      recommendation: { ...product.recommendation, summary: whyPicked || why.join(" ") },
      instagramCaption: String(parsed.socialCaption || "").trim(), facebookPost: String(parsed.socialCaption || "").trim(), tiktokCaption: String(parsed.tiktokCaption || "").trim(),
      pinterestTitle: String(parsed.pinterestTitle || input.name).trim().slice(0, 90), pinterestDescription: String(parsed.pinterestDescription || "").trim().slice(0, 450),
      pinterestPinCopy: `${String(parsed.pinterestTitle || input.name).trim()}\n\n${String(parsed.pinterestDescription || "").trim()}`,
      emailSubject: String(parsed.emailSubject || input.name).trim(), emailBody: String(parsed.emailBody || "").trim(), googleShoppingDescription: String(parsed.googleShoppingDescription || "").trim(), blogArticle: detailsPlain, fcpVerdict: "" };
  } catch { return fallback(product, input); }
}
