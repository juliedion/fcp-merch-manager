import { ValidatedAdProjectInput, ValidatedBrandKitInput } from "./ad-studio-validation";

/** Converts a validated camelCase ad project input into the snake_case column set for ad_projects. */
export function adProjectInputToRowFields(input: ValidatedAdProjectInput) {
  return {
    project_name: input.projectName,
    product_source: input.productSource,
    product_source_id: input.productSourceId,
    product_snapshot: input.productSnapshot,
    audience: input.audience,
    selected_concept: input.selectedConcept,
    scenes: input.scenes,
    brand_kit_id: input.brandKitId,
    aspect_ratio: input.aspectRatio,
    generated_copy: input.generatedCopy,
    cost_estimate: input.costEstimate,
    actual_cost: input.actualCost,
    render_status: input.renderStatus,
    claims_approved: input.claimsApproved,
    export_urls: input.exportUrls,
    updated_at: new Date().toISOString()
  };
}

export function brandKitInputToRowFields(input: ValidatedBrandKitInput) {
  return {
    name: input.name,
    logo_url: input.logoUrl,
    primary_color: input.primaryColor,
    secondary_color: input.secondaryColor,
    font_choice: input.fontChoice,
    text_style_preset: input.textStylePreset,
    default_cta_text: input.defaultCtaText,
    default_disclosure_text: input.defaultDisclosureText,
    website_url: input.websiteUrl,
    social_handles: input.socialHandles,
    watermark_all_scenes: input.watermarkAllScenes,
    updated_at: new Date().toISOString()
  };
}
