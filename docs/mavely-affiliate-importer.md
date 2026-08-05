# Mavely Affiliate Product Importer

Creates Shopify "affiliate" products backed by Mavely links: paste a retailer URL and a
Mavely link, fill in the product details, and publish. On the storefront the product
looks normal but the primary action button sends shoppers to the retailer through the
saved Mavely link instead of adding to cart.

## 1. Environment variables

Set these in `.env.local` (and in Vercel project settings for production):

| Variable | Required for | Notes |
|---|---|---|
| `APP_PASSWORD` | Password gate | Shared password protecting the whole app. Required or the app is left open (see Notes). |
| `NEXT_PUBLIC_SUPABASE_URL` | Persistence | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Persistence | Server-only key, used exclusively in `app/api/**` routes. Never exposed to the client. |
| `SHOPIFY_STORE_DOMAIN` | Shopify publish | e.g. `your-store.myshopify.com`. |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Shopify publish | Admin API access token with `write_products` scope. |
| `SHOPIFY_API_VERSION` | Shopify publish | Defaults to `2025-10` if unset. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (unused by this feature) | Existing var from Product Studio; not read by Mavely routes. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | (unused by this feature) | Existing vars from Product Studio; the Mavely description generator is a local template, not an AI call. |

## 2. Run the Supabase migration

```bash
# via Supabase SQL editor: paste and run
supabase/migrations/0002_mavely_products.sql

# or via the Supabase CLI, if the project is linked:
supabase db push
```

This creates the `mavely_products` table (RLS enabled, no policies — service-role-only
access model, see comments in the migration file) plus an `updated_at` trigger.

## 3. Run the Shopify metafield setup script

One-time (idempotent, safe to re-run):

```bash
node --env-file=.env.local scripts/setup-shopify-metafields.mjs
```

Creates the 7 `custom.*` product metafield definitions: `mavely_link`, `retailer_url`,
`retailer_name`, `affiliate_product`, `external_button_label`, `last_price_checked`,
`original_price`.

## 4. Apply the theme snippets

Nothing is pushed automatically. Follow `theme/README.md` to manually paste the
snippets in `theme/snippets/*.liquid` and the settings addition in
`theme/settings_schema-addition.json` into the live theme via the Shopify theme editor.

## 5. Using the feature

- **Add product**: `/mavely/new` — a 6-step wizard (Product Source → Product Details →
  Images → Shopify Organization → Affiliate Settings → Review), with Save Draft,
  Previous/Continue, and Publish actions. Data also mirrors to `localStorage` as a
  refresh safety net.
- **Dashboard**: `/mavely` — lists all imported products with image, title, retailer,
  price, Shopify status, Mavely link status, dates, and Shopify product ID. Row actions:
  Edit, Preview, Open in Shopify, Open retailer page, Open Mavely link, Duplicate,
  Archive, Delete (delete requires an explicit confirm dialog; optionally also deletes
  the live Shopify product if checked).
- **Bulk import**: `/mavely/bulk-import` — upload or paste a CSV; per-row validation
  errors are shown by row number, valid rows still import. Sample file:
  `public/mavely-bulk-import-sample.csv`.
- **Edit**: `/mavely/[id]/edit` — same wizard, pre-filled; publishing calls Shopify
  `productSet` against the *existing* product ID (never creates a new product).
- **Login**: `/login` — shared password form; sets an httpOnly cookie checked by
  `middleware.ts` on every request.

## 6. Manual test plan

1. **Password gate**: visit any route while logged out → redirected to `/login`. Enter
   the wrong password → error shown, no cookie set. Enter the correct `APP_PASSWORD` →
   redirected back, cookie persists across a refresh.
2. **Single import + publish**: `/mavely/new`, paste a real retailer URL, click
   "Import details from URL", fill in a Mavely link, walk through all steps, publish
   with status Draft. Confirm success screen shows product ID/handle + admin/storefront
   links. Verify in Shopify admin: product exists as Draft, has one variant priced
   correctly, and all 7 `custom.*` metafields are set.
3. **Edit**: open the product from `/mavely`, change the title/price, save via
   "Update Shopify Product". Confirm Shopify shows the *same* product ID updated (no
   duplicate product created).
4. **Bulk CSV import with one bad row**: use `public/mavely-bulk-import-sample.csv`,
   edit one row to have a bad `mavely_link` (e.g. missing `https://`), import. Confirm
   the bad row is reported by row number with a specific error, and the other rows still
   import as drafts.
5. **Duplicate detection**: try publishing a second product with the same Mavely link or
   title as an existing record. Confirm a 409 duplicate warning appears with matched
   fields and options to cancel or "Create anyway".
6. **Delete confirmation**: click Delete on a published row in `/mavely`. Confirm a
   modal appears (not an instant delete), with an explicit checkbox to also delete the
   live Shopify product, and canceling does nothing.
7. **Rate limit / auth error surfacing**: temporarily set an invalid
   `SHOPIFY_ADMIN_ACCESS_TOKEN` and attempt to publish — confirm a clear 401 error
   message is shown, not a generic failure.

## 7. Files created or modified

**Created**
- `middleware.ts`
- `lib/mavely-auth.ts`, `lib/mavely-types.ts`, `lib/mavely-validation.ts`,
  `lib/mavely-supabase.ts`, `lib/mavely-serialize.ts`, `lib/mavely-shopify.ts`,
  `lib/mavely-generator.ts`, `lib/mavely-csv.ts`, `lib/mavely-duplicates.ts`
