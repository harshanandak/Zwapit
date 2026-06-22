# Phase 1 — BMS movie-catalog ingestion · design

Implements the movie half of `docs/work/2026-06-20-catalog-data-maps-research/catalog-sitemap-ingestion-spec.md`.

## Goal
Populate `catalog_items` (kind=movie) from BookMyShow's national `movies-synopsis.xml` sitemap —
incrementally (by `<lastmod>`), idempotently (upsert by ET code), with free posters (bmscdn image code).

## Architecture (key constraint)
BMS 403s datacenter IPs, and **Convex actions also egress from datacenter** → the crawler CANNOT run
inside Convex. Split:
- **External crawler job** (egress = residential/Parallel.ai): fetch sitemap → parse → lastmod-diff →
  hydrate deltas → call the Convex internal mutation. Lives outside Convex; egress is a pluggable fn.
- **Convex internal mutation** `catalog:upsertMoviesFromSource` (internalMutation — NOT client-exposed,
  per CLAUDE.md "internal functions for sensitive operations"): receives parsed+hydrated rows, upserts
  into `catalog_items` by `(externalSource, externalId)`.
- **Pure shared module** (`src/lib/catalog/bmsSitemap.ts`): parse XML → entities; lastmod-diff. No I/O →
  unit-testable now, no egress.

## Data shape
`catalog_items` already has: catalogKey, kind, externalSource, externalId, title, subtitle, city,
venueOrDestination, startAt, imageUrl, isActive, lastSyncedAt. **Add `sourceLastmod: v.optional(v.string())`**
for the incremental diff. Movie rows: kind="movie", externalSource="bookmyshow", externalId=ET code,
catalogKey=`bms_<ETcode>`, title, imageUrl=bmscdn poster, isActive=true, sourceLastmod=`<lastmod>`.

## Pipeline
1. Fetch `in.bookmyshow.com/sitemap/movies-synopsis.xml` (external, residential egress).
2. `parseMoviesSitemap(xml)` → `[{ eventCode, slug, loc, lastmod }]` (ET code from URL).
3. `diffByLastmod(parsed, existing)` → entities new or with `lastmod > stored sourceLastmod` (to hydrate).
4. Hydrate each delta (external): title (eventName) + image code → `in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/<code>.jpg`.
5. Call `catalog:upsertMoviesFromSource` with the hydrated rows → idempotent upsert.
6. Disappearance: ET codes absent for ≥N runs → isActive=false (separate, later).

## Out of scope (this phase)
Events + District + cross-source dedup (Phase 2). Live hydration egress wiring (Parallel key) — built
behind a pluggable fetch; this phase ships the parser, diff, schema, internal mutation, and the crawler
harness with a stub egress + fixtures. The frontend Search/Request wiring lands once rows exist.

## Verification
- `bun test` the pure module (parse + diff) against a fixture sitemap snippet.
- Deploy schema (`sourceLastmod`) to dev; probe `upsertMoviesFromSource` with sample rows → catalog row.
- Live BMS run deferred until the residential/Parallel egress is wired.

## OWASP / safety
Internal-only upsert mutation (no client exposure); no PII (public movie metadata); external input is
BMS XML → parse defensively (validate ET-code regex, ignore malformed `<url>`); crawler egress isolated
from the app. Frontend never calls BMS.
