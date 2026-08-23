import { NextResponse } from "next/server";
import { z } from "zod";
import { generateProduct } from "@/lib/generator";
import { formatApiError } from "@/lib/apiError";
import { applyAiCopy, generateAICopy, generateAIProductFacts, isAiCopyEnabled } from "@/lib/aiCopywriter";
import { polishGeneratedProduct } from "@/lib/merchQuality";
import { rewriteProductPageCopy } from "@/lib/productPageAI";

const schema = z.object({
  url: z.string().default(""), name: z.string().min(2), cost: z.coerce.number().min(0), price: z.coerce.number().positive(),
  category: z.string().default("Home & Lifestyle"), audience: z.string().default("busy families"), problem: z.string().default(""),
  features: z.string().default(""), shippingDays: z.coerce.number().min(0).default(7),
  competition: z.enum(["low", "medium", "high"]).default("medium"), demoFactor: z.coerce.number().min(1).max(10).default(7),
  productType: z.enum(["amazon_affiliate", "dropshipping", "wholesale", "private_label"]).default("dropshipping"),
  amazonUrl: z.string().default(""), affiliateUrl: z.string().default(""),
  isAffiliateProduct: z.coerce.boolean().optional(),
  merchant: z.string().default(""), affiliateNetwork: z.string().default(""),
  vendor: z.string().default("Fort Crazypants"), compareAtPrice: z.coerce.number().min(0).default(0), fcpVerdict: z.string().default(""),
  sourceDescription: z.string().default("")
}).transform(v => ({ ...v, isAffiliateProduct: v.isAffiliateProduct ?? v.productType === "amazon_affiliate" }))
  .refine(v => !v.isAffiliateProduct || /^https:\/\//i.test(v.affiliateUrl || v.amazonUrl || ""), {
    message: "Affiliate products require a valid https:// Affiliate URL.", path: ["affiliateUrl"]
  });

export async function POST(req: Request) {
  try {
    const input = schema.parse(await req.json());

    if (!isAiCopyEnabled()) {
      const generated = polishGeneratedProduct(generateProduct(input), input);
      const pageCopy = await rewriteProductPageCopy(generated, input);
      return NextResponse.json({ ...pageCopy, aiCopyUsed: false });
    }

    const facts = await generateAIProductFacts(input);
    const workingInput = facts ? { ...input, ...facts } : input;
    const deterministic = generateProduct(workingInput);
    const overrides = await generateAICopy(workingInput, deterministic);
    const polished = polishGeneratedProduct(applyAiCopy(deterministic, overrides), workingInput);
    const pageCopy = await rewriteProductPageCopy(polished, workingInput);

    return NextResponse.json({ ...pageCopy, aiCopyUsed: Boolean(facts || overrides) });
  } catch (error) {
    return NextResponse.json({ error: formatApiError(error, "Invalid product data") }, { status: 400 });
  }
}
