import { ValidatedMavelyProductInput } from "./mavely-validation";

/** Converts a validated camelCase input into the snake_case column set for mavely_products. */
export function inputToRowFields(input: ValidatedMavelyProductInput) {
  return {
    retailer_url: input.retailerUrl,
    mavely_link: input.mavelyLink,
    title: input.title,
    description_html: input.descriptionHtml,
    short_summary: input.shortSummary,
    retailer_name: input.retailerName,
    current_price: input.currentPrice,
    original_price: input.originalPrice ?? null,
    images: input.images,
    category: input.category,
    collection: input.collection,
    tags: input.tags,
    vendor: input.vendor,
    sku: input.sku,
    button_label: input.buttonLabel,
    seo_title: input.seoTitle,
    seo_description: input.seoDescription,
    status: input.status,
    updated_at: new Date().toISOString()
  };
}
