import type { ScrapedProduct } from "./scrape";

const decode = (value: string) => value
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&nbsp;/g, " ")
  .replace(/\\u002F/g, "/")
  .replace(/\\\//g, "/")
  .trim();

const stripHtml = (value: string) => decode(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));

function isAmazonUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "amzn.to" || /(^|\.)amazon\.[a-z.]+$/.test(host);
  } catch {
    return false;
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function cleanTitle(raw: string) {
  const title = stripHtml(raw)
    .replace(/^Amazon\.com\s*[:\-–—]\s*/i, "")
    .replace(/\s*:\s*Amazon\.com.*$/i, "")
    .trim();
  if (title.length <= 110) return title;
  const comma = title.indexOf(",");
  if (comma > 20 && comma < 105) return title.slice(0, comma).trim();
  return title.slice(0, 107).replace(/\s+\S*$/, "").trim();
}

function extractTitle(html: string) {
  const productTitle = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
  if (productTitle) return cleanTitle(productTitle);
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return titleTag ? cleanTitle(titleTag) : null;
}

function money(value: string | undefined) {
  if (!value) return null;
  const n = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractPrice(html: string): number | null {
  // First search only Amazon's main price/buy-box region. This avoids prices from sponsored
  // products and carousels later in the document.
  const anchors = ["corePrice_feature_div", "corePriceDisplay_desktop_feature_div", "apex_desktop"];
  for (const anchor of anchors) {
    const i = html.indexOf(`id=\"${anchor}\"`) >= 0 ? html.indexOf(`id=\"${anchor}\"`) : html.indexOf(`id='${anchor}'`);
    if (i >= 0) {
      const block = html.slice(i, i + 14000);
      const offscreen = block.match(/class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*\$?([\d,]+(?:\.\d{2})?)/i);
      const n = money(offscreen?.[1]);
      if (n) return n;
      const whole = block.match(/class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([\d,]+)/i)?.[1];
      const fraction = block.match(/class=["'][^"']*a-price-fraction[^"']*["'][^>]*>\s*(\d{2})/i)?.[1];
      if (whole) {
        const n2 = money(`${whole}.${fraction || "00"}`);
        if (n2) return n2;
      }
    }
  }

  // Embedded product state used by current Amazon product pages.
  const patterns = [
    /"priceToPay"\s*:\s*\{[\s\S]{0,500}?"priceAmount"\s*:\s*([\d.]+)/i,
    /"displayPrice"\s*:\s*"\$([\d,]+(?:\.\d{2})?)"/i,
    /"priceAmount"\s*:\s*([\d.]+)[\s\S]{0,300}?"currencySymbol"\s*:\s*"\$"/i,
    /id=["']priceblock_(?:ourprice|dealprice|saleprice)["'][^>]*>\s*\$([\d,]+(?:\.\d{2})?)/i
  ];
  for (const re of patterns) {
    const n = money(html.match(re)?.[1]);
    if (n) return n;
  }
  return null;
}

function imageUrlsFromGallery(html: string): string[] {
  const start = html.search(/"colorImages"\s*:/i);
  if (start < 0) return [];
  // colorImages is the selected product's image gallery. Restrict extraction to this block so
  // sponsored/recommended product images elsewhere on the Amazon page can never enter the list.
  const stopCandidates = [
    html.indexOf('"colorToAsin"', start + 1),
    html.indexOf('"heroImage"', start + 1),
    html.indexOf('"customerImages"', start + 1)
  ].filter(i => i > start);
  const stop = stopCandidates.length ? Math.min(...stopCandidates) : Math.min(html.length, start + 90000);
  const block = html.slice(start, stop);
  const urls: string[] = [];
  for (const key of ["hiRes", "large", "mainUrl"]) {
    const re = new RegExp(`"${key}"\\s*:\\s*"(https:[^"]+)"`, "gi");
    urls.push(...Array.from(block.matchAll(re)).map(m => decode(m[1])));
  }
  return unique(urls).filter(u => /m\.media-amazon\.com|images-na\.ssl-images-amazon\.com/i.test(u)).slice(0, 15);
}

function fallbackMainImages(html: string): string[] {
  const urls: string[] = [];
  urls.push(...Array.from(html.matchAll(/data-old-hires=["'](https:[^"']+)["']/gi)).map(m => decode(m[1])));
  const dynamic = html.match(/id=["']landingImage["'][\s\S]{0,2500}?data-a-dynamic-image=["']([^"']+)["']/i)?.[1];
  if (dynamic) {
    try { urls.push(...Object.keys(JSON.parse(decode(dynamic)))); } catch { /* ignore */ }
  }
  return unique(urls).filter(u => /m\.media-amazon\.com|images-na\.ssl-images-amazon\.com/i.test(u)).slice(0, 12);
}

function extractDescription(html: string): string | null {
  const featureIndex = html.search(/id=["']feature-bullets["']/i);
  if (featureIndex >= 0) {
    const block = html.slice(featureIndex, featureIndex + 28000);
    const bullets = Array.from(block.matchAll(/<span[^>]*class=["'][^"']*a-list-item[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi))
      .map(m => stripHtml(m[1]))
      .filter(v => v.length > 12 && !/^see more$/i.test(v))
      .slice(0, 10);
    if (bullets.length) return unique(bullets).join("\n");
  }
  const descriptionIndex = html.search(/id=["']productDescription["']/i);
  if (descriptionIndex >= 0) {
    const block = html.slice(descriptionIndex, descriptionIndex + 18000);
    const text = stripHtml(block.replace(/<script[\s\S]*?<\/script>/gi, " "));
    if (text.length > 30) return text.slice(0, 5000);
  }
  return null;
}

export async function enrichAmazonProduct(url: string, base: ScrapedProduct & { blocked?: boolean }): Promise<ScrapedProduct & { blocked?: boolean }> {
  if (!isAmazonUrl(url)) return base;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FortCrazypantsBot/1.0; +https://fortcrazypants.com)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    const html = await response.text();
    if (/Type the characters you see|Enter the characters you see below/i.test(html)) return base;

    const gallery = imageUrlsFromGallery(html);
    const fallback = fallbackMainImages(html);
    const images = gallery.length ? gallery : fallback.length ? fallback : base.images;
    return {
      ...base,
      title: extractTitle(html) || base.title,
      price: extractPrice(html) ?? base.price,
      images,
      description: extractDescription(html) || base.description
    };
  } catch {
    return base;
  } finally {
    clearTimeout(timeout);
  }
}
