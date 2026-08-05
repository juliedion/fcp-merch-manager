import { MavelyProductInput } from "./mavely-types";

/**
 * Deterministic, template-based description generator for affiliate products.
 * Produces original copy from the entered fields only — never copies retailer
 * description text verbatim, and avoids unsupported superlatives unless the
 * input itself explicitly contains them. Mirrors the style of lib/generator.ts.
 */

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] || trimmed).trim();
}

function splitFeatures(source: string): string[] {
  return source
    .split(/[\n,;]/)
    .map(v => v.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export type GeneratedDescriptionSections = {
  intro: string;
  whyWeLoveIt: string;
  keyFeatures: string[];
  greatFor: string;
  thingsToKnow: string;
  retailerDisclosure: string;
};

export function generateMavelyDescription(
  input: Pick<MavelyProductInput, "title" | "shortSummary" | "retailerName" | "category" | "tags"> & { featuresText?: string }
): GeneratedDescriptionSections {
  const title = input.title.trim() || "This find";
  const retailer = input.retailerName.trim() || "the retailer";
  const category = input.category.trim();
  const summary = firstSentence(input.shortSummary || "");
  const features = splitFeatures(input.featuresText || input.shortSummary || "");

  const intro = summary
    ? `${title} — ${summary}`
    : `${title} is a practical pick worth a closer look${category ? ` in the ${category} category` : ""}.`;

  const whyWeLoveIt = `We like ${title} because it does what it says without a lot of extra fuss${
    features.length ? `, especially ${features[0].toLowerCase()}` : ""
  }. It's the kind of item that earns its spot once you've actually used it.`;

  const keyFeatures = features.length
    ? features
    : [
        `Sourced directly from ${retailer}`,
        category ? `Fits well within ${category}` : "Useful for everyday needs",
        "Straightforward to use out of the box"
      ];

  const greatFor = `Great for anyone looking for a practical ${category ? category.toLowerCase() + " " : ""}option without overthinking the decision.`;

  const thingsToKnow = `Pricing and availability are set by ${retailer} and can change at any time. This is an affiliate listing — clicking the button below takes you to ${retailer} to complete your purchase.`;

  const retailerDisclosure = `Fort Crazypants may earn a commission when you purchase through links on this page, at no additional cost to you. Prices and availability are determined by the retailer and may change.`;

  return { intro, whyWeLoveIt, keyFeatures, greatFor, thingsToKnow, retailerDisclosure };
}

export function sectionsToHtml(sections: GeneratedDescriptionSections): string {
  return [
    `<p>${sections.intro}</p>`,
    `<h3>Why We Love It</h3><p>${sections.whyWeLoveIt}</p>`,
    `<h3>Key Features</h3><ul>${sections.keyFeatures.map(f => `<li>${f}</li>`).join("")}</ul>`,
    `<h3>Great For</h3><p>${sections.greatFor}</p>`,
    `<h3>Things to Know</h3><p>${sections.thingsToKnow}</p>`,
    `<p><em>${sections.retailerDisclosure}</em></p>`
  ].join("");
}
