export type ButtonLabel =
  | "Shop Now"
  | "View Deal"
  | "Shop at Walmart"
  | "Shop at Target"
  | "Shop at Amazon"
  | "Check Price"
  | "Buy from Retailer"
  | string;

export const BUTTON_LABEL_PRESETS: string[] = [
  "Shop Now",
  "View Deal",
  "Shop at Walmart",
  "Shop at Target",
  "Shop at Amazon",
  "Check Price",
  "Buy from Retailer"
];

export type MavelyProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

/** Row shape for the mavely_products Supabase table. Snake_case to match the DB. */
export type MavelyProductRow = {
  id: string;
  created_at: string;
  updated_at: string;
  retailer_url: string;
  mavely_link: string;
  title: string;
  description_html: string;
  short_summary: string;
  retailer_name: string;
  current_price: number;
  original_price: number | null;
  images: string[];
  category: string;
  collection: string;
  tags: string[];
  vendor: string;
  sku: string;
  button_label: string;
  seo_title: string;
  seo_description: string;
  status: MavelyProductStatus;
  shopify_product_id: string | null;
  shopify_handle: string | null;
  shopify_admin_url: string | null;
  shopify_storefront_url: string | null;
  last_price_checked: string | null;
  archived: boolean;
};

/** Form / API payload shape (camelCase) used across the wizard, API routes, and CSV import. */
export type MavelyProductInput = {
  retailerUrl: string;
  mavelyLink: string;
  title: string;
  descriptionHtml: string;
  shortSummary: string;
  retailerName: string;
  currentPrice: number;
  originalPrice?: number | null;
  images: string[];
  category: string;
  collection: string;
  tags: string[];
  vendor: string;
  sku: string;
  buttonLabel: string;
  seoTitle: string;
  seoDescription: string;
  status: MavelyProductStatus;
};

export function rowToInput(row: MavelyProductRow): MavelyProductInput {
  return {
    retailerUrl: row.retailer_url,
    mavelyLink: row.mavely_link,
    title: row.title,
    descriptionHtml: row.description_html,
    shortSummary: row.short_summary,
    retailerName: row.retailer_name,
    currentPrice: row.current_price,
    originalPrice: row.original_price,
    images: row.images || [],
    category: row.category,
    collection: row.collection,
    tags: row.tags || [],
    vendor: row.vendor,
    sku: row.sku,
    buttonLabel: row.button_label,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    status: row.status
  };
}
