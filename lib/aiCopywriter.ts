import { CURATED_COLLECTIONS, CuratedCollection, GeneratedProduct, ImagePromptKey, ProductInput } from "./types";

export function isAiCopyEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export type AiCopyOverrides = {
  descriptionHtml?: string;
  tags?: string[];
  collections?: CuratedCollection[];
  imagePrompts?: Partial<Record<ImagePromptKey, string>>;
};

const IMAGE_PROMPT_KEYS: ImagePromptKey[] = [
  "lifestyle", "whiteBackground", "pinterestPin", "instagramSquare",
  "instagramStory", "heroBanner", "websiteThumbnail", "holiday", "family"
];

const SYSTEM_PROMPT = `You are an ecommerce copywriter for Fort Crazypants, a practical, family-friendly product review and merchandising brand.

Write original, concise, honest copy based ONLY on the product facts given to you. Never invent specifications, materials, certifications, ages, dimensions, or safety claims that aren't in the provided facts. Never use fake urgency ("only X left!", "selling fast") or fabricated testimonials/reviews. Avoid unsupported superlatives ("the best", "guaranteed to") unless the facts explicitly support them.

Respond with ONLY a single JSON object, no markdown fences, no commentary, matching this exact shape:
{
  "descriptionHtml": "string of simple HTML using <h2>, <p>, <ul><li> tags — a well-written, benefit-focused product description, 2-4 short paragraphs plus a bullet list",
  "tags": ["5 to 8 short, relevant, specific product tags — no generic filler tags"],
  "collections": ["choose 1-3 from this fixed list, only ones that genuinely fit: ${CURATED_COLLECTIONS.join(", ")}"],
  "imagePrompts": {
    "lifestyle": "rewritten AI image-generation prompt for a lifestyle photo of this specific product",
    "whiteBackground": "rewritten prompt for a white-background studio product photo",
    "pinterestPin": "rewritten prompt for a vertical Pinterest pin photo",
    "instagramSquare": "rewritten prompt for a square Instagram feed photo",
    "instagramStory": "rewritten prompt for a vertical Instagram Story photo",
    "heroBanner": "rewritten prompt for a wide website hero banner photo",
    "websiteThumbnail": "rewritten prompt for a small product grid thumbnail photo",
    "holiday": "rewritten prompt for a festive holiday-themed version of the photo",
    "family": "rewritten prompt for a family/group lifestyle photo using the product"
  }
}

Each image prompt should be one detailed sentence describing composition, lighting, and setting appropriate to that format, grounded in the actual product's real title and features — not generic. Keep the same photorealistic, professional-product-photography intent as the facts imply.`;

function buildUserPrompt(input: ProductInput, deterministic: GeneratedProduct): string {
  const facts = {
    title: deterministic.title,
    category: input.category,
    audience: input.audience,
    problemItSolves: input.problem,
    features: input.features,
    price: input.price,
    productType: input.productType,
    existingBullets: deterministic.bullets,
    existingBenefits: deterministic.benefits
  };
  return `Product facts (use only these — do not add anything not implied here):\n${JSON.stringify(facts, null, 2)}`;
}

// Calls OpenAI directly via fetch rather than adding the SDK as a dependency — matches this
// codebase's existing pattern of plain fetch() calls to external APIs (see lib/scrape.ts,
// shopify routes) instead of pulling in provider SDKs for a single call site.
export async function generateAICopy(input: ProductInput, deterministic: GeneratedProduct): Promise<AiCopyOverrides | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0.7,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(input, deterministic) }
          ]
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.error("[ai-copy] OpenAI request failed", response.status, await response.text().catch(() => ""));
      return null;
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return null;

    const parsed = JSON.parse(raw);
    return sanitizeAiCopy(parsed);
  } catch (error) {
    console.error("[ai-copy] generation failed", error instanceof Error ? error.message : error);
    return null;
  }
}

function sanitizeAiCopy(parsed: unknown): AiCopyOverrides | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  const overrides: AiCopyOverrides = {};

  if (typeof p.descriptionHtml === "string" && p.descriptionHtml.trim().includes("<")) {
    overrides.descriptionHtml = p.descriptionHtml.trim();
  }

  if (Array.isArray(p.tags)) {
    const tags = Array.from(new Set(p.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map(t => t.trim()))).slice(0, 10);
    if (tags.length) overrides.tags = tags;
  }

  if (Array.isArray(p.collections)) {
    const collections = Array.from(new Set(p.collections.filter((c): c is CuratedCollection =>
      typeof c === "string" && (CURATED_COLLECTIONS as readonly string[]).includes(c)
    )));
    if (collections.length) overrides.collections = collections;
  }

  if (p.imagePrompts && typeof p.imagePrompts === "object") {
    const src = p.imagePrompts as Record<string, unknown>;
    const imagePrompts: Partial<Record<ImagePromptKey, string>> = {};
    for (const key of IMAGE_PROMPT_KEYS) {
      const value = src[key];
      if (typeof value === "string" && value.trim().length > 10) imagePrompts[key] = value.trim();
    }
    if (Object.keys(imagePrompts).length) overrides.imagePrompts = imagePrompts;
  }

  return Object.keys(overrides).length ? overrides : null;
}

// Merges AI overrides onto the deterministic result. Anything the AI didn't return (or that
// failed sanitization) silently keeps the deterministic value — the AI layer only ever
// improves fields, never removes or blanks them.
export function applyAiCopy(product: GeneratedProduct, overrides: AiCopyOverrides | null): GeneratedProduct {
  if (!overrides) return product;
  return {
    ...product,
    descriptionHtml: overrides.descriptionHtml ?? product.descriptionHtml,
    tags: overrides.tags ?? product.tags,
    collections: overrides.collections ?? product.collections,
    imagePrompts: overrides.imagePrompts
      ? product.imagePrompts.map(p => overrides.imagePrompts?.[p.key] ? { ...p, prompt: overrides.imagePrompts[p.key]! } : p)
      : product.imagePrompts
  };
}
