# Catalog backlog drain — final plan (post 4-model loop, egress approved)

**Date:** 2026-08-26 · **Kernel:** 2427bbc4 · **Harsha approval:** egress spend OK (option A)
**Design source:** 4-model convergence (Sol 8/10 for DeepSeek's dual-mode; DeepSeek's own
plan; GLM adaptive-only; Muse both-with-chunks). Synthesis: **adaptive inside the existing
action + chunked fetch waves**, cron untouched.

## Design

- `crawlBmsMovies` keeps its `{limit}` arg. While the lastmod delta is larger than the
  requested maintenance limit, the effective limit becomes
  `max(limit, BOOTSTRAP_LIMIT = 250)`. Bootstrap remains active until the backlog fits in
  one maintenance run; the cron then applies its unchanged 25-item limit.
- Detail-fetch happens in **chunks of 25** (sequential waves, one upsert per wave) so a
  mid-run failure preserves prior waves (paid egress never discarded) and Convex action
  wall-clock stays safe.
- Result object extended (additive): `remaining` — count of delta items not yet hydrated,
  giving ops visibility for follow-up invocations.
- No new action, no schema change, cron unchanged (still passes `{limit:25}`; adaptive
  overrides only during bootstrap).

## TDD

RED (new `catalogCrawl.test.ts`): a 4,900-item and later 4,400-item backlog both select
250; a 25-item delta returns to maintenance mode; fetch inputs split into waves of 25;
invalid limits fail before the missing-key no-op. GREEN: implement against exported
production decision helpers and the action handler.

## Security

- Outbound requests are limited to the fixed BookMyShow sitemap URL and the fixed Parallel
  Extract endpoint; sitemap-provided detail URLs are sent to Parallel, not fetched directly
  by Convex. This preserves the existing provider boundary and avoids adding arbitrary
  server-side fetch inputs.
- `PARALLEL_API_KEY` remains in Convex environment configuration and is used only in the
  authorization header. It is never returned, logged, stored in catalog rows, or included in
  failure messages.
- Provider errors expose only the Parallel HTTP status. Response bodies are not surfaced,
  preventing upstream content or credentials from leaking through action errors.
- Alternative rejected: a client-callable or arbitrary-URL backfill endpoint. The crawler
  remains an `internalAction` with fixed sources to avoid SSRF and unbounded user-triggered
  egress.

## Out of scope

One-off live run orchestration beyond a single post-merge invocation (idempotent by
lastmod diff; re-run safe). startAt consistency. Posters.
