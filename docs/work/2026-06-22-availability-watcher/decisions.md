# Decisions — Official-Availability Watcher

Builds on the catalog-data-maps research decisions D1–D5 (`../2026-06-20-catalog-data-maps-research/decisions.md`).

## D6 — Convex cron over n8n for watcher orchestration (2026-06-22)
The watcher loop (schedule → fetch via Parallel → parse → diff → notify) runs **entirely in Convex** (cron + internal action + mutations), not n8n. Rationale: cost is ~$0 either way at MVP scale (Parallel calls dominate the bill), but Convex keeps `monitor_targets` state co-located, removes the n8n↔Convex sync surface, and is one system to run. n8n stays available as a fallback if the watcher is ever decoupled. The IP-block concern is moot — Parallel does the outbound fetch, so Convex only calls `api.parallel.ai`.

## D7 — Extend existing tables, don't duplicate (2026-06-22)
DRY review of `convex/schema.ts`: `catalog_items`, `wants`, `want_matches`, `audit_logs` already exist. The watcher **extends** them (source-code fields on `catalog_items`; alert fields on `wants`; new `audit_logs.entityType` values) and adds only the genuinely-new engine tables (`monitor_targets`, `availability_events`, `notification_queue`, `source_snapshots`). We do **not** perform the full `wants → alert_requests` rename from the 2026-06-12 design in this slice — that is a separate migration.

## D8 — Both sources unioned, parsed differently (2026-06-22)
Per D5, BMS and District are both first-class. BMS is parsed as clean JSON (`byvenue`/`byevent`), District as rendered text (`movie-in-city` page) — both normalized to one `NormalizedShow` shape behind `unionAndDedupe`. A show is "live" if open on **either** source. District contributes booking-open + theatre + showtime + format (no per-show fill-status); BMS contributes fill-status.

## D9 — Watcher is internal-only, non-load-bearing, deep-link-OUT (2026-06-22)
All monitor/availability/notification mutations are `internal*` (never client-callable); every transition is audited. On source block/shape-change a target degrades to community-resale + admin + deep-link fallback. Zwapit never books or holds official inventory; the payoff is always a deep-link to the official site.
