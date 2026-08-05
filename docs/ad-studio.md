# FCP Ad Studio (Phase 1)

Turns an existing Shopify or Mavely affiliate product into a short-form vertical
video ad — product photos + animated text + still-image motion (pan/zoom/Ken
Burns/etc.) + logo/CTA. No Runway, no voice-over, no music in Phase 1.

## Setup

1. **Env vars** — Ad Studio reuses the Mavely feature's existing env vars, no new
   *required* ones:
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — persistence (ad_projects, brand_kits, ad_assets) and Storage uploads.
   - `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `SHOPIFY_API_VERSION` — live product search (step 1).
   - `APP_PASSWORD` — same shared password gate (middleware.ts) already protects `/ad-studio/*`.
   - `RUNWAY_API_KEY` — added to `.env.example` as **reserved for Phase 2 only**. Nothing in this codebase reads it or calls Runway. Do not set it expecting any effect.

2. **Run the migration** — apply `supabase/migrations/0003_ad_studio.sql` (via the
   Supabase SQL editor, or `supabase db push` / your usual migration runner). It
   creates `brand_kits`, `ad_projects`, `ad_assets`, enables RLS with no policies
   (service-role-only access, same model as `0002_mavely_products.sql`), and seeds
   one default brand kit row.

3. **Create the Supabase Storage bucket** — buckets can't be created via plain SQL.
   In the Supabase Dashboard: **Storage → New bucket** → name it exactly `ad-studio`.
   Recommended: mark it **public** (Phase 1 render URLs are plain `getPublicUrl()`
   links with no signed-URL flow) or, if you'd rather keep it private, adjust
   `app/api/ad-studio/render/route.ts` to use `createSignedUrl` instead. Equivalent
   CLI command if you use the Supabase CLI locally:
   ```bash
   supabase storage buckets create ad-studio --public
   ```
   Or via the Management API:
   ```bash
   curl -X POST "https://api.supabase.com/v1/projects/<project-ref>/storage/buckets" \
     -H "Authorization: Bearer <management-api-token>" \
     -H "Content-Type: application/json" \
     -d '{"name": "ad-studio", "public": true}'
   ```

4. **Install dependencies** — `npm install` picks up the new packages (see below).

## Package additions

- `remotion`, `@remotion/player` — composition + in-browser preview (`Player` inside `app/ad-studio/new/page.tsx`).
- `@remotion/bundler`, `@remotion/renderer` — server-side bundling + rendering in `app/api/ad-studio/render/route.ts`.
- `@remotion/cli` (dev) — optional local Remotion Studio for authoring/debugging compositions (`npx remotion studio remotion/index.ts`).
- `@ffmpeg-installer/ffmpeg` — bundles a static ffmpeg binary. **Why this instead of a system `ffmpeg`:** Vercel's Node function runtime does not have ffmpeg preinstalled, and `@remotion/renderer`'s `renderMedia()` needs an ffmpeg/ffprobe binary to stitch frames into the final MP4. We point Remotion at it via the `binariesDirectory` option (`path.dirname(ffmpegInstaller.path)`), rather than assuming `ffmpeg` is on `PATH`. **Tradeoffs to be aware of:** this adds real weight to the `app/api/ad-studio/render` function's bundle (platform-specific ffmpeg binary + Remotion's Chromium-based renderer), which pushes toward Vercel's function size ceiling — watch the deploy output for size warnings, and if it becomes a problem, moving the render to a dedicated Node runtime target (already declared via `export const runtime = "nodejs"`) or splitting it into its own minimal function is the next step. `maxDuration` is set to 60s in the route (`export const maxDuration = 60`) to leave headroom under Vercel's function timeout, since Phase 1 renders are deliberately capped short (~15–30s output, simple image-based ads only).
- `vitest` (dev) — test runner; `npm test` runs `vitest run`.

## Files created / modified

**New library code:**
- `lib/ad-studio-types.ts` — shared types (product snapshot, concepts, scenes, brand kit, copy, project row).
- `lib/ad-studio-validation.ts` — zod schemas.
- `lib/ad-studio-serialize.ts` — camelCase → snake_case row mapping.
- `lib/ad-studio-supabase.ts` — re-exports the Mavely service-role client + table/bucket name constants.
- `lib/ad-studio-shopify.ts` — new Admin GraphQL `products` search query + snapshot mapping (nothing in `lib/mavely-shopify.ts` fetched products before this).
- `lib/ad-studio-concept-generator.ts` — deterministic concept generator (step 3).
- `lib/ad-studio-storyboard-generator.ts` — deterministic scene generator (step 4), including the Road Trip Rescue template.
- `lib/ad-studio-copy-generator.ts` — deterministic copy generator (captions, hooks, hashtags, etc.).
- `lib/ad-studio-fact-check.ts` — unsupported-claim heuristic + affiliate-disclosure logic + product-fact review builder.
- `lib/ad-studio-motion.ts` — pure CSS transform/filter math per motion effect.

**Remotion:**
- `remotion/index.ts` — bundler entry point.
- `remotion/Root.tsx` — registers the `AdVideo` composition with `calculateMetadata` (dynamic width/height/duration from aspect ratio + scenes).
- `remotion/AdComposition.tsx` — assembles all scenes into sequences with transitions.
- `remotion/MotionImage.tsx` — applies the chosen motion effect to a still image (or split-screen).
- `remotion/Overlays.tsx` — text overlay, benefit callout, price callout, discount badge, disclosure overlay, logo animation, title card, CTA card, transition wrapper.

**API routes:**
- `app/api/ad-studio/products/route.ts` — GET, live Shopify product search.
- `app/api/ad-studio/concepts/route.ts` — POST, generate concepts.
- `app/api/ad-studio/storyboard/route.ts` — POST, generate scenes + copy.
- `app/api/ad-studio/projects/route.ts` — GET (list), POST (create).
- `app/api/ad-studio/projects/[id]/route.ts` — GET, PATCH (full or partial update), DELETE (`?archiveOnly=true` or hard delete).
- `app/api/ad-studio/brand-kit/route.ts` — GET, POST (create/update the single Phase 1 brand kit).
- `app/api/ad-studio/render/route.ts` — POST, synchronous server render + Supabase Storage upload.

**Pages:**
- `app/ad-studio/page.tsx` — projects list (status, thumbnail, open/duplicate/archive/delete), mirrors `app/mavely/page.tsx`'s table pattern.
- `app/ad-studio/new/page.tsx` — the 9-step wizard (product select → audience → concept → storyboard → media/motion → brand → voice/music → preview → render/export), with localStorage draft safety net.

**Modified (small, additive changes only):**
- `components/AppShell.tsx` — added "🎬 Ad Studio" nav link.
- `app/mavely/page.tsx` — added a "Create Ad" link in the row actions, linking to `/ad-studio/new?mavelyId=<id>`.
- `.env.example` — documented `RUNWAY_API_KEY` as reserved/unused, noted Ad Studio reuses existing vars.
- `package.json` — new dependencies + `test` script.

**Migration:**
- `supabase/migrations/0003_ad_studio.sql` — `brand_kits`, `ad_projects`, `ad_assets` tables, RLS (service-role-only, no policies), triggers, and a seed row for the default brand kit.

**Tests:**
- `vitest.config.ts`
- `__tests__/ad-studio-concept-generator.test.ts`
- `__tests__/ad-studio-storyboard-generator.test.ts`
- `__tests__/ad-studio-fact-check.test.ts`

## Data model notes

- `ad_concepts` and `ad_scenes` are **not** separate tables. They're stored as
  `jsonb` (`selected_concept`, `scenes`) directly on `ad_projects`, because in this
  wizard a concept/storyboard is always generated, edited, and saved as one unit with
  its parent project — there's no independent lifecycle that would benefit from a
  join in Phase 1. This can be normalized later if a Phase 2 template library needs
  to query scenes independently of a project.
- `ad_assets` **is** a real table (uploaded/generated images, rendered MP4s), since
  individual files do have an independent identity (storage path, source type, scene
  linkage) — note that Phase 1 code doesn't yet write rows into `ad_assets` for
  uploaded images (there's no image-upload endpoint in Phase 1, only URL entry / picked
  Shopify/Mavely images); the render route does not currently insert an `ad_assets` row
  for the rendered MP4 either — the export URL is stored directly on `ad_projects.export_urls`.
  Wiring `ad_assets` inserts for both is a small, safe Phase 1.5 follow-up if you want
  a per-file audit trail.
- Skipped in this migration (documented reasoning): `AdTemplate` (no template library
  yet), `GenerationJob` / `RenderJob` (no async job queue — Phase 1 renders
  synchronously inside the API route), `CostRecord` (cost is always $0 in Phase 1,
  tracked as plain `cost_estimate`/`actual_cost` columns instead of a ledger).
- One default `brand_kits` row is seeded by the migration. The UI (`app/ad-studio/new/page.tsx`
  step 6) only manages that single kit today; the schema has no unique constraint
  forcing exactly one row, so it does support multiple kits for a future UI.

## Simplified / deferred motion effects

Implemented "for real" in Remotion (`lib/ad-studio-motion.ts` + `remotion/MotionImage.tsx`):
push in, pull out, pan (4 directions), Ken Burns, slight rotation, product
spotlight, masked zoom, split-screen.

Simplified, per spec:
- **Parallax** → combined pan + zoom. No true depth/layer separation (would need
  multiple image layers with per-layer motion, or actual depth estimation).
- **Product spotlight** → vignette + zoom-to-center. No subject/object detection.
- **Background blur** → simple CSS blur filter, no foreground/background split.
- **Foreground/background separation** → deferred/simplified; falls back to the Ken
  Burns transform. No image segmentation model is available/wired up in Phase 1.
- **Masked zoom** → zoom with a CSS `clip-path` rounded-rect mask (not a true
  alpha-mask compositing pipeline).

## What's deferred to Phase 2/3

- Real Runway integration (image-to-video animation). `RUNWAY_API_KEY` is declared
  but unused; the storyboard UI shows Runway as a disabled option with "Available in
  a future update."
- Voice-over and music generation + mixing. Step 7 only exports the voice-over
  script text; no audio is generated, uploaded, or mixed into the render.
- CapCut ZIP export.
- Template library (`AdTemplate` table/UI).
- Ad variations / A-B generation.
- Cost-control settings page (cost is hardcoded to $0 everywhere in Phase 1).
- Analytics on ad performance.
- Zendrop dashboard entry point and a live Shopify product-list page entry point —
  neither of those pages exist yet in this app, so only the Mavely dashboard
  ("Create Ad" link) and a fresh Ad Studio nav entry (`/ad-studio/new`, with its own
  live Shopify search) are wired up as entry points.
- True foreground/background image segmentation and true multi-layer parallax (see
  above).

## Manual test plan — DIY Coloring Blanket / Road Trip Rescue

This exercises the full spec test case. Requires `NEXT_PUBLIC_SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` set, the migration applied, the `ad-studio` bucket
created, and (for live Shopify search) `SHOPIFY_STORE_DOMAIN` / `SHOPIFY_ADMIN_ACCESS_TOKEN`.

1. In Mavely (`/mavely/new`), add a product titled something like "DIY Coloring
   Blanket" with tags including `kids`, `travel`, `coloring`, a price, and at least
   2-3 image URLs. Save it.
2. From `/mavely`, click **Create Ad** on that row. You should land on
   `/ad-studio/new?mavelyId=<id>` with the product pre-filled (title, images, price,
   `isAffiliate` checked, retailer info).
3. Step 2 (Audience): pick **Parents**.
4. Step 3 (Concept): click **Generate concepts**. Confirm at least 5 concepts appear
   and one has type "Road-trip/travel use case" titled "Road Trip Rescue" (this is
   guaranteed for any kids+travel-tagged product, not hardcoded to one literal
   product — see `lib/ad-studio-concept-generator.ts`'s `isTravelRelevant` check).
   Select it.
5. Step 4 (Storyboard): confirm 6 scenes generate matching the spec order (bored
   kids in car → parent reveals blanket → kids coloring together →
   product/artwork close-up → resting scene phrased as "peaceful", not causal sleep
   language → product hero + CTA). Edit on-screen text if desired; try reorder/duplicate/remove.
6. Step 5 (Media & Motion): set aspect ratio to **9:16**. Confirm each media scene
   has a still-image motion effect assigned (at least 5 of 6, per spec) — defaults
   are pre-assigned by the generator, but you can change them via the dropdown.
7. Step 6 (Brand): confirm the default Fort Crazypants Brand Kit loads; edit colors/
   logo/CTA text if desired; save.
8. Step 7 (Voice & Music): confirm the "coming in a future update" copy and that the
   script export textarea shows all 6 scenes' lines.
9. Step 8 (Preview): confirm the Remotion Player preview plays through all 6 scenes
   with motion, text, and the CTA card.
10. Step 9 (Render & Export): confirm the product-fact review shows imported facts,
    flags any unsupported claims (there shouldn't be any for a clean description),
    shows the affiliate disclosure notice (since this came from Mavely), check "I've
    reviewed and approved these claims", then click **Render ad**. This calls the
    real `@remotion/renderer` + ffmpeg pipeline and uploads to Supabase Storage —
    **this step needs live Supabase credentials and cannot be exercised in this
    sandbox** (no real credentials exist here). Confirm the response is a playable
    MP4 URL and that `/ad-studio` lists the project as "Complete" with a Download link.

## Known manual-testing gaps (not exercised in this sandbox)

No live Shopify or Supabase credentials exist in this build environment, so the
following were verified only by code review / typecheck, not by actually running
them end-to-end:
- Live Shopify product search (`lib/ad-studio-shopify.ts` / `app/api/ad-studio/products`).
- Supabase reads/writes for `ad_projects` / `brand_kits` / `ad_assets`.
- The actual `@remotion/renderer` render + ffmpeg stitching + Supabase Storage upload
  (`app/api/ad-studio/render/route.ts`) — this is the biggest risk area to test first
  once credentials exist, given Vercel function size/timeout constraints noted above.
- The Remotion Player in-browser preview rendering real product images (only
  verified against the composition compiling/typechecking correctly).

## Test results (this build)

- `npx tsc --noEmit -p .` — passes for all Ad Studio code. Two pre-existing type
  errors remain in `components/ProductStudio.tsx` and
  `components/ProductStudio.phase1-backup.tsx` — confirmed via `git stash` that both
  errors exist on a clean checkout of `main` (commit `e9e1e4b`) before any Ad Studio
  changes, so they are out of scope for this task and were left untouched per the
  "do not modify Product Studio" constraint.
- `npm test` (`vitest run`) — 12/12 tests passing across 3 files (concept generator,
  storyboard generator, fact-check heuristic + affiliate disclosure).
