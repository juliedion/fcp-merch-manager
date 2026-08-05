import { AdConcept, AdProductSnapshot, ConceptType } from "./ad-studio-types";

/**
 * Deterministic, template-based ad concept generator. Mirrors the pattern in
 * lib/mavely-generator.ts and lib/generator.ts: plain TS functions, no external AI
 * API call. Given the same product + audience + seed, output is stable; changing the
 * seed ("regenerate") reorders/varies which concept types are picked and phrasing.
 *
 * Language guardrail: concepts must never claim the product *causes* an outcome
 * (e.g. "makes kids fall asleep"). Outcome language stays observational/atmospheric
 * ("a peaceful, quiet stretch of the drive"), never causal or medical.
 */

function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed || 1;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const TRAVEL_TAGS = ["travel", "road trip", "roadtrip", "car", "car seat", "kids", "toddler", "children", "family", "coloring", "blanket", "activity"];

function isTravelRelevant(product: AdProductSnapshot, audience: string): boolean {
  const haystack = `${product.title} ${product.description} ${product.productType} ${product.tags.join(" ")} ${audience}`.toLowerCase();
  const kidsSignal = /kid|child|toddler|family|parent/i.test(haystack);
  const travelSignal = /travel|road trip|roadtrip|car ride|car seat|vacation|airplane|flight/i.test(haystack);
  const activitySignal = /coloring|blanket|activity|quiet|busy bag|screen-free|screen free/i.test(haystack);
  return (kidsSignal && (travelSignal || activitySignal)) || TRAVEL_TAGS.some(t => haystack.includes(t));
}

function firstBenefit(product: AdProductSnapshot, fallback: string): string {
  return product.benefits[0] || fallback;
}

