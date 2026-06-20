# Convex Search read-model (official catalog) · design

**Slug:** convex-search-readmodel · **Date:** 2026-06-20 · **Branch:** feat/convex-search-readmodel
**Status:** in review · **Classification:** backend data + read-model (done solo + convex-reviewer; Codex rate-limited until 2026-07-18).

## Purpose

Second real-data slice. Wire the **Search** screen to real Convex data: the **official**
results from a new `catalog_items` read-model, the **community** results from the existing
`getHomeListings` (reused from the previous slice). Also seeds the foundational
`catalog_items` table — the canonical-item infra that **Requests** (`wants.catalogItemId`)
will build on next.

## What changed

- **Backend — `convex/seed.ts`:** new `seedCatalogItems(ctx)` helper + `CATALOG_ITEMS`
  (Oppenheimer movie/tmdb, Alan Walker live_event/manual, Bengaluru→Goa bus_route/manual).
  Idempotent by `catalogKey`. Called as a **bare statement** (`await seedCatalogItems(ctx)`,
  no `if`) so the seed handler gains no branch — avoids re-tripping S3776 (the handler is
  at the complexity limit). Deterministic `lastSyncedAt` constant.
- **Backend — `convex/catalog.ts` (new):** `getOfficialCatalog` query → active catalog
  items via `catalogDocToMock` (read-only; "Notify me" arming is an internal-only mutation,
  not exposed).
- **`functionRefs.ts`:** `getOfficialCatalog` ref.
- **`dataAdapter.ts`:** `loadOfficialCatalog()` (Convex + mock fallback = a single
  Oppenheimer sample) with the same shape-guard pattern as `loadCommunityListings` (falls
  back when empty or rows lack a string `title`). New `OfficialCatalogItem` type.
- **`search.astro`:** official rail maps `loadOfficialCatalog()`; community maps
  `loadCommunityListings()` (reused); `resultCount = official.length + community.length`.
  "Notify me" stays display-only.

## Dual behaviour

- **Convex configured** (local `.env.local`, CI Cloudflare preview/prod): 3 official + 5
  community = **8 found**.
- **No `PUBLIC_CONVEX_URL`** (regular CI): mock fallback → 1 official (Oppenheimer) + 1
  community (Arijit) = **2 found**. Both halves still render; all gates pass.

## Verification

- Convex path: build 0/0 22 pages; search renders Oppenheimer + Alan Walker + Bengaluru→Goa
  + Arijit + "Notify me" + "Seller price"; **8 found**; acceptance + route-coverage (18) +
  smoke (11) + `bun test` green.
- Mock path: build 0/0 18 pages; Oppenheimer + Arijit + Notify me + Seller price; **2 found**;
  all gates green.
- convex tsc 0. Dev deployment: pushed via `npx convex dev --once`; `getOfficialCatalog`
  returns the 3 items. Production untouched.
- Needle change: dropped the env-dependent `"2 found"`; both halves still asserted
  (Oppenheimer + Arijit + Notify me + Seller price) in verify + smoke.

## Out of scope / notes

- Official "Notify me" arming (availability alert) is internal-only/audited — display-only here.
- Real text search + filtering (category tabs, filter chips, All/Official/Community seg) stay visual.
- Requests slice will add a few `wants`-referenced catalog rows; the table + helper + query
  pattern are the reusable asset this slice front-loads.
- Seeded to **dev only**; production catalog is empty until a deliberate prod deploy + seed.
