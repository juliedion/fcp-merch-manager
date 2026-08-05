import { AdConcept, AdProductSnapshot, AdScene, MotionEffect, SceneSource } from "./ad-studio-types";

/**
 * Deterministic, template-based storyboard (scene) generator. Given a chosen concept
 * and product, produces 5-8 scenes whose durations sum to roughly the concept's
 * recommended duration. No external AI call — same pattern as the concept generator.
 */

const MOTION_ROTATION: MotionEffect[] = ["push_in", "pan_left", "ken_burns", "pan_right", "product_spotlight", "pull_out", "masked_zoom", "slight_rotation"];

function pickImage(images: string[], index: number): string | null {
  if (!images.length) return null;
  return images[index % images.length];
}

type SceneTemplate = {
  purpose: string;
  visualDescription: string;
  recommendedSource: SceneSource;
  onScreenText: (product: AdProductSnapshot, concept: AdConcept) => string;
  soundEffectLabel: string;
  musicIntensityLabel: string;
  voiceOverLine?: (product: AdProductSnapshot, concept: AdConcept) => string;
};

const GENERIC_TEMPLATES: SceneTemplate[] = [
  {
    purpose: "Hook",
    visualDescription: "Attention-grabbing opening frame that sets up the problem or moment.",
    recommendedSource: "title_card",
    onScreenText: (_p, c) => c.openingHook,
    soundEffectLabel: "Soft attention chime (label only, Phase 1)",
    musicIntensityLabel: "Building",
    voiceOverLine: (_p, c) => c.openingHook
  },
  {
    purpose: "Problem / context",
    visualDescription: "Shows the everyday frustration or context this product addresses.",
    recommendedSource: "product_image",
    onScreenText: (_p, c) => c.coreProblem,
    soundEffectLabel: "Ambient room tone (label only)",
    musicIntensityLabel: "Low",
    voiceOverLine: (_p, c) => c.coreProblem
  },
  {
    purpose: "Product reveal",
    visualDescription: "Clean hero shot introducing the product as the solution.",
    recommendedSource: "product_image",
    onScreenText: p => p.title,
    soundEffectLabel: "Reveal whoosh (label only)",
    musicIntensityLabel: "Rising",
    voiceOverLine: (_p, c) => c.productSolution
  },
  {
    purpose: "Product in use",
    visualDescription: "Product being used in the relevant real-world scenario.",
    recommendedSource: "product_image",
    onScreenText: p => (p.benefits[0] ? p.benefits[0] : "See it in action"),
    soundEffectLabel: "Light upbeat cue (label only)",
    musicIntensityLabel: "Medium"
  },
  {
    purpose: "Detail / close-up",
    visualDescription: "Close-up of a key feature or detail that builds credibility.",
    recommendedSource: "product_image",
    onScreenText: p => (p.benefits[1] || p.benefits[0] || "Thoughtfully made"),
    soundEffectLabel: "Subtle detail cue (label only)",
    musicIntensityLabel: "Medium"
  },
  {
    purpose: "Emotional payoff",
    visualDescription: "A calm, resolved moment that lands the emotional angle of the concept.",
    recommendedSource: "ai_lifestyle_placeholder",
    onScreenText: (_p, c) => `A ${c.emotionalAngle.toLowerCase()} moment`,
    soundEffectLabel: "Warm resolve cue (label only)",
    musicIntensityLabel: "Gentle"
  },
  {
    purpose: "Benefit recap",
    visualDescription: "Quick recap of 1-2 more benefits as supporting proof.",
    recommendedSource: "product_image",
    onScreenText: p => (p.benefits[2] || p.benefits[0] || "Worth every penny"),
    soundEffectLabel: "Light tick cue (label only)",
    musicIntensityLabel: "Medium"
  },
  {
    purpose: "CTA",
    visualDescription: "Branded call-to-action card with logo, price, and CTA button text.",
    recommendedSource: "cta_card",
    onScreenText: (_p, c) => c.closingCta,
    soundEffectLabel: "Confident closing sting (label only)",
    musicIntensityLabel: "Peak",
    voiceOverLine: (_p, c) => c.closingCta
  }
];

