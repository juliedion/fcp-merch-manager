// Shared types for the FCP Ad Studio feature (Phase 1).
// Persistence tables: ad_projects, brand_kits (see supabase/migrations/0003_ad_studio.sql).
// ad_concepts and ad_scenes are stored as jsonb columns on ad_projects rather than
// separate tables — see docs/ad-studio.md for the reasoning (Phase 1 scenes/concepts
// are always edited/replaced as a whole unit with the parent project, so normalizing
// them into their own tables would add join complexity with no Phase 1 benefit).

export const AUDIENCE_PRESETS = [
  "Parents",
  "Families",
  "Moms",
  "Dads",
  "Grandparents",
  "Teachers",
  "Travelers",
  "Pet owners",
  "Home organizers",
  "Gift shoppers",
  "Kids",
  "Teens",
  "General shoppers"
] as const;

export type AudiencePreset = (typeof AUDIENCE_PRESETS)[number];

export type AdProductSnapshot = {
  source: "shopify" | "mavely";
  sourceId: string; // Shopify product gid, or mavely_products.id
  title: string;
  description: string;
  images: string[];
  price: number;
  compareAtPrice: number | null;
  vendor: string;
  productType: string;
  tags: string[];
  collections: string[];
  handle: string;
  productUrl: string;
  isAffiliate: boolean;
  affiliateUrl: string | null;
  retailerName: string | null;
  benefits: string[];
  seoDescription: string;
};

export const CONCEPT_TYPES = [
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
] as const;

export type ConceptType = (typeof CONCEPT_TYPES)[number];

export type AdConcept = {
  id: string;
  conceptType: ConceptType;
  title: string;
  targetAudience: string;
  coreProblem: string;
  productSolution: string;
  emotionalAngle: string;
  openingHook: string;
  closingCta: string;
  recommendedDurationSeconds: number;
  requiredMedia: string[];
  estimatedRunwayUsage: string; // Always "None (Phase 1)"
  estimatedRenderingCost: string; // Always "$0 — local render"
};

export type SceneSource =
  | "product_image"
  | "uploaded_image"
  | "product_video"
  | "ai_lifestyle_placeholder"
  | "runway_animation"
  | "title_card"
  | "cta_card";

export type MotionEffect =
  | "push_in"
  | "pull_out"
  | "pan_left"
  | "pan_right"
  | "pan_up"
  | "pan_down"
  | "ken_burns"
  | "parallax" // simplified: combined pan+zoom, see lib/ad-studio-motion.ts
  | "slight_rotation"
  | "product_spotlight"
  | "background_blur"
  | "foreground_background_separation" // deferred/simplified: no real segmentation
  | "masked_zoom"
  | "split_screen"
  | "none";

export const MOTION_EFFECTS: { id: MotionEffect; label: string; simplified?: string }[] = [
  { id: "push_in", label: "Slow push in" },
  { id: "pull_out", label: "Slow pull out" },
  { id: "pan_left", label: "Pan left" },
  { id: "pan_right", label: "Pan right" },
  { id: "pan_up", label: "Pan up" },
  { id: "pan_down", label: "Pan down" },
  { id: "ken_burns", label: "Ken Burns" },
  { id: "parallax", label: "Parallax", simplified: "Simplified as combined pan + zoom in Phase 1 — no real depth layering." },
  { id: "slight_rotation", label: "Slight rotation" },
  { id: "product_spotlight", label: "Product spotlight", simplified: "Simplified as a vignette + zoom-to-center in Phase 1." },
  { id: "background_blur", label: "Background blur", simplified: "Simple blur filter on a duplicated background layer." },
  {
    id: "foreground_background_separation",
    label: "Foreground/background separation",
    simplified: "Deferred/simplified — no real image segmentation available in Phase 1. Falls back to Ken Burns."
  },
  { id: "masked_zoom", label: "Masked zoom", simplified: "Implemented as a zoom with a rounded-rect/circle mask." },
  { id: "split_screen", label: "Split-screen comparison", simplified: "Literal two-image side-by-side layout." },
  { id: "none", label: "None (static)" }
];

export type AdScene = {
  id: string;
  sceneNumber: number;
  durationSeconds: number;
  purpose: string;
  visualDescription: string;
  recommendedSource: SceneSource;
  productImageUrl: string | null;
  secondaryImageUrl: string | null; // for split-screen
  onScreenText: string;
  soundEffectLabel: string; // label only, no audio asset in Phase 1
  musicIntensityLabel: string; // label only
  safeAreaNote: string;
  voiceOverLine: string; // captured, unused for audio in Phase 1
  runwayPrompt: string; // inert in Phase 1
  motionEffect: MotionEffect;
};

export type AspectRatio = "9:16" | "4:5" | "1:1" | "16:9";

export const ASPECT_RATIOS: { id: AspectRatio; label: string; width: number; height: number }[] = [
  { id: "9:16", label: "9:16 vertical (default)", width: 1080, height: 1920 },
  { id: "4:5", label: "4:5 portrait", width: 1080, height: 1350 },
  { id: "1:1", label: "1:1 square", width: 1080, height: 1080 },
  { id: "16:9", label: "16:9 landscape", width: 1920, height: 1080 }
];

export type BrandKit = {
  id: string;
  name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  font_choice: string;
  text_style_preset: string;
  default_cta_text: string;
  default_disclosure_text: string;
  website_url: string;
  social_handles: string;
  watermark_all_scenes: boolean;
  created_at: string;
  updated_at: string;
};

export type GeneratedCopy = {
  openingHooks: string[];
  onScreenTextSuggestions: string[];
  benefitCallouts: string[];
  ctaOptions: string[];
  tiktokCaption: string;
  instagramCaption: string;
  facebookCaption: string;
  youtubeShortsTitle: string;
  pinterestTitle: string;
  pinterestDescription: string;
  hashtags: string[];
  thumbnailText: string;
  productPageVideoTitle: string;
  accessibilityAltText: string;
  voiceOverScript: string;
};

export type RenderStatus = "Draft" | "Generating" | "Ready for Review" | "Rendering" | "Complete" | "Failed" | "Archived";

export type AdProjectRow = {
  id: string;
  created_at: string;
  updated_at: string;
  project_name: string;
  product_source: "shopify" | "mavely";
  product_source_id: string;
  product_snapshot: AdProductSnapshot;
  audience: string;
  selected_concept: AdConcept | null;
  scenes: AdScene[];
  brand_kit_id: string | null;
  aspect_ratio: AspectRatio;
  generated_copy: GeneratedCopy | null;
  cost_estimate: number;
  actual_cost: number;
  render_status: RenderStatus;
  claims_approved: boolean;
  export_urls: string[];
  archived: boolean;
};

export type FactFlag = {
  sceneId: string | null;
  text: string;
  matchedTerm: string;
  reason: string;
};

export type ProductFactReview = {
  importedFacts: string[];
  generatedText: { sceneId: string; text: string }[];
  flags: FactFlag[];
  missingInfo: string[];
  priceDisclaimerNeeded: boolean;
  isAffiliate: boolean;
};
