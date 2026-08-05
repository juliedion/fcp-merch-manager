import { describe, expect, it } from "vitest";
import { buildProductFactReview, flagUnsupportedClaims, shouldShowAffiliateDisclosure } from "@/lib/ad-studio-fact-check";
import { AdProductSnapshot, AdScene } from "@/lib/ad-studio-types";

function product(overrides: Partial<AdProductSnapshot> = {}): AdProductSnapshot {
  return {
    source: "shopify",
    sourceId: "1",
    title: "Test Product",
    description: "A soft blanket for kids.",
    images: ["https://example.com/1.jpg"],
    price: 20,
    compareAtPrice: null,
    vendor: "",
    productType: "",
    tags: [],
    collections: [],
    handle: "",
    productUrl: "",
    isAffiliate: false,
    affiliateUrl: null,
    retailerName: null,
    benefits: [],
    seoDescription: "",
    ...overrides
  };
}

function scene(onScreenText: string): AdScene {
  return {
    id: "s1",
    sceneNumber: 1,
    durationSeconds: 3,
    purpose: "Test",
    visualDescription: "",
    recommendedSource: "product_image",
    productImageUrl: null,
    secondaryImageUrl: null,
    onScreenText,
    soundEffectLabel: "",
    musicIntensityLabel: "",
    safeAreaNote: "",
    voiceOverLine: "",
    runwayPrompt: "",
    motionEffect: "ken_burns"
  };
}

describe("flagUnsupportedClaims", () => {
  it("flags an unsupported claim like 'non-toxic' when absent from the source description/tags", () => {
    const flags = flagUnsupportedClaims(product(), [scene("100% non-toxic and safe for kids")]);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.some(f => f.matchedTerm === "non-toxic")).toBe(true);
  });

  it("does not flag a claim that is verbatim present in the product description", () => {
    const p = product({ description: "A soft, non-toxic blanket for kids." });
    const flags = flagUnsupportedClaims(p, [scene("This blanket is non-toxic.")]);
    expect(flags.some(f => f.matchedTerm === "non-toxic")).toBe(false);
  });

  it("does not flag plain, unremarkable text", () => {
    const flags = flagUnsupportedClaims(product(), [scene("Perfect for road trips")]);
    expect(flags.length).toBe(0);
  });
});

describe("shouldShowAffiliateDisclosure / buildProductFactReview", () => {
  it("shows the disclosure when is_affiliate is true", () => {
    expect(shouldShowAffiliateDisclosure({ isAffiliate: true })).toBe(true);
    const review = buildProductFactReview(product({ isAffiliate: true, retailerName: "Walmart" }), []);
    expect(review.isAffiliate).toBe(true);
  });

  it("hides the disclosure when is_affiliate is false", () => {
    expect(shouldShowAffiliateDisclosure({ isAffiliate: false })).toBe(false);
    const review = buildProductFactReview(product({ isAffiliate: false }), []);
    expect(review.isAffiliate).toBe(false);
  });
});
