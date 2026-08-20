import type { GeneratedProduct, ProductInput } from "./types";
import type { ScrapedProduct } from "./scrape";

const decode = (value: string) => value
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&nbsp;/g, " ")
  .trim();

const stripHtml = (value: string) => decode(value
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<\/p>/gi, " ")
  .replace(/<\/li>/gi, ". ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " "));

function jsonLdProducts(html: string): any[] {
  const out: any[] = [];
  const scripts = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node !== "object") return;
    const type = node["@type"];
    if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) out.push(node);
    if (node["@graph"]) walk(node["@graph"]);
  };
  for (const match of scripts) {
    try { walk(JSON.parse(match[1].trim())); } catch { /* ignore malformed JSON-LD */ }
  }
  return out;
}

function normalizeImageUrl(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeImageUrl);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return normalizeImageUrl(obj.url || obj.contentUrl || obj["@id"]);
  }
  if (typeof value !== "string") return [];
  const url = decode(value).replace(/\\u002F/g, "/").replace(/\\\//g, "/");
  return /^https?:\/\//i.test(url) ? [url] : [];
}

function isBadImage(url: string): boolean {
  return /(?:logo|sprite|icon|avatar|badge|banner|header|footer|share|pixel|tracking|favicon|amazonfresh|nav-|loading|transparent)/i.test(url)
    || /(?:1x1|spacer|blank\.gif)/i.test(url);
}

function imageScore(url: string): number {
  let score = 0;
  if (/images-na\.ssl-images-amazon|m\.media-amazon|media-amazon/i.test(url)) score += 8;
  if (/(?:_AC_|_SL\d+_|_SX\d+_|_SY\d+_)/i.test(url)) score += 4;
  if (/product|products|catalog|media|image/i.test(url)) score += 3;
  if (/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(url)) score += 2;
  if (/thumbnail|thumb|small|50x|75x|100x/i.test(url)) score -= 5;
  if (isBadImage(url)) score -= 20;
  return score;
}

