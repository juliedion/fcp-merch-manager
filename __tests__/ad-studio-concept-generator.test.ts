import { describe, expect, it } from "vitest";
import { generateAdConcepts } from "@/lib/ad-studio-concept-generator";
import { AdProductSnapshot } from "@/lib/ad-studio-types";

function baseProduct(overrides: Partial<AdProductSnapshot> = {}): AdProductSnapshot {
  return {
    source: "mavely",
    sourceId: "test-1",
    title: "DIY Coloring Blanket",
    description: "A soft blanket kids can color with fabric markers, great for road trips.",
    images: ["https://example.com/1.jpg"],
    price: 29.99,
    compareAtPrice: 39.99,
    vendor: "Fort Crazypants",
    productType: "Kids Activities",
    tags: ["kids", "travel", "coloring", "car ride"],
    collections: ["Kids"],
    handle: "diy-coloring-blanket",
    productUrl: "https://example.com/diy-coloring-blanket",
    isAffiliate: true,
    affiliateUrl: "https://mavely.app/xyz",
    retailerName: "Walmart",
    benefits: ["Reusable fabric markers included", "Machine washable"],
    seoDescription: "",
    ...overrides
  };
}

describe("generateAdConcepts", () => {
  it("returns at least 5 distinct concepts", () => {
    const concepts = generateAdConcepts(baseProduct(), "Parents", 1);
    expect(concepts.length).toBeGreaterThanOrEqual(5);
    const types = new Set(concepts.map(c => c.conceptType));
    expect(types.size).toBe(concepts.length);
  });

  it("includes a travel-themed (Road-trip/travel use case) concept for a kids/travel product", () => {
    const concepts = generateAdConcepts(baseProduct(), "Parents", 1);
    const travelConcept = concepts.find(c => c.conceptType === "Road-trip/travel use case");
    expect(travelConcept).toBeDefined();
    expect(travelConcept?.title.toLowerCase()).toContain("road trip");
  });

  it("does not force a travel concept for an unrelated product", () => {
    const productPlaceholder = baseProduct({
      title: "Ceramic Coffee Mug",
      description: "A simple ceramic mug for your morning coffee.",
      tags: ["kitchen", "coffee", "gift"],
      productType: "Drinkware"
    });
    const concepts = generateAdConcepts(productPlaceholder, "Gift shoppers", 1);
    expect(concepts.length).toBeGreaterThanOrEqual(5);
    // Not asserting absence strictly (shuffle could still include it), but the vast
    // majority of runs across different seeds should not force it to the front.
    expect(concepts[0].conceptType).not.toBe("Road-trip/travel use case");
  });

  it("never phrases outcomes as causing sleep (no causal/medical claims)", () => {
    const concepts = generateAdConcepts(baseProduct(), "Parents", 1);
    const allText = concepts.map(c => `${c.title} ${c.coreProblem} ${c.productSolution} ${c.openingHook} ${c.closingCta}`).join(" ").toLowerCase();
    expect(allText).not.toMatch(/makes? (kids|children|them) (fall asleep|sleep)/);
    expect(allText).not.toMatch(/causes? .*sleep/);
  });

  it("is deterministic for the same seed and varies with a different seed", () => {
    const a = generateAdConcepts(baseProduct(), "Parents", 5);
    const b = generateAdConcepts(baseProduct(), "Parents", 5);
    expect(a.map(c => c.conceptType)).toEqual(b.map(c => c.conceptType));

    const c = generateAdConcepts(baseProduct(), "Parents", 42);
    expect(c.map(c2 => c2.conceptType)).not.toEqual(a.map(c2 => c2.conceptType));
  });
});
