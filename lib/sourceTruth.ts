import type { ScrapedProduct } from "./scrape";

const decode = (value: string) => value
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&nbsp;/g, " ")
  .trim();

const text = (value: string) => decode(value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));

function isAmazon(url: string) {
  try { return /(^|\.)amazon\.[a-z.]+$/i.test(new URL(url).hostname); } catch { return false; }
}

function amazonTitle(html: string): string | null {
  const productTitle = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
  if (productTitle) return text(productTitle);
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  if (!title) return null;
  return text(title).replace(/^Amazon\.com\s*[:\-–—]\s*/i, "").replace(/\s*:\s*Amazon\.com.*$/i, "").trim();
}

function amazonPrice(html: string): number | null {
  const scoped = html.match(/id=["']corePrice[^"']*["'][\s\S]{0,8000}/i)?.[0] || html;
  const patterns = [
    /class=["']a-offscreen["'][^>]*>\s*\$([\d,]+\.\d{2})/i,
    /class=["']a-price-whole["'][^>]*>\s*([\d,]+)[^<]*<[^>]*class=["']a-price-decimal["'][^>]*>\.?<\/span>\s*<span[^>]*class=["']a-price-fraction["'][^>]*>(\d{2})/i,
    /"priceAmount"\s*:\s*([\d.]+)/i,
    /"price"\s*:\s*"?([\d]+(?:\.\d{2})?)"?/i
  ];
  for (const re of patterns) {
    const m = scoped.match(re);
    if (!m) continue;
    const n = m[2] ? Number(`${m[1].replace(/,/g, "")}.${m[2]}`) : Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function amazonBullets(html: string): string | null {
  // Only read Amazon's actual “About this item” block. Never scan every a-list-item on the page,
  // because that includes navigation, warranties, sponsored products and unrelated modules.
  const block = html.match(/id=["']feature-bullets["'][^>]*>([\s\S]*?)(?=<div[^>]+id=["']|<hr|<script)/i)?.[1] || "";
  const bullets = Array.from(block.matchAll(/<span[^>]*class=["'][^"']*a-list-item[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi))
    .map(m => text(m[1]))
    .map(v => v.replace(/^About this item\s*/i, "").trim())
    .filter(v => v.length > 20 && !/^(see more|show more)$/i.test(v));

  const descriptionBlock = html.match(/id=["']productDescription["'][^>]*>([\s\S]*?)(?=<\/div>\s*<\/div>|<script)/i)?.[1];
  const description = descriptionBlock ? text(descriptionBlock) : "";

  const parts = Array.from(new Set([...bullets, ...(description ? [description] : [])]));
  return parts.length ? parts.join("\n") : null;
}

function normalizeAmazonImage(url: string) {
  return decode(url).replace(/\\u002F/g, "/").replace(/\\\//g, "/");
}

function amazonGallery(html: string): string[] {
  const candidates: string[] = [];

  // The selected ASIN's colorImages block is the authoritative gallery on Amazon product pages.
  const colorBlock = html.match(/'colorImages'\s*:\s*\{[\s\S]*?'initial'\s*:\s*(\[[\s\S]*?\])\s*[,}]/i)?.[1]
    || html.match(/"colorImages"\s*:\s*\{[\s\S]*?"initial"\s*:\s*(\[[\s\S]*?\])\s*[,}]/i)?.[1];
  if (colorBlock) {
    for (const m of colorBlock.matchAll(/["'](?:hiRes|large)["']\s*:\s*["'](https?:[^"']+)["']/gi)) candidates.push(normalizeAmazonImage(m[1]));
  }

  // Fallback: the actual landing image's dynamic gallery map, still product-scoped.
  if (!candidates.length) {
    const landing = html.match(/id=["']landingImage["'][^>]*data-a-dynamic-image=["']([^"']+)["']/i)?.[1];
    if (landing) {
      try { candidates.push(...Object.keys(JSON.parse(decode(landing))).map(normalizeAmazonImage)); } catch { /* ignore */ }
    }
  }

  return Array.from(new Set(candidates.filter(u => /^https?:\/\//i.test(u)))).slice(0, 12);
}

export async function enforceSourceTruth(url: string, base: ScrapedProduct & { blocked?: boolean }): Promise<ScrapedProduct & { blocked?: boolean }> {
  if (!isAmazon(url)) return base;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
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
    if (/Type the characters you see|Enter the characters you see below/i.test(html)) return base;

    const title = amazonTitle(html);
    const price = amazonPrice(html);
    const description = amazonBullets(html);
    const images = amazonGallery(html);

    return {
      ...base,
      title: title || base.title,
      price: price || base.price,
      description: description || base.description,
      images: images.length ? images : base.images
    };
  } catch {
    return base;
  } finally {
    clearTimeout(timeout);
  }
}
