import { describe, expect, it } from "vitest";
import { generateStoryboard } from "@/lib/ad-studio-storyboard-generator";
import { generateAdConcepts } from "@/lib/ad-studio-concept-generator";
import { AdProductSnapshot } from "@/lib/ad-studio-types";

function product(): AdProductSnapshot {
  return {
    source: "mavely",
    sourceId: "test-1",
    title: "DIY Coloring Blanket",
    description: "A soft blanket kids can color with fabric markers, great for road trips.",
    images: ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"],
    price: 29.99,
    compareAtPrice: 39.99,
    vendor: "Fort Crazypants",
    productType: "Kids Activities",
    tags: ["kids", "travel", "coloring"],
    collections: ["Kids"],
    handle: "diy-coloring-blanket",
    productUrl: "https://example.com/diy-coloring-blanket",
    isAffiliate: true,
    affiliateUrl: "https://mavely.app/xyz",
    retailerName: "Walmart",
    benefits: ["Reusable fabric markers included"],
    seoDescription: ""
  };
}

describe("generateStoryboard", () => {
  it("generates 5-8 scenes with duration summing close to the concept's recommended duration", () => {
    const p = product();
    const concepts = generateAdConcepts(p, "Parents", 1);
    const concept = concepts[0];
    const scenes = generateStoryboard(p, concept, 0);
    expect(scenes.length).toBeGreaterThanOrEqual(5);
    expect(scenes.length).toBeLessThanOrEqual(8);
    const total = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
    expect(Math.abs(total - concept.recommendedDurationSeconds)).toBeLessThan(1);
  });

  it("produces the 6-scene Road Trip Rescue shape for a road-trip concept", () => {
    const p = product();
    const concept = generateAdConcepts(p, "Parents", 1).find(c => c.conceptType === "Road-trip/travel use case")!;
    expect(concept).toBeDefined();
    const scenes = generateStoryboard(p, concept, 0);
    expect(scenes.length).toBe(6);
    expect(scenes[0].purpose.toLowerCase()).toContain("bored");
    expect(scenes[scenes.length - 1].purpose.toLowerCase()).toContain("cta");
    // At least 5 of 6 scenes should have a still-image motion effect (not "none").
    const motionScenes = scenes.filter(s => s.motionEffect !== "none");
    expect(motionScenes.length).toBeGreaterThanOrEqual(5);
    // "resting" phrasing, not a causal sleep claim.
    const restingScene = scenes.find(s => s.purpose.toLowerCase().includes("resting"));
    expect(restingScene).toBeDefined();
    expect(restingScene!.onScreenText.toLowerCase()).not.toMatch(/asleep|causes.*sleep/);
  });
});
