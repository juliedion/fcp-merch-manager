import { getSupabaseAdmin } from "./mavely-supabase";

// Re-export the shared admin client factory so ad-studio code has a single, obvious
// import path while reusing the exact Mavely server-only service-role pattern.
export { getSupabaseAdmin };

export const AD_PROJECTS_TABLE = "ad_projects";
export const BRAND_KITS_TABLE = "brand_kits";
export const AD_ASSETS_TABLE = "ad_assets";
export const AD_STUDIO_BUCKET = "ad-studio";
