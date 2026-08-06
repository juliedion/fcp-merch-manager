export type ProductType = "amazon_affiliate" | "dropshipping" | "wholesale" | "private_label";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  amazon_affiliate: "Amazon Affiliate",
  dropshipping: "Dropshipping",
  wholesale: "Wholesale",
  private_label: "Private Label"
};

// Default call-to-action text per product type — affiliate links out to Amazon, the
// others are ordinary Shopify purchase flows (no affiliate disclosure needed for those).
export const DEFAULT_CTA_TEXT: Record<ProductType, string> = {
  amazon_affiliate: "Check Today's Price on Amazon",
  dropshipping: "Add to Cart",
  wholesale: "Add to Cart",
  private_label: "Add to Cart"
};

export const AMAZON_ASSOCIATE_DISCLOSURE = "As an Amazon Associate, I earn from qualifying purchases.";

export type ProductInput = {
  url: string;
  name: string;
  cost: number;
  price: number;
  category: string;
  audience: string;
  problem: string;
  features: string;
  shippingDays: number;
  competition: "low" | "medium" | "high";
  demoFactor: number;
  productType: ProductType;
  amazonUrl: string;
  affiliateUrl: string;
};

export type ChecklistKey =
  | "shopifyCreated"
  | "imagesGenerated"
  | "pinterestCreated"
  | "instagramGenerated"
  | "reelGenerated"
  | "emailGenerated"
  | "blogGenerated"
  | "seoReviewed"
  | "shippingReviewed"
  | "risksReviewed"
  | "finalApprovalRecorded"
  | "productPublished";

export const CHECKLIST_ITEMS: { key: ChecklistKey; label: string }[] = [
  { key: "shopifyCreated", label: "Shopify Product Created" },
  { key: "imagesGenerated", label: "Product Images Generated" },
  { key: "pinterestCreated", label: "Pinterest Pin Created" },
  { key: "instagramGenerated", label: "Instagram Caption Generated" },
  { key: "reelGenerated", label: "Reel Script Generated" },
  { key: "emailGenerated", label: "Email Campaign Generated" },
  { key: "blogGenerated", label: "Blog Article Generated" },
  { key: "seoReviewed", label: "SEO Reviewed" },
  { key: "shippingReviewed", label: "Shipping Reviewed" },
  { key: "risksReviewed", label: "Product Risks & Claims Reviewed" },
  { key: "finalApprovalRecorded", label: "Final Approval Recorded" },
  { key: "productPublished", label: "Product Published" },
];

// Required before a draft can be pushed to Shopify — the rest of CHECKLIST_ITEMS is
// tracked for visibility but doesn't block publishing.
export const REQUIRED_BEFORE_PUBLISH: ChecklistKey[] = ["imagesGenerated", "seoReviewed", "shippingReviewed", "risksReviewed", "finalApprovalRecorded"];

export type Checklist = Record<ChecklistKey, boolean>;

export const emptyChecklist = (): Checklist => ({
  shopifyCreated: false,
  imagesGenerated: false,
  pinterestCreated: false,
  instagramGenerated: false,
  reelGenerated: false,
  emailGenerated: false,
  blogGenerated: false,
  seoReviewed: false,
  shippingReviewed: false,
  risksReviewed: false,
  finalApprovalRecorded: false,
  productPublished: false,
});

export type ScoreFactor = {
  label: string;
  status: "good" | "warning" | "bad";
  points: number;
  max: number;
  detail: string;
};

export type SEOContent = {
  seoTitle: string;
  metaDescription: string;
  slug: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  imageAltText: string;
  schemaProductDescription: string;
  internalLinkingSuggestions: string[];
  relatedProducts: string[];
  faqs: { question: string; answer: string }[];
};

export type VideoPromptKey =
  | "reel15"
  | "reel30"
  | "tiktok"
  | "youtubeShort"
  | "ugcAd"
  | "demonstration"
  | "beforeAfter"
  | "problemSolution";

export type VideoPrompt = {
  key: VideoPromptKey;
  label: string;
  duration: string;
  hook: string;
  scenes: string[];
  voiceover: string;
  cta: string;
};

export type ImagePromptKey =
  | "lifestyle"
  | "whiteBackground"
  | "pinterestPin"
  | "instagramSquare"
  | "instagramStory"
  | "heroBanner"
  | "websiteThumbnail"
  | "holiday"
  | "family";

export type ImagePrompt = {
  key: ImagePromptKey;
  label: string;
  aspectRatio: string;
  prompt: string;
  negativePrompt: string;
};

export type PricingTierKey =
  | "suggestedRetail"
  | "premiumRetail"
  | "flashSale"
  | "bogo"
  | "holidaySale"
  | "targetMargin"
  | "expectedProfit"
  | "amazonPrice"
  | "commissionRate"
  | "commissionPerSale"
  | "monthlyEarnings10"
  | "monthlyEarnings50";

export type PricingTier = {
  key: PricingTierKey;
  label: string;
  value: number;
  format: "currency" | "percent";
  explanation: string;
};

export type PricingEngine = {
  tiers: PricingTier[];
};

export type RecommendationKey =
  | "virality"
  | "impulseBuy"
  | "problemSolver"
  | "giftability"
  | "easyToDemonstrate"
  | "repeatPurchase"
  | "familyAppeal"
  | "homeOrganizationFit"
  | "socialMediaPotential"
  | "competitionLevel";

