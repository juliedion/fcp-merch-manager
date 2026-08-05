-- FCP Ad Studio (Phase 1)
-- New, independent tables from mavely_products / the legacy products table.
-- Persistence layer for app/ad-studio/** and app/api/ad-studio/**.
--
-- Design decision: ad_concepts and ad_scenes are NOT separate tables in Phase 1.
-- They're stored as jsonb columns (selected_concept, scenes) directly on ad_projects.
-- Reasoning: in this wizard, concepts/scenes are always generated, edited, and saved
-- as a whole unit together with their parent project (there is no independent
-- lifecycle for a scene or concept outside of "this ad project's storyboard"), so a
-- normalized join would add write/read complexity (upserts across 3 tables per save)
-- without a Phase 1 benefit. This can be normalized later if Phase 2 needs to query
-- across scenes independently (e.g. a template library built from past scenes).
--
-- ad_assets IS a real table: uploaded/generated media (images, rendered MP4s) need
-- their own row per file, with scene linkage, a source type, and a Supabase Storage
-- path, independent of any single project revision.
--
-- Skipped for Phase 1 (see docs/ad-studio.md "deferred" list): AdTemplate (no
-- template library yet), GenerationJob / RenderJob (no async job queue — Phase 1
-- renders synchronously in the API route), CostRecord (cost is always $0 in Phase 1,
-- tracked as plain columns on ad_projects instead of a ledger table).

create table if not exists brand_kits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  name text not null default 'Fort Crazypants Brand Kit',
  logo_url text not null default '',
  primary_color text not null default '#063f42',
  secondary_color text not null default '#ff6b6b',
  font_choice text not null default 'system-ui',
  text_style_preset text not null default 'Bold caps hook, clean sans body',
  default_cta_text text not null default 'Shop Now',
  default_disclosure_text text not null default 'Fort Crazypants may earn a commission from qualifying purchases.',
  website_url text not null default '',
  social_handles text not null default '',
  watermark_all_scenes boolean not null default false
);

create table if not exists ad_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  project_name text not null,

  -- Source product: either a live Shopify product (gid) or a mavely_products row id.
  product_source text not null default 'shopify' check (product_source in ('shopify', 'mavely')),
  product_source_id text not null default '',
  product_snapshot jsonb not null default '{}'::jsonb,

  audience text not null default '',

  -- jsonb per the design decision above.
  selected_concept jsonb,
  scenes jsonb not null default '[]'::jsonb,

  brand_kit_id uuid references brand_kits(id) on delete set null,
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16', '4:5', '1:1', '16:9')),

  generated_copy jsonb,

  cost_estimate numeric(12,2) not null default 0,
  actual_cost numeric(12,2) not null default 0,

  render_status text not null default 'Draft'
    check (render_status in ('Draft', 'Generating', 'Ready for Review', 'Rendering', 'Complete', 'Failed', 'Archived')),
  claims_approved boolean not null default false,

  export_urls text[] not null default array[]::text[],
  archived boolean not null default false
);

create index if not exists ad_projects_product_source_id_idx on ad_projects (product_source_id);
create index if not exists ad_projects_render_status_idx on ad_projects (render_status);
create index if not exists ad_projects_archived_idx on ad_projects (archived);
create index if not exists ad_projects_brand_kit_id_idx on ad_projects (brand_kit_id);

create table if not exists ad_assets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  ad_project_id uuid references ad_projects(id) on delete cascade,
  scene_id text, -- matches an id inside ad_projects.scenes jsonb; not a foreign key since scenes aren't a table

  source_type text not null
    check (source_type in ('product_image', 'uploaded_image', 'product_video', 'ai_lifestyle_placeholder', 'logo', 'rendered_video')),

  storage_bucket text not null default 'ad-studio',
  storage_path text not null,
  public_url text,

  width integer,
  height integer,
  duration_seconds numeric(8,2),
  mime_type text
);

create index if not exists ad_assets_ad_project_id_idx on ad_assets (ad_project_id);
create index if not exists ad_assets_source_type_idx on ad_assets (source_type);

-- RLS: same service-role-only access model as mavely_products (see
-- supabase/migrations/0002_mavely_products.sql). There is no end-user auth model in
-- this app (single shared password gate in middleware.ts, not Supabase auth). All
-- reads/writes happen server-side in app/api/ad-studio/** using
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely. RLS is enabled here as
-- defense-in-depth in case the anon key is ever used directly against these tables —
-- with no policies defined, anon/authenticated roles get zero access.
alter table brand_kits enable row level security;
alter table ad_projects enable row level security;
alter table ad_assets enable row level security;
-- Intentionally no policies on any of the three tables: service-role-only access model.

create or replace function ad_studio_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists brand_kits_updated_at on brand_kits;
create trigger brand_kits_updated_at
  before update on brand_kits
  for each row
  execute function ad_studio_set_updated_at();

drop trigger if exists ad_projects_updated_at on ad_projects;
create trigger ad_projects_updated_at
  before update on ad_projects
  for each row
  execute function ad_studio_set_updated_at();

-- Seed one default brand kit row so the Brand step (step 6) always has something to
-- load/edit on first use, without requiring a separate "create" click.
insert into brand_kits (name)
select 'Fort Crazypants Brand Kit'
where not exists (select 1 from brand_kits);

-- Note: Supabase Storage buckets cannot be created via plain SQL/migrations — they
-- must be created via the Supabase Dashboard, the Management API, or the Supabase
-- CLI. See docs/ad-studio.md for the exact manual steps to create the "ad-studio"
-- bucket used by app/api/ad-studio/render/route.ts and any image-upload endpoints.
