const unique = <T,>(values: T[]) => Array.from(new Set(values));

function money(raw?: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asinFromUrl(url: string): string | null {
  const m = url.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i)
    || url.match(/[?&]asin=([A-Z0-9]{10})(?:&|$)/i);
  return m?.[1]?.toUpperCase() || null;
}

async function resolveUrl(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile Safari/604.1" }
    });
    return r.url || url;
  } catch {
    return url;
  }
}

function extractBuyBoxPrice(html: string): number | null {
  const scopedAnchors = [
    "corePrice_feature_div",
    "corePriceDisplay_desktop_feature_div",
    "corePriceDisplay_mobile_feature_div",
    "price_inside_buybox",
    "apex_desktop",
    "apex_mobile",
    "newAccordionRow_1"
  ];
  for (const id of scopedAnchors) {
    const hit = new RegExp(`id=["']${id}["']`, "i").exec(html);
    if (!hit) continue;
    const block = html.slice(hit.index, hit.index + 26000);
    const direct = block.match(/class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*(?:US\$|\$)?\s*([\d,]+(?:\.\d{2})?)/i);
    const n = money(direct?.[1]);
    if (n) return n;
    const whole = block.match(/class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([\d,]+)/i)?.[1];
    const fraction = block.match(/class=["'][^"']*a-price-fraction[^"']*["'][^>]*>\s*(\d{2})/i)?.[1];
    const split = whole ? money(`${whole}.${fraction || "00"}`) : null;
    if (split) return split;
  }

  const patterns = [
    /"priceToPay"\s*:\s*\{[\s\S]{0,1500}?"priceAmount"\s*:\s*([\d.]+)/i,
    /"priceToPay"\s*:\s*\{[\s\S]{0,1500}?"displayString"\s*:\s*"(?:US\\?\$|\\?\$)?([\d,]+(?:\.\d{2})?)"/i,
    /"displayPrice"\s*:\s*"(?:US\\?\$|\\?\$)?([\d,]+(?:\.\d{2})?)"/i,
    /"priceAmount"\s*:\s*([\d.]+)[\s\S]{0,600}?"currency(?:Code)?"\s*:\s*"USD"/i,
    /id=["']priceblock_(?:ourprice|dealprice|saleprice)["'][^>]*>\s*(?:US\$|\$)?\s*([\d,]+(?:\.\d{2})?)/i
  ];
  for (const p of patterns) {
    const n = money(html.match(p)?.[1]);
    if (n) return n;
  }
  return null;
}

function extractOfferPrice(html: string): number | null {
  const offerBlocks = html.split(/id=["']aod-offer-[^"']+["']/i).slice(1);
  for (const block of offerBlocks) {
    const first = block.slice(0, 12000);
    if (/Used|Renewed|Refurbished/i.test(first.slice(0, 2500))) continue;
    const n = money(first.match(/class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*\$?\s*([\d,]+(?:\.\d{2})?)/i)?.[1]);
    if (n) return n;
  }
  return extractBuyBoxPrice(html);
}

export async function verifyAmazonPrice(inputUrl: string): Promise<{ price: number | null; source: string }> {
  const resolved = await resolveUrl(inputUrl);
  const asin = asinFromUrl(resolved) || asinFromUrl(inputUrl);
  if (!asin) return { price: null, source: "amazon-no-asin" };

  const candidates = unique([
    `https://www.amazon.com/dp/${asin}?th=1&psc=1`,
    `https://www.amazon.com/gp/aw/d/${asin}?th=1&psc=1`,
    `https://www.amazon.com/gp/product/ajax/ref=dp_aod_ALL_mbc?asin=${asin}&pc=dp&experienceId=aodAjaxMain`
  ]);
  const headers = [
    {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    },
    {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    }
  ];

  for (const candidate of candidates) {
    for (const h of headers) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      try {
        const r = await fetch(candidate, { cache: "no-store", redirect: "follow", headers: h, signal: controller.signal });
        if (!r.ok) continue;
        const html = await r.text();
        if (/Type the characters you see|Robot Check|api-services-support@amazon\.com/i.test(html)) continue;
        const price = candidate.includes("aod_ALL") ? extractOfferPrice(html) : extractBuyBoxPrice(html);
        if (price) return { price, source: candidate.includes("aod_ALL") ? "amazon-offers" : "amazon-buy-box" };
      } catch {
        // Try the next authoritative Amazon representation.
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return { price: null, source: "amazon-price-unavailable" };
}
