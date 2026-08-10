import { CURATED_COLLECTIONS, CuratedCollection, GeneratedProduct, ImagePromptKey, ProductInput } from "./types";

export function isAiCopyEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export type AiCopyOverrides = {
  descriptionHtml?: string;
  tags?: string[];
  collections?: CuratedCollection[];
  imagePrompts?: Partial<Record<ImagePromptKey, string>>;
  fcpVerdict?: string;
};

export type AiProductFacts = {
  problem?: string;
  features?: string;
  category?: string;
  audience?: string;
};

const IMAGE_PROMPT_KEYS: ImagePromptKey[] = [
  "lifestyle", "whiteBackground", "pinterestPin", "instagramSquare",
  "instagramStory", "heroBanner", "websiteThumbnail", "holiday", "family"
];

const SYSTEM_PROMPT = `You are an ecommerce copywriter for Fort Crazypants, a practical, family-friendly product review and merchandising brand.

Write original, concise, honest copy based ONLY on the product facts given to you. Never invent specifications, materials, certifications, ages, dimensions, or safety claims that aren't in the provided facts. Never use fake urgency ("only X left!", "selling fast") or fabricated testimonials/reviews. Avoid unsupported superlatives ("the best", "guaranteed to") unless the facts explicitly support them.

FORMATTING RULES (strict): every sentence ends with correct punctuation (period/exclamation/question mark) — no sentence fragments, no missing periods. Any list of 3+ related items (features, benefits, use cases) MUST be an actual <ul><li>...</li></ul> list, never comma/line-separated text inside a <p>. Never output a literal "\\n" newline character anywhere — paragraph breaks are separate <p> tags, not line breaks inside one.

The product facts include a "fortScore" (0-100) and "fortVerdict" — an internal QA label (e.g. "Strong test candidate", "Worth a small test") — that Fort Crazypants already computed from margin/demand/competition; the number is real, not invented. Close the description with a short paragraph written for the CUSTOMER, not as an internal QA note — translate the verdict into a genuine, warm recommendation in plain shopper language, mentioning the Fort Score number naturally but never using internal phrases like "test candidate" verbatim. Good: "<p><strong>Fort Crazypants verdict:</strong> This one's a genuine time-saver for busy families — it earned a Fort Score of 82/100 from us, and we think it's worth adding to your routine.</p>" Bad (too internal-sounding): "<p><strong>Fort Crazypants verdict:</strong> This earned a Fort Score of 82/100 — a strong test candidate.</p>"

The description must open with the exact heading "<h2>Why You'll Love It</h2>" — never the product's title or any other heading text.

Respond with ONLY a single JSON object, no markdown fences, no commentary, matching this exact shape:
{
  "descriptionHtml": "string of simple HTML starting with <h2>Why You'll Love It</h2> exactly, then <p>/<ul><li> tags per the formatting rules above — a well-written, benefit-focused product description, 2-4 short paragraphs plus a bullet list, ending with the customer-facing Fort Crazypants verdict paragraph described above",
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
  },
  "fcpVerdict": "one short, punchy, customer-facing sentence — see below"
}

Each image prompt should be one detailed sentence describing composition, lighting, and setting appropriate to that format, grounded in the actual product's real title and features — not generic. Keep the same photorealistic, professional-product-photography intent as the facts imply.

Also include a top-level "fcpVerdict" field: one short, punchy, customer-facing sentence (not HTML) — a standalone Fort Crazypants recommendation blurb shown near the buy button, e.g. "A genuinely useful pick for road-trip families — practical, well-made, and worth the price." Same rules apply: honest, grounded in the facts, no invented claims, may reference the Fort Score naturally but don't sound like an internal QA note.`;

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
    existingBenefits: deterministic.benefits,
    fortScore: deterministic.score,
    fortVerdict: deterministic.verdict,
    margin: deterministic.margin
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
    // Force the opening heading regardless of what the model actually returned — prompting
    // alone isn't reliable enough to guarantee exact text, and this heading is a fixed brand
    // element, not something that should vary per product.
    const withFixedHeading = p.descriptionHtml.trim().replace(/^\s*<h2>.*?<\/h2>/i, "<h2>Why You'll Love It</h2>");
    const withHeading = /^\s*<h2>/i.test(withFixedHeading) ? withFixedHeading : `<h2>Why You'll Love It</h2>${withFixedHeading}`;
    // Collapse any stray raw newlines the model emitted despite the formatting rules — a
    // literal "\n" inside HTML renders as a missing bullet/broken paragraph rather than an
    // actual line break, and shows up as an ugly visible break in this app's raw-source
    // preview. Prompting alone isn't reliable enough to guarantee this never happens.
    overrides.descriptionHtml = withHeading.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
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

  if (typeof p.fcpVerdict === "string" && p.fcpVerdict.trim().length > 10) {
    overrides.fcpVerdict = p.fcpVerdict.trim().replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ");
  }

  return Object.keys(overrides).length ? overrides : null;
}