- `app/login/page.tsx`, `app/api/login/route.ts`, `app/api/logout/route.ts`
- `app/mavely/page.tsx`, `app/mavely/new/page.tsx`, `app/mavely/[id]/edit/page.tsx`,
  `app/mavely/bulk-import/page.tsx`
- `components/MavelyWizard.tsx`
- `app/api/mavely/products/route.ts`, `app/api/mavely/products/[id]/route.ts`,
  `app/api/mavely/publish/route.ts`, `app/api/mavely/check-duplicate/route.ts`,
  `app/api/mavely/bulk-import/route.ts`, `app/api/mavely/generate-description/route.ts`
- `supabase/migrations/0002_mavely_products.sql`
- `scripts/setup-shopify-metafields.mjs`
- `theme/README.md`, `theme/settings_schema-addition.json`,
  `theme/snippets/affiliate-product-button.liquid`,
  `theme/snippets/affiliate-disclosure.liquid`,
  `theme/snippets/affiliate-price-disclaimer.liquid`,
  `theme/snippets/affiliate-main-product-overrides.liquid`,
  `theme/snippets/affiliate-product-card-overrides.liquid`
- `public/mavely-bulk-import-sample.csv`
- `docs/mavely-affiliate-importer.md` (this file)

**Modified**
- `components/AppShell.tsx` — added nav links to `/mavely` and `/mavely/bulk-import`.
- `.env.example` — documented `APP_PASSWORD` and noted the feature's env requirements.

**Untouched (per constraints)**
- `app/page.tsx`, `app/products/page.tsx`, `app/api/generate/route.ts`,
  `app/api/import-product/route.ts`, `app/api/shopify/publish/route.ts`, `lib/types.ts`,
  `lib/generator.ts`, `supabase/schema.sql`.

## 8. Notes / assumptions

- **Image upload mutation**: used `productSet` (2025-10) with a `files` input of
  `{ originalSource: <url>, contentType: IMAGE }` rather than a separate
  `stagedUploadsCreate` → `productCreateMedia` chain. `productSet` accepts remote image
  URLs directly and lets title/description/status/variant/images/SEO all be set
  atomically in one upsert call (`synchronous: true` so `userErrors` reflect the actual
  outcome immediately) — the images here are always retailer/import URLs, never local
  file uploads, so the staged-upload flow (designed for browser file uploads) isn't
  needed. `productSet` is also what makes create-vs-update a single code path: passing
  `id` updates the existing product, omitting it creates a new one.
- **Collection assignment**: used `collectionAddProducts` after the product exists,
  looked up by exact collection title via the `collections(query: "title:'...'")` query.
  If no collection matches that title, the product still publishes and a non-fatal
  warning is returned/shown rather than failing the whole publish — collections are
  organizational, not core to the affiliate listing working.
- **"Category" mapping**: mapped directly to Shopify's `productType` (a free-text
  field), not to Shopify's structured taxonomy `category` field. The spec's "Product
  category" is a simple text input in the form; wiring the full taxonomy picker
  (`ProductCategory` search) is a materially bigger integration (taxonomy ID lookup,
  category tree browsing) that wasn't asked for explicitly, and `productType` already
  covers "Home Organization", "Kitchen", etc. the way the app's existing Product Studio
  generator does.
- **Original price display**: used Shopify's native `compareAtPrice` on the single
  variant for the strikethrough "original price" — this is the standard mechanism
  Shopify's own price snippets already render automatically (`product.compare_at_price`)
  with zero theme changes needed. It's set alongside the `original_price` metafield
  (also saved as plain text) so both the native compare-at UI and any custom
  metafield-driven display work.
- **Inventory**: variant is created with `inventoryItem: { tracked: false }` and
  `inventoryPolicy: CONTINUE`, per spec — Shopify still requires exactly one variant to
  exist, but nothing about stock is tracked or shown; the storefront hides purchase UI
  entirely via the Liquid changes in `theme/`, so untracked inventory is never surfaced.
- **AI description generator**: implemented as a deterministic template function
  (`lib/mavely-generator.ts`), not an external API call — `OPENAI_API_KEY` isn't wired
  up anywhere else in this codebase, and the spec explicitly asks to keep this
  consistent with the existing local-generator pattern in `lib/generator.ts`.
- **Bulk import scope**: bulk CSV rows are imported as local Supabase drafts only (no
  Shopify calls during bulk import) — each row still goes through the same
  duplicate-check + publish path individually from the dashboard. This avoids silently
  firing dozens of live Shopify mutations from one CSV paste, and keeps error handling
  per-product rather than per-batch.
- **CSV parsing**: hand-rolled a small quoted-field-aware parser
  (`lib/mavely-csv.ts`) instead of adding `papaparse` as a dependency — it's under 40
  lines and avoids a new dependency for a well-contained format.
- **Password gate scope**: if `APP_PASSWORD` is unset, `middleware.ts` intentionally
  leaves the app open rather than locking the operator out with no way in — this must be
  set before deploying anywhere publicly reachable. The session cookie is a SHA-256 hash
  of the password (via Web Crypto, since `middleware.ts` may run on the Edge runtime and
  can't use Node's `crypto` module) — a minimal shared-secret gate, not a real session
  system; there's still no per-user auth or expiry beyond the 30-day cookie.
- **Live testing not performed**: no real Shopify or Supabase credentials were available
  in the build environment. Everything here has been checked for logical correctness and
  passes `npx tsc --noEmit`, but the manual test plan above (sections 1–7) still needs to
  be run against real credentials before this goes live.
