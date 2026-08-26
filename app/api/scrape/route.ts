import { NextResponse } from "next/server";
import { z } from "zod";
import { buildResearchSummary, inferProductInput, scrapeProduct } from "@/lib/scrape";
import { enrichScrapedProduct } from "@/lib/merchQuality";
import { enrichAmazonProduct } from "@/lib/amazonProduct";
import { verifyAmazonPrice } from "@/lib/amazonPrice";
import { enforceSourceTruth } from "@/lib/sourceTruth";
import { formatApiError } from "@/lib/apiError";

const schema = z.object({ url: z.string().url() });

function isAmazon(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "amzn.to" || /(^|\.)amazon\.[a-z.]+$/i.test(host);
  } catch { return false; }
}

export async function POST(req: Request) {
  try {
    const { url } = schema.parse(await req.json());
    const scrapedBase = await scrapeProduct(url);
    const enriched = await enrichScrapedProduct(url, scrapedBase);
    const amazonEnriched = await enrichAmazonProduct(url, enriched);
    const sourceTruth = await enforceSourceTruth(url, amazonEnriched);

    let scraped = sourceTruth;
    let priceSource = "retailer-page";
    if (isAmazon(url)) {
      const verified = await verifyAmazonPrice(url);
      priceSource = verified.source;
      // For Amazon affiliate listings, only use a price that was verified against the
      // product's own buy box/offers data. Do not retain a possibly unrelated scraped price.
      scraped = { ...sourceTruth, price: verified.price };
    }

    if (isAmazon(url) && (scraped.blocked || !scraped.description || !scraped.images.length)) {
      return NextResponse.json({
        error: "Amazon did not expose the exact product details/gallery for this request. The Merch Manager stopped the import instead of using unrelated Amazon content. Please retry the product URL."
      }, { status: 422 });
    }

    const inference = inferProductInput(scraped, url);
    const research = buildResearchSummary(scraped, inference);
    return NextResponse.json({ scraped, research, priceSource, ...inference });
  } catch (error) {
    return NextResponse.json({ error: formatApiError(error, "Could not read that URL") }, { status: 400 });
  }
}