const FACTS_SYSTEM_PROMPT = `You are an ecommerce copywriter for Fort Crazypants, a practical, family-friendly product review brand.

Rewrite the given product's "problem it solves", "features", "category", and "audience" into clean, well-written, honest copy. Use ONLY the facts given to you — do not invent specifications, materials, certifications, ages, dimensions, safety claims, or features not implied by the existing text. This is a rewrite/polish of existing facts, not new research.

"category" is a practical e-commerce product category (e.g. "Kitchen Gadgets", "Home Organization") — keep it concise and accurate, not creative marketing copy; only change it if the existing one is vague or generic and a more specific, still-accurate category is clearly implied by the product name/features.

Respond with ONLY a single JSON object, no markdown fences, no commentary:
{
  "problem": "one clear, honest sentence describing the everyday problem this solves for the target audience, grounded in the existing problem/title/category text",
  "features": "a clean, comma-separated list of the product's real standout features, grounded in the existing features text — rewritten for clarity, not invented",
  "category": "a concise, accurate e-commerce product category",
  "audience": "a clear, specific description of who this product is for, grounded in the existing audience text"
}`;

function buildFactsUserPrompt(input: ProductInput): string {
  const facts = {
    name: input.name,
    category: input.category,
    audience: input.audience,
    existingProblem: input.problem,
    existingFeatures: input.features
  };
  return `Product facts (use only these — do not add anything not implied here):\n${JSON.stringify(facts, null, 2)}`;
}

// Runs BEFORE generateProduct() — problem/features seed a large amount of deterministic copy
// (bullets, video scripts, social captions all interpolate these strings at generation time),
// so rewriting them after the fact (like descriptionHtml/tags) would leave that other copy
// referencing stale wording. Polishing them first keeps everything downstream consistent.
export async function generateAIProductFacts(input: ProductInput): Promise<AiProductFacts | null> {
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
          temperature: 0.6,
          messages: [
            { role: "system", content: FACTS_SYSTEM_PROMPT },
            { role: "user", content: buildFactsUserPrompt(input) }
          ]
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.error("[ai-copy] facts request failed", response.status, await response.text().catch(() => ""));
      return null;
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const facts: AiProductFacts = {};
    if (typeof parsed.problem === "string" && parsed.problem.trim().length > 5) {
      facts.problem = parsed.problem.trim().replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ");
    }
    if (typeof parsed.features === "string" && parsed.features.trim().length > 5) {
      facts.features = parsed.features.trim().replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ");
    }
    if (typeof parsed.category === "string" && parsed.category.trim().length > 2) {
      facts.category = parsed.category.trim().replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ");
    }
    if (typeof parsed.audience === "string" && parsed.audience.trim().length > 2) {
      facts.audience = parsed.audience.trim().replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ");
    }
    return Object.keys(facts).length ? facts : null;
  } catch (error) {
    console.error("[ai-copy] facts generation failed", error instanceof Error ? error.message : error);
    return null;
  }
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
      : product.imagePrompts,
    fcpVerdict: overrides.fcpVerdict ?? product.fcpVerdict
  };
}
