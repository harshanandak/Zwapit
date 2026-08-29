# Catalog backlog drain — final plan (post 4-model loop, egress approved)

**Date:** 2026-08-26 · **Kernel:** 2427bbc4 · **Harsha approval:** egress spend OK (option A)
**Design source:** 4-model convergence (Sol 8/10 for DeepSeek's dual-mode; DeepSeek's own
plan; GLM adaptive-only; Muse both-with-chunks). Synthesis: **adaptive inside the existing
action + chunked fetch waves**, cron untouched.

## Design

- `crawlBmsMovies` keeps its `{limit}` arg. Adaptive rule: if the stored-movie count
  (getMovieSyncState length) is below `BOOTSTRAP_THRESHOLD = 500`, effective limit becomes
  `max(limit, BOOTSTRAP_LIMIT = 250)` — cold-start drains ~20 days instead of 196; once
  warm, cron's 25/day applies unchanged.
- Detail-fetch happens in **chunks of 25** (sequential waves, one upsert per wave) so a
  mid-run failure preserves prior waves (paid egress never discarded) and Convex action
  wall-clock stays safe.
- Result object extended (additive): `remaining` — count of delta items not yet hydrated,
  giving ops visibility for follow-up invocations.
- No new action, no schema change, cron unchanged (still passes `{limit:25}`; adaptive
  overrides only during bootstrap).

## TDD

RED (new `catalogCrawl.test.ts`, extractor stubbed): zero stored movies + 60 delta →
effective limit 250, waves of 25, `remaining` reported. GREEN: implement.

## Out of scope

One-off live run orchestration beyond a single post-merge invocation (idempotent by
lastmod diff; re-run safe). startAt consistency. Posters.