// Special-cased ordering for the Road-trip/travel concept, matching the spec's
// literal 6-scene test project shape (bored kids -> reveal -> engaged -> close-up ->
// resting -> hero+CTA). Reused for any concept of this type, not just one product.
const ROAD_TRIP_TEMPLATES: SceneTemplate[] = [
  {
    purpose: "Bored kids in car",
    visualDescription: "Kids restless and bored in the back seat of the car, long stretch of road ahead.",
    recommendedSource: "ai_lifestyle_placeholder",
    onScreenText: (_p, c) => c.openingHook,
    soundEffectLabel: "Restless car ambience (label only)",
    musicIntensityLabel: "Low",
    voiceOverLine: (_p, c) => c.openingHook
  },
  {
    purpose: "Parent reveals the product",
    visualDescription: "Parent hands the product back to the kids from the front seat.",
    recommendedSource: "product_image",
    onScreenText: p => p.title,
    soundEffectLabel: "Gentle reveal cue (label only)",
    musicIntensityLabel: "Rising"
  },
  {
    purpose: "Kids engaged with the product",
    visualDescription: "Kids happily using the product together in the back seat.",
    recommendedSource: "product_image",
    onScreenText: p => (p.benefits[0] || "Keeps little hands busy"),
    soundEffectLabel: "Upbeat cue (label only)",
    musicIntensityLabel: "Medium"
  },
  {
    purpose: "Product / artwork close-up",
    visualDescription: "Close-up on the product detail or the kids' finished artwork/result.",
    recommendedSource: "product_image",
    onScreenText: p => (p.benefits[1] || p.benefits[0] || "Made for the road"),
    soundEffectLabel: "Detail cue (label only)",
    musicIntensityLabel: "Medium"
  },
  {
    purpose: "Peaceful resting scene",
    visualDescription: "Kids resting quietly under/with the finished product — a calm, peaceful stretch of the drive. Phrased as resting, not as the product causing sleep.",
    recommendedSource: "ai_lifestyle_placeholder",
    onScreenText: () => "A peaceful stretch of the drive",
    soundEffectLabel: "Soft calm cue (label only)",
    musicIntensityLabel: "Gentle"
  },
  {
    purpose: "Product hero + CTA",
    visualDescription: "Branded hero shot of the product with CTA and price.",
    recommendedSource: "cta_card",
    onScreenText: (_p, c) => c.closingCta,
    soundEffectLabel: "Confident closing sting (label only)",
    musicIntensityLabel: "Peak",
    voiceOverLine: (_p, c) => c.closingCta
  }
];

function templatesForConcept(concept: AdConcept): SceneTemplate[] {
  if (concept.conceptType === "Road-trip/travel use case") return ROAD_TRIP_TEMPLATES;
  return GENERIC_TEMPLATES;
}

/** Generates 5-8 scenes for the chosen concept, timing summed to ~= recommendedDurationSeconds. */
export function generateStoryboard(product: AdProductSnapshot, concept: AdConcept, seed = 0): AdScene[] {
  const templates = templatesForConcept(concept);
  const sceneCount = Math.max(5, Math.min(8, templates.length));
  const chosen = templates.slice(0, sceneCount);

  const totalDuration = Math.max(15, concept.recommendedDurationSeconds || 20);
  const baseDuration = Math.floor((totalDuration / chosen.length) * 10) / 10;
  // Distribute any rounding remainder onto the last scene so the sum matches closely.
  const durations = chosen.map(() => baseDuration);
  const remainder = Math.round((totalDuration - baseDuration * chosen.length) * 10) / 10;
  durations[durations.length - 1] = Math.round((durations[durations.length - 1] + remainder) * 10) / 10;

  return chosen.map((tpl, index) => {
    const isTitleOrCta = tpl.recommendedSource === "title_card" || tpl.recommendedSource === "cta_card";
    const motionEffect: MotionEffect = tpl.purpose === "Product hero + CTA" || tpl.purpose === "CTA" ? "product_spotlight" : MOTION_ROTATION[(index + seed) % MOTION_ROTATION.length];
    return {
      id: `scene-${index + 1}-${Math.abs(seed)}`,
      sceneNumber: index + 1,
      durationSeconds: durations[index],
      purpose: tpl.purpose,
      visualDescription: tpl.visualDescription,
      recommendedSource: tpl.recommendedSource,
      productImageUrl: isTitleOrCta ? null : pickImage(product.images, index),
      secondaryImageUrl: null,
      onScreenText: tpl.onScreenText(product, concept),
      soundEffectLabel: tpl.soundEffectLabel,
      musicIntensityLabel: tpl.musicIntensityLabel,
      safeAreaNote: "Keep key text within the center-safe 80% width; avoid the bottom 12% (platform UI) and top 8% (status bar/profile icon).",
      voiceOverLine: tpl.voiceOverLine ? tpl.voiceOverLine(product, concept) : "",
      runwayPrompt: "",
      motionEffect
    };
  });
}