export type Rating = { key: RecommendationKey; label: string; stars: number; detail: string };

export type Recommendation = {
  ratings: Rating[];
  summary: string;
};

export type Merchandising = {
  recommendedPrice: number;
  discountPrice: number;
  bundleOpportunities: string[];
  crossSellIdeas: string[];
  targetCustomer: string;
  bestAgeGroup: string;
  bestRoom: string;
  bestSeason: string;
  bestSocialPlatform: string;
  suggestedHashtags: string[];
  topKeywords: string[];
  ctaRecommendations: string[];
};

export type GeneratedProduct = ProductInput & {
  id: string;
  createdAt: string;
  score: number;
  margin: number;
  verdict: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  bullets: string[];
  benefits: string[];
  specifications: string[];
  tags: string[];
  collections: string[];
  seoTitle: string;
  metaDescription: string;
  altText: string;
  pinterestTitle: string;
  pinterestDescription: string;
  pinterestPinCopy: string;
  instagramCaption: string;
  instagramCarousel: string[];
  facebookPost: string;
  tiktokCaption: string;
  tiktokHook: string;
  tiktokVoiceover: string;
  reelScript: string;
  reelScript15: string;
  reelScript30: string;
  emailSubject: string;
  emailBody: string;
  emailCampaign: string;
  smsPromotion: string;
  googleShoppingDescription: string;
  faq: { question: string; answer: string }[];
  careInstructions: string;
  blogTitle: string;
  blogOutline: string[];
  blogArticle: string;
  scoreFactors: ScoreFactor[];
  scoreFormula: string;
  recommendation: Recommendation;
  merchandising: Merchandising;
  pricing: PricingEngine;
  imagePrompts: ImagePrompt[];
  videoPrompts: VideoPrompt[];
  seo: SEOContent;
  checklist?: Checklist;
  ctaButtonText: string;
  ctaButtonUrl: string;
  disclosureText: string;
};

// Curated storefront collections Product Studio auto-detects a product into — kept as a
// fixed, editable-before-publish list rather than free-form generated categories, so
// collection pages stay consistent across every product added to the store.
export const CURATED_COLLECTIONS = [
  "Kitchen", "Backyard", "Camping", "Pets", "Cleaning", "Kids", "Travel",
  "Home Organization", "Office", "Electronics", "Garage", "Holiday"
] as const;
export type CuratedCollection = typeof CURATED_COLLECTIONS[number];

export type ProductSettings = {
  brandVoice: string;
  buttonColor: string;
  disclosureText: string;
  defaultCollections: CuratedCollection[];
  socialTone: string;
};

export const DEFAULT_PRODUCT_SETTINGS: ProductSettings = {
  brandVoice: "Warm, practical, a little playful — like a friend who already tested the product for you.",
  buttonColor: "#1a5f4a",
  disclosureText: AMAZON_ASSOCIATE_DISCLOSURE,
  defaultCollections: [],
  socialTone: "Friendly and enthusiastic, not salesy"
};

// AI Marketing Campaign — real LLM-generated content (via OpenAI), distinct from the
// deterministic template generator above. Scoped to the highest-value pieces first
// (analysis, personas, angles, headlines/hooks/CTAs, ad copy for 3 platforms) rather than
// the full ~40-category volume, to keep cost/latency/quality reasonable per generation.
export type ProductAnalysis = {
  oneSentenceSummary: string;
  uniqueSellingProposition: string;
  idealCustomer: string;
  topBenefits: string[];
  topPainPoints: string[];
  emotionalDrivers: string[];
  buyingTriggers: string[];
  objections: string[];
  competitiveAdvantages: string[];
  urgencyFactors: string[];
  overallScore: number;
  recommendedPlatform: string;
  recommendedTone: string;
};

export type CustomerPersona = {
  name: string;
  ageRange: string;
  incomeRange: string;
  lifestyle: string;
  painPoints: string[];
  buyingMotivation: string;
  messagingAngle: string;
};

export type AdCopySet = { short: string; medium: string; long: string };

export type MarketingCampaign = {
  generatedAt: string;
  analysis: ProductAnalysis;
  personas: CustomerPersona[];
  marketingAngles: { angle: string; pitch: string }[];
  headlines: string[];
  hooks: string[];
  ctas: string[];
  adCopy: {
    facebook: AdCopySet;
    instagram: AdCopySet;
    googleSearch: AdCopySet;
  };
};

export type SocialPostSet = { instagram: string[]; facebook: string[]; pinterest: string[]; tiktok: string[]; x: string[] };
export type MarketingEmail = { type: string; subject: string; body: string };
export type LandingPageContent = {
  heroHeadline: string;
  heroSubheadline: string;
  heroCta: string;
  features: string[];
  benefits: string[];
  faq: { question: string; answer: string }[];
  finalCta: string;
  // No fabricated testimonials — real customer quotes must be added manually before publishing.
  testimonialPlaceholderNote: string;
};

// The "Generate 100 Assets" one-click package — extends the campaign with social posts,
// emails, and landing page copy (all free-form text, one OpenAI call). Images/videos are
// generated separately client-side (real per-unit API cost) using the existing image/video routes.
export type ContentPackage = {
  campaign: MarketingCampaign;
  socialPosts: SocialPostSet;
  emails: MarketingEmail[];
  landingPage: LandingPageContent;
};
