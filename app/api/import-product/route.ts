import { NextResponse } from "next/server";

const BLOCKED_TEXT = [
  "free delivery",
  "eligible purchases",
  "amazon.com",
  "shop now",
  "add to cart",
  "buy now",
  "returns",
  "prime",
  "sponsored",
  "best sellers",
  "customers who viewed",
  "see more",
  "visit the store",
  "home & kitchen",
  "end tables"
];

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMeta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}

function getTitle(html: string) {
  return decodeHtml(getMeta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function cleanAmazonTitle(title: string) {
  return decodeHtml(title)
    .replace(/^amazon(?:\.com)?\s*:\s*/i, "")
    .replace(/\s*[-|:]\s*amazon(?:\.com)?\s*$/i, "")
    .replace(/\s*:\s*(home\s*&\s*kitchen|kitchen\s*&\s*dining|office products|pet supplies|sports\s*&\s*outdoors|tools\s*&\s*home improvement).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonLd(html: string) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : parsed?.["@graph"] || [parsed];
      for (const node of nodes) {
        if (node?.["@type"] === "Product" || (Array.isArray(node?.["@type"]) && node["@type"].includes("Product"))) return node;
      }
    } catch {
      // Ignore malformed retailer JSON-LD.
    }
  }
  return null;
}

function parseMoney(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const price = Number.parseFloat(normalized);
  return Number.isFinite(price) ? price : undefined;
}

function trustworthyPrice(value: unknown, isAmazon: boolean) {
  const price = parseMoney(value);
  if (!price || price <= 0) return undefined;
  if (isAmazon && price < 15) return undefined;
  if (price > 100000) return undefined;
  return Math.round(price * 100) / 100;
}

function extractPrice(html: string, product: any, isAmazon: boolean) {
  const offer = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
  const candidates: unknown[] = [
    offer?.price,
    offer?.lowPrice,
    getMeta(html, "product:price:amount"),
    getMeta(html, "og:price:amount")
  ];

  if (!isAmazon) {
    const visible = html.match(/(?:[$£€])\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/);
    if (visible?.[1]) candidates.push(visible[1]);
  }

  for (const candidate of candidates) {
    const price = trustworthyPrice(candidate, isAmazon);
    if (price) return price;
  }
  return undefined;
}

function cleanFeature(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "))
    .replace(/^[•·\-*\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function validFeature(value: string, title: string) {
  const lower = value.toLowerCase();
  if (value.length < 8 || value.length > 180) return false;
  if (BLOCKED_TEXT.some(text => lower.includes(text))) return false;
  if (/\b(free|delivery|shipping|returns?|eligible|amazon|cart|checkout|deal|save\s+\d+%)\b/i.test(value)) return false;
  if (title && lower === title.toLowerCase()) return false;
  return true;
}

function extractFeatures(html: string, product: any, title: string) {
  const values: string[] = [];

  if (Array.isArray(product?.additionalProperty)) {
    for (const item of product.additionalProperty) {
      if (item?.name && item?.value) values.push(`${item.name}: ${item.value}`);
    }
  }

  const bulletBlocks = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(match => cleanFeature(match[1]));
  values.push(...bulletBlocks);

  const description = decodeHtml(product?.description || getMeta(html, "description") || getMeta(html, "og:description"));
  if (description) values.push(...description.split(/[.;]\s+/));

  return [...new Set(values.map(cleanFeature).filter(value => validFeature(value, title)))].slice(0, 6);
}

function inferCategory(title: string) {
  const t = title.toLowerCase();
  if (/cart|storage|organizer|shelf|rack|cabinet/.test(t)) return "Home Organization";
  if (/dog|cat|pet|puppy/.test(t)) return "Pet Supplies";
  if (/toy|game|kid|child/.test(t)) return "Kids & Family";
  if (/kitchen|cooking|bake|pan|utensil/.test(t)) return "Kitchen";
  if (/outdoor|garden|patio|camp/.test(t)) return "Outdoor";
  return "General Merchandise";
}

function inferAudience(category: string) {
  if (category === "Home Organization") return "busy families and small-space organizers";
  if (category === "Pet Supplies") return "pet parents";
  if (category === "Kids & Family") return "parents and families";
  if (category === "Kitchen") return "home cooks and busy households";
  return "practical shoppers looking for useful everyday finds";
}

function inferProblem(title: string, category: string) {
  const t = title.toLowerCase();
  if (/cart|storage|organizer|shelf|rack/.test(t)) return "clutter and supplies that do not have a convenient home";
  if (category === "Pet Supplies") return "keeping pets active, engaged, or comfortable";
  if (category === "Kitchen") return "making everyday meal prep and kitchen tasks easier";
  return "an everyday inconvenience that could be solved more simply";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
    if (!rawUrl) return NextResponse.json({ error: "Paste a product link first." }, { status: 400 });

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "That does not look like a valid product URL." }, { status: 400 });
    }

    if (!/^https?:$/.test(url.protocol)) {
      return NextResponse.json({ error: "Only http and https product links are supported." }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ error: `The retailer returned ${response.status}. Enter the missing details manually.` }, { status: 422 });
    }

    const html = await response.text();
    const finalUrl = response.url || rawUrl;
    const hostname = new URL(finalUrl).hostname.toLowerCase();
    const isAmazon = hostname.includes("amazon.") || hostname === "amzn.to";
    const product = extractJsonLd(html);

    const rawTitle = decodeHtml(product?.name || getTitle(html));
    const title = isAmazon ? cleanAmazonTitle(rawTitle) : rawTitle.replace(/\s*[|–-]\s*[^|–-]{1,40}$/i, "").trim();
    const imageValue = Array.isArray(product?.image) ? product.image[0] : product?.image;
    const image = decodeHtml(imageValue || getMeta(html, "og:image"));
    const description = decodeHtml(product?.description || getMeta(html, "og:description") || getMeta(html, "description"));
    const price = extractPrice(html, product, isAmazon);
    const category = inferCategory(title);
    const features = extractFeatures(html, product, title);

    if (!title) {
      return NextResponse.json({ error: "The retailer blocked the product title. Enter the product details manually." }, { status: 422 });
    }

    const warnings: string[] = [];
    if (!price) warnings.push(isAmazon ? "Amazon did not expose a trustworthy price, so the existing selling price was left unchanged." : "No trustworthy price was found, so review the selling price manually.");
    if (!features.length) warnings.push("No clean feature list was available, so review the features manually.");

    return NextResponse.json({
      finalUrl,
      title,
      description,
      image,
      price,
      category,
      audience: inferAudience(category),
      problem: inferProblem(title, category),
      features,
      warning: warnings.join(" ")
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "The retailer took too long to respond. Try again or enter the details manually."
      : "The product page could not be imported. Try another link or enter the details manually.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