function buildConcept(type: ConceptType, product: AdProductSnapshot, audience: string): AdConcept {
  const title = product.title || "this product";
  const benefit = firstBenefit(product, "a genuinely useful little upgrade");
  const audienceLabel = audience || "shoppers";

  const templates: Record<ConceptType, Omit<AdConcept, "id" | "conceptType" | "estimatedRunwayUsage" | "estimatedRenderingCost">> = {
    "Problem and solution": {
      title: `The ${title} Fix`,
      targetAudience: audienceLabel,
      coreProblem: `${audienceLabel} keep running into the same small daily frustration this solves.`,
      productSolution: `${title} solves it directly — ${benefit}.`,
      emotionalAngle: "Relief",
      openingHook: `Still dealing with this every single day?`,
      closingCta: `Fix it today — grab the ${title}.`,
      recommendedDurationSeconds: 20,
      requiredMedia: ["Product hero shot", "Lifestyle/in-use shot", "Close-up detail shot"]
    },
    "Before and after": {
      title: `${title}: Before & After`,
      targetAudience: audienceLabel,
      coreProblem: "The 'before' state is cluttered, chaotic, or just not working.",
      productSolution: `After ${title}, the same moment looks calm and handled.`,
      emotionalAngle: "Satisfaction",
      openingHook: `Before vs. after — this one's not even close.`,
      closingCta: `See the difference for yourself.`,
      recommendedDurationSeconds: 18,
      requiredMedia: ["Before scene", "After scene", "Product hero shot"]
    },
    "Product demonstration": {
      title: `How ${title} Actually Works`,
      targetAudience: audienceLabel,
      coreProblem: `${audienceLabel} aren't sure this would really work for them.`,
      productSolution: `A quick, honest look at ${title} in action.`,
      emotionalAngle: "Confidence",
      openingHook: `Here's exactly how it works.`,
      closingCta: `Try it yourself — link below.`,
      recommendedDurationSeconds: 22,
      requiredMedia: ["Step-by-step in-use shots", "Product close-up"]
    },
    "Relatable parent moment": {
      title: `Every Parent Knows This Moment`,
      targetAudience: audienceLabel || "Parents",
      coreProblem: "A universally relatable parenting moment — chaos, noise, or a meltdown brewing.",
      productSolution: `${title} turns that moment around — ${benefit}.`,
      emotionalAngle: "Warmth and recognition",
      openingHook: `If you're a parent, you already know this feeling.`,
      closingCta: `Every parent needs one of these.`,
      recommendedDurationSeconds: 20,
      requiredMedia: ["Relatable chaos moment", "Product reveal", "Resolution shot"]
    },
    "Story-based commercial": {
      title: `A Little Story About ${title}`,
      targetAudience: audienceLabel,
      coreProblem: "A short story arc: setup, tension, resolution.",
      productSolution: `${title} is the turning point in the story.`,
      emotionalAngle: "Narrative payoff",
      openingHook: `It started like any other day...`,
      closingCta: `Start your own story with ${title}.`,
      recommendedDurationSeconds: 25,
      requiredMedia: ["Opening scene", "Turning-point product shot", "Closing scene"]
    },
    "Gift idea": {
      title: `The Gift They'll Actually Use`,
      targetAudience: audienceLabel || "Gift shoppers",
      coreProblem: "Finding a gift that isn't clutter and actually gets used.",
      productSolution: `${title} is the rare gift that earns its keep.`,
      emotionalAngle: "Delight",
      openingHook: `Stuck on what to get them?`,
      closingCta: `The gift that doesn't end up in a drawer.`,
      recommendedDurationSeconds: 18,
      requiredMedia: ["Gift unboxing/reveal shot", "In-use shot", "Product hero shot"]
    },
    "Product discovery": {
      title: `Wait, This Exists?`,
      targetAudience: audienceLabel,
      coreProblem: "Most people have never even heard of a product like this.",
      productSolution: `${title} — a small discovery that makes a real difference.`,
      emotionalAngle: "Curiosity",
      openingHook: `I didn't know this was a thing until now.`,
      closingCta: `Now you know too — check it out.`,
      recommendedDurationSeconds: 16,
      requiredMedia: ["Intriguing close-up", "Reveal shot", "Product hero shot"]
    },
    "I didn't know I needed this": {
      title: `I Didn't Know I Needed This`,
      targetAudience: audienceLabel,
      coreProblem: "Life felt fine without it — until you saw what it actually fixes.",
      productSolution: `${title} quietly becomes something you can't imagine going without.`,
      emotionalAngle: "Surprise",
      openingHook: `I genuinely didn't think I needed this... until I tried it.`,
      closingCta: `Find out for yourself.`,
      recommendedDurationSeconds: 18,
      requiredMedia: ["Skeptical opening shot", "Product in use", "Satisfied closing shot"]
    },
    "List of benefits": {
      title: `3 Reasons ${title} Is Worth It`,
      targetAudience: audienceLabel,
      coreProblem: "Shoppers want the quick-hit reasons before they commit to buying.",
      productSolution: `${title} delivers on all of them — starting with ${benefit}.`,
      emotionalAngle: "Practicality",
      openingHook: `3 reasons this is worth it.`,
      closingCta: `Get all the benefits — shop now.`,
      recommendedDurationSeconds: 20,
      requiredMedia: ["Product hero shot", "Benefit close-up 1", "Benefit close-up 2", "Benefit close-up 3"]
    },
    "Customer-style testimonial": {
      title: `"Wish I'd Found This Sooner"`,
      targetAudience: audienceLabel,
      coreProblem: "Real shoppers were skeptical until they tried it.",
      productSolution: `${title} won them over — ${benefit}.`,
      emotionalAngle: "Trust",
      openingHook: `Wish I'd found this sooner.`,
      closingCta: `See what everyone's talking about.`,
      recommendedDurationSeconds: 20,
      requiredMedia: ["Testimonial-style talking shot placeholder", "Product in use", "Product hero shot"]
    },
    "Seasonal use case": {
      title: `${title} for the Season Ahead`,
      targetAudience: audienceLabel,
      coreProblem: "This time of year brings its own specific hassle.",
      productSolution: `${title} is built for exactly this stretch of the year.`,
      emotionalAngle: "Timeliness",
      openingHook: `This season, make it easier on yourself.`,
      closingCta: `Get ready for the season with ${title}.`,
      recommendedDurationSeconds: 18,
      requiredMedia: ["Seasonal context shot", "Product in use", "Product hero shot"]
    },
    "Road-trip/travel use case": {
      title: `Road Trip Rescue`,
      targetAudience: audienceLabel || "Parents",
      coreProblem: "Long car rides get restless fast, especially for kids stuck in the back seat.",
      productSolution: `${title} turns dead time in the car into a calm, engaged stretch of the drive — ${benefit}.`,
      emotionalAngle: "Relief and peace of mind",
      openingHook: `Every parent knows this look 20 minutes into a road trip.`,
      closingCta: `Make your next road trip easier — grab the ${title}.`,
      recommendedDurationSeconds: 20,
      requiredMedia: ["Bored kids in car", "Product reveal", "Kids engaged with product", "Product close-up", "Peaceful resting scene", "Product hero + CTA"]
    },
    "Screen-free family activity": {
      title: `Screen-Free and They Loved It`,
      targetAudience: audienceLabel || "Parents",
      coreProblem: "Screens are the default the moment kids get bored, and it's hard to break.",
      productSolution: `${title} gives kids something hands-on instead — ${benefit}.`,
      emotionalAngle: "Pride",
      openingHook: `No screen. No meltdown. Just this.`,
      closingCta: `Try a screen-free win — shop ${title}.`,
      recommendedDurationSeconds: 20,
      requiredMedia: ["Kids engaged without a screen", "Product in use", "Product hero shot"]
    },
    "Cozy lifestyle": {
      title: `A Cozier Way to ${title.split(" ").slice(0, 3).join(" ")}`,
      targetAudience: audienceLabel,
      coreProblem: "The everyday version of this moment feels rushed or uninspired.",
      productSolution: `${title} makes it feel intentional and cozy instead.`,
      emotionalAngle: "Comfort",
      openingHook: `Slow down. Get cozy. Enjoy this.`,
      closingCta: `Make it cozier — shop ${title}.`,
      recommendedDurationSeconds: 18,
      requiredMedia: ["Cozy lifestyle wide shot", "Product close-up", "Product hero shot"]
    },
    "Humorous version": {
      title: `We're Not Being Dramatic, ${title} Is Just Great`,
      targetAudience: audienceLabel,
      coreProblem: "The problem is real but can be poked fun at.",
      productSolution: `${title} solves it in a way that's honestly kind of funny how simple it is.`,
      emotionalAngle: "Humor",
      openingHook: `Okay, we're not being dramatic here...`,
      closingCta: `Just trust us on this one.`,
      recommendedDurationSeconds: 16,
      requiredMedia: ["Comedic setup shot", "Product reveal", "Product hero shot"]
    }
  };

  const t = templates[type];
  return {
    id: `concept-${simpleHash(type + title + audienceLabel)}`,
    conceptType: type,
    ...t,
    estimatedRunwayUsage: "None (Phase 1)",
    estimatedRenderingCost: "$0 — local render"
  };
}

