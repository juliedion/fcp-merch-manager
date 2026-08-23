import { NextResponse } from "next/server";
import { z } from "zod";
import { buildResearchSummary, inferProductInput, scrapeProduct } from "@/lib/scrape";
import { enrichScrapedProduct } from "@/lib/merchQuality";
import { enrichAmazonProduct } from "@/lib/amazonProduct";
import { enforceSourceTruth } from "@/lib/sourceTruth";
import { formatApiError } from "@/lib/apiError";

const schema = z.object({ url: z.string().url() });

function isAmazon(url: string) {
  try { return /(^|\.)amazon\.[a-z.]+$/i.test(new URL(url).hostname); } catch { return false; }
}

export async function POST(req: Request) {
  try {
    const { url } = schema.parse(await req.json());
    const scrapedBase = await scrapeProduct(url);
    const enriched = await enrichScrapedProduct(url, scrapedBase);
    const amazonEnriched = await enrichAmazonProduct(url, enriched);
    const scraped = await enforceSourceTruth(url, amazonEnriched);

    // Never generate an Amazon listing from generic/fallback page content. A missing source
    // description/gallery is safer than silently attaching copy or images from another product.
    if (isAmazon(url) && (scraped.blocked || !scraped.description || !scraped.images.length)) {
      return NextResponse.json({
        error: "Amazon did not expose the exact product details/gallery for this request. The Merch Manager stopped the import instead of using unrelated Amazon content. Please retry the product URL."
      }, { status: 422 });
    }

    const inference = inferProductInput(scraped, url);
    const research = buildResearchSummary(scraped, inference);
    return NextResponse.json({ scraped, research, ...inference });
  } catch (error) {
    return NextResponse.json({ error: formatApiError(error, "Could not read that URL") }, { status: 400 });
  }
}