function uniqueRankedImages(urls: string[]): string[] {
  const cleaned = Array.from(new Set(urls.map(u => u.trim()).filter(u => /^https?:\/\//i.test(u))))
    .filter(u => !isBadImage(u));
  return cleaned.sort((a, b) => imageScore(b) - imageScore(a)).slice(0, 12);
}

function isAmazonUrl(url: string): boolean {
  try { return /(^|\.)amazon\.[a-z.]+$/i.test(new URL(url).hostname); } catch { return false; }
}

// Amazon product pages contain many unrelated hiRes/large images for sponsored products,
// recommendations and page modules. The selected ASIN's actual gallery is the colorImages
// "initial" array inside ImageBlockATF. Restrict extraction to that array only.
function extractAmazonSelectedGallery(html: string): string[] {
  const marker = /['"]colorImages['"]\s*:\s*\{\s*['"]initial['"]\s*:\s*\[/i.exec(html);
  if (!marker || marker.index == null) return [];
  const start = marker.index + marker[0].length;
  let depth = 1;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return [];
  const gallery = html.slice(start, end);
  const hiRes = Array.from(gallery.matchAll(/"hiRes"\s*:\s*"(https:[^"]+)"/g))
    .map(m => m[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/"));
  if (hiRes.length) return Array.from(new Set(hiRes)).slice(0, 12);
  const large = Array.from(gallery.matchAll(/"large"\s*:\s*"(https:[^"]+)"/g))
    .map(m => m[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/"));
  return Array.from(new Set(large)).slice(0, 12);
}

export async function enrichScrapedProduct(url: string, base: ScrapedProduct & { blocked?: boolean }): Promise<ScrapedProduct & { blocked?: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FortCrazypantsBot/1.0; +https://fortcrazypants.com)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    const html = await response.text();
    const products = jsonLdProducts(html);
    const product = products.find(p => p?.name) || products[0];

    let images: string[];
    if (isAmazonUrl(response.url || url) || isAmazonUrl(url)) {
      const gallery = extractAmazonSelectedGallery(html);
      // Important: when the selected Amazon gallery is present, NEVER merge base/og/json-ld
      // images back in. Those are exactly where unrelated sponsored/recommended images enter.
      images = gallery.length ? gallery : uniqueRankedImages(base.images || []);
    } else {
      const imageCandidates: string[] = [];
      if (product?.image) imageCandidates.push(...normalizeImageUrl(product.image));
      const ogImages = Array.from(html.matchAll(/<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/gi)).map(m => decode(m[1]));
      imageCandidates.push(...ogImages);
      images = uniqueRankedImages([...imageCandidates, ...(base.images || [])]);
    }

    const structuredTitle = typeof product?.name === "string" ? stripHtml(product.name) : "";
    const structuredDescription = typeof product?.description === "string" ? stripHtml(product.description) : "";

    return {
      ...base,
      title: structuredTitle && structuredTitle.length > 2 ? structuredTitle : base.title,
      description: structuredDescription && structuredDescription.length > 20 ? structuredDescription : base.description,
      images
    };
  } catch {
    return { ...base, images: uniqueRankedImages(base.images || []) };
  } finally {
    clearTimeout(timeout);
  }
}

function sentenceCase(value: string): string {
  const v = value.trim().replace(/\s+/g, " ");
  if (!v) return "";
  return v.charAt(0).toUpperCase() + v.slice(1).replace(/[.;,:\s]+$/, "");
}

function splitFacts(value: string): string[] {
  return value
    .replace(/<[^>]+>/g, " ")
    .split(/(?:\n+|•|\s+[|]\s+|(?<=[.!?])\s+)/)
    .flatMap(part => part.split(/,(?=\s*[A-Z0-9])/))
    .map(sentenceCase)
    .filter(v => v.length >= 8 && v.length <= 240);
}

function fingerprint(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(w => w.length > 2).slice(0, 12).join(" ");
}

function dedupe(items: string[]): string[] {
  const seen: string[] = [];
  return items.filter(item => {
    const fp = fingerprint(item);
    if (!fp) return false;
    const duplicate = seen.some(existing => existing === fp || existing.includes(fp) || fp.includes(existing));
    if (duplicate) return false;
    seen.push(fp);
    return true;
  });
}

function looksLikeSpec(value: string): boolean {
  return /\b\d+(?:\.\d+)?\s*(?:in|inch|inches|ft|feet|cm|mm|oz|lb|lbs|kg|ml|l|w|watts?|v|volts?|mah|pack|piece|pieces|pc|pcs|count|quart|quarts|gallon|gallons|gb|tb)\b/i.test(value)
    || /\b(?:dimensions?|size|material|capacity|weight|color|colour|model|power|voltage|battery|included|compatible|quantity|set of|pack of)\b/i.test(value);
}

function cleanSourceDescription(input: ProductInput): string {
  return stripHtml(input.sourceDescription || "")
    .replace(/\b(?:free shipping|shop now|buy now|add to cart)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function polishGeneratedProduct(product: GeneratedProduct, input: ProductInput): GeneratedProduct {
  const source = cleanSourceDescription(input);
  const sourceFacts = splitFacts(source);
  const featureFacts = dedupe(splitFacts(input.features || ""));
  const allFacts = dedupe([...featureFacts, ...sourceFacts]);

  const factualBullets = dedupe(allFacts.filter(v => !looksLikeSpec(v))).slice(0, 5);
  const specFacts = dedupe(allFacts.filter(looksLikeSpec)).slice(0, 8);
  const bullets = factualBullets.length ? factualBullets : dedupe(product.bullets || []).slice(0, 5);

  const problem = input.problem && !/everyday inconvenience|everyday frustration/i.test(input.problem)
    ? sentenceCase(input.problem)
    : "a common hassle this product is designed to make easier";
  const audience = input.audience && !/busy households|busy families/i.test(input.audience)
    ? input.audience
    : "people who want a simpler, more practical setup";

  const fact1 = allFacts[0];
  const fact2 = allFacts.find(f => f !== fact1);
  const intro = source && source.length > 70
    ? `${product.title} is a practical pick for ${audience}. ${sentenceCase(source).replace(/\.$/, "")}.`
    : `${product.title} is designed for ${audience}, helping with ${problem.toLowerCase()} without adding unnecessary complexity.`;
  const detail = fact1
    ? `What stands out is ${fact1.charAt(0).toLowerCase() + fact1.slice(1)}${fact2 ? `, along with ${fact2.charAt(0).toLowerCase() + fact2.slice(1)}` : ""}. That makes it easier to understand exactly what you're getting and why it may be useful.`
    : `The value is in a straightforward design that focuses on the job it is meant to do, rather than piling on vague extras.`;
  const close = `It makes the most sense for ${audience} who will actually use those core features, not just anyone looking for another impulse buy.`;
  const descriptionHtml = `<p>${intro}</p><p>${detail}</p><p>${close}</p>`;

  const benefits = dedupe([
    input.problem && !/everyday inconvenience|everyday frustration/i.test(input.problem) ? `Helps reduce ${input.problem.toLowerCase()}` : "Makes the intended task simpler and more convenient",
    bullets[0] ? `Turns ${bullets[0].toLowerCase()} into a practical everyday advantage` : "Keeps the product focused on a clear everyday use",
    bullets[1] ? `Adds value through ${bullets[1].toLowerCase()}` : `Designed with ${audience} in mind`
  ]).filter(b => !bullets.some(f => fingerprint(f) === fingerprint(b))).slice(0, 4);

  return {
    ...product,
    descriptionHtml,
    bullets,
    benefits,
    specifications: specFacts
  };
}