const CONCEPT_TYPES_ORDER: ConceptType[] = [
  "Problem and solution",
  "Before and after",
  "Product demonstration",
  "Relatable parent moment",
  "Story-based commercial",
  "Gift idea",
  "Product discovery",
  "I didn't know I needed this",
  "List of benefits",
  "Customer-style testimonial",
  "Seasonal use case",
  "Road-trip/travel use case",
  "Screen-free family activity",
  "Cozy lifestyle",
  "Humorous version"
];

/**
 * Generates at least 5 distinct ad concepts for a product/audience combo.
 * If the product looks kids + travel/activity relevant, "Road-trip/travel use case"
 * is guaranteed to be included (this is what makes "Road Trip Rescue" reachable for
 * any similar product, not just a single hardcoded one).
 */
export function generateAdConcepts(product: AdProductSnapshot, audience: string, seed = 0, count = 5): AdConcept[] {
  const baseSeed = seed || simpleHash(product.title + audience);
  const travelRelevant = isTravelRelevant(product, audience);

  let order = seededShuffle(CONCEPT_TYPES_ORDER, baseSeed);

  if (travelRelevant) {
    order = order.filter(t => t !== "Road-trip/travel use case");
    order.unshift("Road-trip/travel use case");
  }

  const selectedTypes = order.slice(0, Math.max(5, count));
  return selectedTypes.map(type => buildConcept(type, product, audience));
}
