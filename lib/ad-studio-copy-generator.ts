import { AdConcept, AdProductSnapshot, AdScene, GeneratedCopy } from "./ad-studio-types";

/** Deterministic, template-based copy generator (Phase 1 subset). No external AI call. */

const HOOK_TEMPLATES = [
  (t: string) => `Still dealing with this every single day?`,
  (t: string) => `Wait, why didn't I know about ${t} sooner?`,
  (t: string) => `POV: you finally found ${t}.`,
  (t: string) => `This changed how we do things around here.`,
  (t: string) => `Okay, ${t} is actually worth the hype.`,
  (t: string) => `I wasn't expecting to love this as much as I do.`,
  (t: string) => `If you know, you know.`,
  (t: string) => `Here's the thing nobody tells you about ${t}.`,
  (t: string) => `3 seconds in and I was sold.`,
  (t: string) => `This is your sign to finally try ${t}.`
];

export function generateOpeningHooks(product: AdProductSnapshot): string[] {
  const t = product.title || "this";
  return HOOK_TEMPLATES.map(fn => fn(t));
}

function currency(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function generateAdCopy(product: AdProductSnapshot, concept: AdConcept, scenes: AdScene[]): GeneratedCopy {
  const title = product.title || "this product";
  const openingHooks = generateOpeningHooks(product);
  const onScreenTextSuggestions = scenes.map(s => s.onScreenText).filter(Boolean);
  const benefitCallouts = product.benefits.length ? product.benefits : [`Made for ${concept.targetAudience || "everyday life"}`, "Simple to use", "Worth adding to your cart"];
  const ctaOptions = [concept.closingCta, `Shop ${title} now`, "Get yours today", "Tap to shop", "Add to cart before it sells out"];

  const priceLine = product.price ? ` Just ${currency(product.price)}${product.compareAtPrice && product.compareAtPrice > product.price ? ` (was ${currency(product.compareAtPrice)})` : ""}.` : "";
  const disclosure = product.isAffiliate ? " Fort Crazypants may earn a commission from qualifying purchases." : "";

  const hashtags = Array.from(
    new Set([
      "#fortcrazypants",
      `#${(product.productType || "musthave").toLowerCase().replace(/[^a-z0-9]+/g, "")}`,
      ...product.tags.slice(0, 6).map(t => `#${t.toLowerCase().replace(/[^a-z0-9]+/g, "")}`),
      `#${(concept.conceptType || "").toLowerCase().replace(/[^a-z0-9]+/g, "")}`
    ])
  ).filter(h => h.length > 1);

  return {
    openingHooks,
    onScreenTextSuggestions,
    benefitCallouts,
    ctaOptions,
    tiktokCaption: `${concept.openingHook} ${title} is a total game changer.${priceLine}${disclosure} ${hashtags.slice(0, 5).join(" ")}`,
    instagramCaption: `${concept.openingHook}\n\n${title} — ${concept.productSolution}${priceLine}${disclosure}\n\n${hashtags.slice(0, 8).join(" ")}`,
    facebookCaption: `${concept.openingHook} ${concept.productSolution}${priceLine}${disclosure}`,
    youtubeShortsTitle: `${title} — ${concept.title} #Shorts`,
    pinterestTitle: `${title} | ${concept.title}`,
    pinterestDescription: `${concept.productSolution} ${benefitCallouts.slice(0, 3).join(" • ")}`,
    hashtags,
    thumbnailText: concept.openingHook.slice(0, 40),
    productPageVideoTitle: `See ${title} in Action`,
    accessibilityAltText: `Short vertical video ad showing ${title} being used, with on-screen text and a call to action to shop now.`,
    voiceOverScript: scenes.map((s, i) => `Scene ${i + 1} (${s.durationSeconds}s): ${s.voiceOverLine || s.onScreenText}`).join("\n")
  };
}
