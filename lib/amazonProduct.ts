import type { ScrapedProduct } from "./scrape";

const decode = (value: string) => value
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
  .replace(/\\u002F/g, "/").replace(/\\\//g, "/").trim();
const stripHtml = (value: string) => decode(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

function isAmazonUrl(url: string) {
  try { const h = new URL(url).hostname.toLowerCase(); return h === "amzn.to" || /(^|\.)amazon\.[a-z.]+$/.test(h); } catch { return false; }
}
function asinFromUrl(url: string) {
  const m = url.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i) || url.match(/[?&]asin=([A-Z0-9]{10})(?:&|$)/i);
  return m?.[1]?.toUpperCase() || null;
}
function cleanTitle(raw: string) {
  const title = stripHtml(raw).replace(/^Amazon\.com\s*[:\-–—]\s*/i, "").replace(/\s*:\s*Amazon\.com.*$/i, "").trim();
  if (title.length <= 110) return title;
  const comma = title.indexOf(",");
  if (comma > 20 && comma < 105) return title.slice(0, comma).trim();
  return title.slice(0, 107).replace(/\s+\S*$/, "").trim();
}
function extractTitle(html: string) {
  const p = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
  if (p) return cleanTitle(p);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return t ? cleanTitle(t) : null;
}
function money(value: string | undefined) {
  if (!value) return null; const n = Number(value.replace(/[$,\s]/g, "")); return Number.isFinite(n) && n > 0 ? n : null;
}
function extractPrice(html: string): number | null {
  const anchors = ["corePrice_feature_div", "corePriceDisplay_desktop_feature_div", "apex_desktop", "price_inside_buybox"];
  for (const anchor of anchors) {
    const a = html.indexOf(`id=\"${anchor}\"`), b = html.indexOf(`id='${anchor}'`), i = a >= 0 ? a : b;
    if (i >= 0) {
      const block = html.slice(i, i + 18000);
      const off = block.match(/class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*\$?([\d,]+(?:\.\d{2})?)/i);
      const n = money(off?.[1]); if (n) return n;
      const whole = block.match(/class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([\d,]+)/i)?.[1];
      const frac = block.match(/class=["'][^"']*a-price-fraction[^"']*["'][^>]*>\s*(\d{2})/i)?.[1];
      if (whole) { const n2 = money(`${whole}.${frac || "00"}`); if (n2) return n2; }
    }
  }
  const patterns = [
    /"priceToPay"\s*:\s*\{[\s\S]{0,700}?"priceAmount"\s*:\s*([\d.]+)/i,
    /"displayPrice"\s*:\s*"\$([\d,]+(?:\.\d{2})?)"/i,
    /"priceAmount"\s*:\s*([\d.]+)[\s\S]{0,400}?"currencySymbol"\s*:\s*"\$"/i,
    /id=["']priceblock_(?:ourprice|dealprice|saleprice)["'][^>]*>\s*\$([\d,]+(?:\.\d{2})?)/i,
    /class=["'][^"']*a-price[^"']*["'][\s\S]{0,800}?class=["'][^"']*a-offscreen[^"']*["'][^>]*>\$([\d,]+(?:\.\d{2})?)/i
  ];
  for (const re of patterns) { const n = money(html.match(re)?.[1]); if (n) return n; }
  return null;
}
function imageUrlsFromGallery(html: string): string[] {
  const urls: string[] = [];
  const start = html.search(/"colorImages"\s*:/i);
  if (start >= 0) {
    const stops = [html.indexOf('"colorToAsin"', start + 1), html.indexOf('"heroImage"', start + 1), html.indexOf('"customerImages"', start + 1)].filter(i => i > start);
    const block = html.slice(start, stops.length ? Math.min(...stops) : Math.min(html.length, start + 100000));
    for (const key of ["hiRes", "large", "mainUrl"]) {
      const re = new RegExp(`"${key}"\\s*:\\s*"(https:[^"]+)"`, "gi");
      urls.push(...Array.from(block.matchAll(re)).map(m => decode(m[1])));
    }
  }
  return unique(urls).filter(u => /m\.media-amazon\.com|images-na\.ssl-images-amazon\.com/i.test(u)).slice(0, 15);
}
function fallbackMainImages(html: string): string[] {
  const urls: string[] = [];
  urls.push(...Array.from(html.matchAll(/data-old-hires=["'](https:[^"']+)["']/gi)).map(m => decode(m[1])));
  urls.push(...Array.from(html.matchAll(/"hiRes"\s*:\s*"(https:[^"]+)"/gi)).map(m => decode(m[1])));
  const dynamic = html.match(/id=["']landingImage["'][\s\S]{0,3500}?data-a-dynamic-image=["']([^"']+)["']/i)?.[1];
  if (dynamic) { try { urls.push(...Object.keys(JSON.parse(decode(dynamic)))); } catch {} }
  const landing = html.match(/id=["']landingImage["'][^>]+src=["'](https:[^"']+)["']/i)?.[1]; if (landing) urls.push(decode(landing));
  return unique(urls).filter(u => /m\.media-amazon\.com|images-na\.ssl-images-amazon\.com/i.test(u)).slice(0, 12);
}
function extractDescription(html: string): string | null {
  const fi = html.search(/id=["']feature-bullets["']/i);
  if (fi >= 0) {
    const block = html.slice(fi, fi + 35000);
    const bullets = Array.from(block.matchAll(/<span[^>]*class=["'][^"']*a-list-item[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)).map(m => stripHtml(m[1])).filter(v => v.length > 12 && !/^see more$/i.test(v)).slice(0, 10);
    if (bullets.length) return unique(bullets).join("\n");
  }
  const di = html.search(/id=["']productDescription["']/i);
  if (di >= 0) { const text = stripHtml(html.slice(di, di + 22000).replace(/<script[\s\S]*?<\/script>/gi, " ")); if (text.length > 30) return text.slice(0, 5000); }
  return null;
}
function blocked(html: string) { return /Type the characters you see|Enter the characters you see below|api-services-support@amazon\.com|Robot Check/i.test(html); }
function usable(html: string) { return !blocked(html) && !!extractTitle(html) && (imageUrlsFromGallery(html).length > 0 || fallbackMainImages(html).length > 0); }

async function getAmazonHtml(url: string) {
  const asin = asinFromUrl(url);
  const candidates = unique([
    url,
    asin ? `https://www.amazon.com/dp/${asin}?th=1&psc=1` : "",
    asin ? `https://www.amazon.com/gp/aw/d/${asin}?th=1&psc=1` : ""
  ]);
  const headerSets = [
    { "User-Agent": "Mozilla/5.0 (compatible; FortCrazypantsBot/1.0; +https://fortcrazypants.com)", "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
    { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" }
  ];
  for (const candidate of candidates) {
    for (const headers of headerSets) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 9000);
      try {
        const r = await fetch(candidate, { redirect: "follow", cache: "no-store", signal: controller.signal, headers });
        const html = await r.text();
        if (r.ok && usable(html)) return html;
      } catch {} finally { clearTimeout(timer); }
    }
  }
  return null;
}

export async function enrichAmazonProduct(url: string, base: ScrapedProduct & { blocked?: boolean }): Promise<ScrapedProduct & { blocked?: boolean }> {
  if (!isAmazonUrl(url)) return base;
  const html = await getAmazonHtml(url);
  if (!html) return base;
  const gallery = imageUrlsFromGallery(html), fallback = fallbackMainImages(html);
  return {
    ...base,
    blocked: false,
    title: extractTitle(html) || base.title,
    price: extractPrice(html) ?? base.price,
    images: gallery.length ? gallery : fallback.length ? fallback : base.images,
    description: extractDescription(html) || base.description
  };
}
