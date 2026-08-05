import { getSupabaseAdmin, MAVELY_TABLE } from "./mavely-supabase";
import { slugify } from "./mavely-validation";
import { MavelyProductInput, MavelyProductRow } from "./mavely-types";

export type DuplicateMatch = { row: MavelyProductRow; matchedOn: string[] };

/** Checks Supabase for existing records that look like the same product. */
export async function findPotentialDuplicates(input: MavelyProductInput, excludeId?: string): Promise<DuplicateMatch[]> {
  const supabase = getSupabaseAdmin();
  const handle = slugify(input.title);
  const orFilters = [
    input.mavelyLink && `mavely_link.eq.${input.mavelyLink}`,
    input.retailerUrl && `retailer_url.eq.${input.retailerUrl}`,
    input.title && `title.ilike.${input.title}`,
    input.sku && `sku.eq.${input.sku}`,
    handle && `shopify_handle.eq.${handle}`
  ].filter(Boolean);

  if (!orFilters.length) return [];

  let query = supabase.from(MAVELY_TABLE).select("*").or(orFilters.join(",")).eq("archived", false).limit(10);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw new Error(`Supabase duplicate lookup failed: ${error.message}`);

  const rows = (data || []) as MavelyProductRow[];
  return rows.map(row => {
    const matchedOn: string[] = [];
    if (input.mavelyLink && row.mavely_link === input.mavelyLink) matchedOn.push("mavely_link");
    if (input.retailerUrl && row.retailer_url === input.retailerUrl) matchedOn.push("retailer_url");
    if (input.title && row.title.toLowerCase() === input.title.toLowerCase()) matchedOn.push("title");
    if (input.sku && row.sku === input.sku) matchedOn.push("sku");
    if (handle && row.shopify_handle === handle) matchedOn.push("shopify_handle");
    return { row, matchedOn };
  });
}
