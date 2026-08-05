-- Mavely Affiliate Product Importer
-- New, independent table from the legacy `products` table in supabase/schema.sql.
-- This is the persistence layer for app/mavely/** and app/api/mavely/**.

create table if not exists mavely_products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Product Source
  retailer_url text not null default '',
  mavely_link text not null default '',
  retailer_name text not null default '',
  sku text not null default '',

  -- Product Details
  title text not null,
  description_html text not null default '',
  short_summary text not null default '',
  current_price numeric(12,2) not null default 0,
  original_price numeric(12,2),

  -- Images
  images text[] not null default array[]::text[],

  -- Shopify Organization
  category text not null default '',
  collection text not null default '',
  tags text[] not null default array[]::text[],
  vendor text not null default '',

  -- Affiliate Settings
  button_label text not null default 'Shop Now',
  seo_title text not null default '',
  seo_description text not null default '',

  -- Publishing state
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  archived boolean not null default false,

  -- Shopify linkage (set once published)
  shopify_product_id text,
  shopify_handle text,
  shopify_admin_url text,
  shopify_storefront_url text,
  last_price_checked date
);

create index if not exists mavely_products_shopify_product_id_idx on mavely_products (shopify_product_id);
create index if not exists mavely_products_shopify_handle_idx on mavely_products (shopify_handle);
create index if not exists mavely_products_mavely_link_idx on mavely_products (mavely_link);
create index if not exists mavely_products_retailer_url_idx on mavely_products (retailer_url);
create index if not exists mavely_products_archived_idx on mavely_products (archived);

-- RLS: there is no end-user auth model in this app (single shared password gate at the
-- Next.js middleware layer, not Supabase auth). All reads/writes happen server-side in
-- app/api/mavely/** using SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely. RLS is
-- still enabled here as defense-in-depth in case the anon key is ever used against this
-- table directly — with no policies defined, anon/authenticated roles get zero access,
-- and only the service role (which bypasses RLS) can read or write.
alter table mavely_products enable row level security;
-- Intentionally no policies: service-role-only access model.

create or replace function mavely_products_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists mavely_products_updated_at on mavely_products;
create trigger mavely_products_updated_at
  before update on mavely_products
  for each row
  execute function mavely_products_set_updated_at();
