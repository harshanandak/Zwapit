# Watch-date validation + catalog bootstrap slice — FINAL plan (v2, post cross-rating)

**Date:** 2026-08-26 · **Kernel:** 1a6575c7 (past dates), 2427bbc4 (backlog), ff3e0a5a (chase test)
**Planning loop:** R1 independent plans (Sol ✓, Muse ✓, GLM-5.3-ocgo ✓, DeepSeek-pro-ocgo ✓) →
R2 cross-ratings (Sol rated DS 8/GLM 6; Muse rated GLM 9/DS 7) → this synthesis.
Boundary decision: **UTC end-of-day (default A)** — matches existing `endOfWatchDay` grace
(watcher.ts ~L959), one time basis in the codebase.

## Consensus adopted from raters

- Chase sorting is ALREADY descending — only the regression TEST is weak (Codex/DSPro/GLM all caught the stale premise)
- Wall-clock date-granular past check; `startAt` rejected by everyone (crawled movies never set it)
- Backfill = separate resumable internalAction + keep daily cron at 25; metrics returned as action result, NO schema change (Sol's requirement)
- Client swallow fix included in-slice (Muse's find: createAlert.ts:171 returns ok:true mock on any throw)
- GLM's audit_logs-per-run idea DEFERRED (needs new entityType migration; result-counts suffice)

## Tasks

### T1 — Past watch date rejection
RED: yesterday → WATCH_DATE_IN_PAST; today → ok; malformed → ALERT_DATE_INVALID (unchanged).
GREEN: pure helper `isPastAlertDate(date, nowIso)` in parse.ts (UTC end-of-day grace:
`date === todayUtc` passes); `normalizeAlertInput(args, nowIso)` threads clock from caller;
createAlert computes nowIso before validation. Fixtures: shared `WATCH_DATE = now+30d`
replaces static literals in watcher.test.ts + watcher.e2e.test.ts (~34 sites); expiry tests
keep direct DB inserts. Client: src/lib/ui/createAlert.ts propagates errors instead of
ok:true mock; src/pages/app/requests/new.astro enforces date floor at pickup source.

### T2 — Chase test strengthening (do BEFORE T3 verification per Sol's order)
Two general windows BOTH inside 24h lookback; assert later wins. If it fails, sort is broken
(contradicts current read; would be caught here).

### T3 — BackfillBmsMovies internalAction
`backfillBmsMovies({ limit, maxPages })`: bounded batches of 25 sequential extracts,
resumable via existing lastmod diff, no-op without PARALLEL_API_KEY, returns
{ scanned, hydrated, created, updated, remaining }. Daily cron UNCHANGED at {limit:25}.
No-op chase-sort changes (verify-first already done).

### T4 — Documentation sync
AGENTS.md runbook gains nothing; but catalogCrawl.ts header comment documents the
adaptive strategy decision (rejected: permanent capacity ladder) and egress math
(~$0.50 one-time at $0.0001/extract × ~4900).

## Acceptance

1. parse.test.ts chase windows inside lookback; reversing sort FAILS the suite
2. Past-date rejection before any write; same-day passes UTC grace
3. bun test full green (target ≥371); both tsc gates clean
4. No schema changes; no api.d.ts regen expected

## Out of scope

Backlog drain live-run (ops decision for Harsha after merge) · startAt consistency ·
max-future-date policy · injectable prod clock · IST semantics migration.
