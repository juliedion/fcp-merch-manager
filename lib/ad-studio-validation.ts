import { z } from "zod";
import { CONCEPT_TYPES } from "./ad-studio-types";

export const adProductSnapshotSchema = z.object({
  source: z.enum(["shopify", "mavely"]),
  sourceId: z.string().default(""),
  title: z.string().min(1, "Title is required."),
  description: z.string().default(""),
  images: z.array(z.string()).default([]),
  price: z.coerce.number().default(0),
  compareAtPrice: z.coerce.number().nullable().default(null),
  vendor: z.string().default(""),
  productType: z.string().default(""),
  tags: z.array(z.string()).default([]),
  collections: z.array(z.string()).default([]),
  handle: z.string().default(""),
  productUrl: z.string().default(""),
  isAffiliate: z.boolean().default(false),
  affiliateUrl: z.string().nullable().default(null),
  retailerName: z.string().nullable().default(null),
  benefits: z.array(z.string()).default([]),
  seoDescription: z.string().default("")
});

export const adConceptSchema = z.object({
  id: z.string(),
  conceptType: z.enum(CONCEPT_TYPES),
  title: z.string(),
  targetAudience: z.string(),
  coreProblem: z.string(),
  productSolution: z.string(),
  emotionalAngle: z.string(),
  openingHook: z.string(),
  closingCta: z.string(),
  recommendedDurationSeconds: z.number(),
  requiredMedia: z.array(z.string()),
  estimatedRunwayUsage: z.string(),
  estimatedRenderingCost: z.string()
});

export const adSceneSchema = z.object({
  id: z.string(),
  sceneNumber: z.number(),
  durationSeconds: z.number().positive(),
  purpose: z.string().default(""),
  visualDescription: z.string().default(""),
  recommendedSource: z.enum(["product_image", "uploaded_image", "product_video", "ai_lifestyle_placeholder", "runway_animation", "title_card", "cta_card"]),
  productImageUrl: z.string().nullable().default(null),
  secondaryImageUrl: z.string().nullable().default(null),
  onScreenText: z.string().default(""),
  soundEffectLabel: z.string().default(""),
  musicIntensityLabel: z.string().default(""),
  safeAreaNote: z.string().default(""),
  voiceOverLine: z.string().default(""),
  runwayPrompt: z.string().default(""),
  motionEffect: z.string().default("ken_burns")
});

export const generatedCopySchema = z.object({
  openingHooks: z.array(z.string()).default([]),
  onScreenTextSuggestions: z.array(z.string()).default([]),
  benefitCallouts: z.array(z.string()).default([]),
  ctaOptions: z.array(z.string()).default([]),
  tiktokCaption: z.string().default(""),
  instagramCaption: z.string().default(""),
  facebookCaption: z.string().default(""),
  youtubeShortsTitle: z.string().default(""),
  pinterestTitle: z.string().default(""),
  pinterestDescription: z.string().default(""),
  hashtags: z.array(z.string()).default([]),
  thumbnailText: z.string().default(""),
  productPageVideoTitle: z.string().default(""),
  accessibilityAltText: z.string().default(""),
  voiceOverScript: z.string().default("")
});

export const adProjectInputSchema = z.object({
  projectName: z.string().min(1, "Project name is required."),
  productSource: z.enum(["shopify", "mavely"]),
  productSourceId: z.string().default(""),
  productSnapshot: adProductSnapshotSchema,
  audience: z.string().default(""),
  selectedConcept: adConceptSchema.nullable().default(null),
  scenes: z.array(adSceneSchema).default([]),
  brandKitId: z.string().nullable().default(null),
  aspectRatio: z.enum(["9:16", "4:5", "1:1", "16:9"]).default("9:16"),
  generatedCopy: generatedCopySchema.nullable().default(null),
  costEstimate: z.number().default(0),
  actualCost: z.number().default(0),
  renderStatus: z.enum(["Draft", "Generating", "Ready for Review", "Rendering", "Complete", "Failed", "Archived"]).default("Draft"),
  claimsApproved: z.boolean().default(false),
  exportUrls: z.array(z.string()).default([])
});

export type ValidatedAdProjectInput = z.infer<typeof adProjectInputSchema>;

export const brandKitInputSchema = z.object({
  name: z.string().default("Fort Crazypants Brand Kit"),
  logoUrl: z.string().default(""),
  primaryColor: z.string().default("#063f42"),
  secondaryColor: z.string().default("#ff6b6b"),
  fontChoice: z.string().default("system-ui"),
  textStylePreset: z.string().default("Bold caps hook, clean sans body"),
  defaultCtaText: z.string().default("Shop Now"),
  defaultDisclosureText: z.string().default("Fort Crazypants may earn a commission from qualifying purchases."),
  websiteUrl: z.string().default(""),
  socialHandles: z.string().default(""),
  watermarkAllScenes: z.boolean().default(false)
});

export type ValidatedBrandKitInput = z.infer<typeof brandKitInputSchema>;

export const conceptGenerateRequestSchema = z.object({
  productSnapshot: adProductSnapshotSchema,
  audience: z.string().min(1),
  seed: z.number().optional()
});

export const storyboardGenerateRequestSchema = z.object({
  productSnapshot: adProductSnapshotSchema,
  concept: adConceptSchema,
  seed: z.number().optional()
});
