# U3 — Requests · decisions log

Created at /dev start. One entry per spec gap / decision-gate fire.

## Classification
**Standard** — new screen + route promotion; no auth/payment/schema/migration. Workflow:
plan → dev → validate → ship → review → premerge.

## Pre-committed decisions (from /plan + advisor)
1. **Mock-first, display-led** (mirrors U1/U2). Local typed `requests` array drives the
   `.reqcard` list; exactly one Matched card's "Buy" is wired to the live mock listing via
   `loadListingFlowView` + `isLiveResale`. No `AlertRequest`/`Want` schema (Codex owns that).
2. **Scope = frame 04 (Requests landing) only.** Create-Request (03) and Alert-payoff/Match
   (05) are separate screens / later waves.
3. **Forward CTAs stay display-only `<button>`** ("New", Edit, Pause, "See referrals") — no
   routes invented, so `verifyRouteCoverage` stays green. Only the Matched "Buy" →
   `/app/listings/:id` is a real (resolving) link.
4. **Proactively make `ui-smoke-buyer.mjs` data-driven** in Task 3 (it sits at 35.3% overall
   duplication; SonarCloud's new-code dup gate is the only check not runnable locally and bit
   U2 twice). Mirrors the `verify-first-visible-slice.mjs` fix; defuses U4–U7 too.
5. **Fold U2 review lessons in up front:** `should…when…` test names; `Number.NaN`/
   `Number.isNaN` in guards; all non-nav controls `<button type="button">`; `.reqcard` list
   via `.map`, not hardcoded markup.
6. **No new component CSS** — every Requests class exists in the F1 port (global.css 227-229,
   349-360, 418-437). Only an additive bronze entrance choreography scoped to `/app/requests`.

## Decisions (filled during /dev)

### Decision 1 — slim ui-smoke-buyer.mjs needles (exit-review finding)
**Date:** 2026-06-18 · **Task:** 3/5 · **Score:** 3/14 (PROCEED) · **Status:** RESOLVED
**Gap:** The /dev exit review (duplication lens) found that the new data-driven
`routeChecks` array in `ui-smoke-buyer.mjs` re-asserted the SAME full per-route copy
that `verify-first-visible-slice.mjs` (`routeContentChecks`) already checks — producing
long verbatim cross-file runs (notably an 11-line `/app/search` block). Because the file
was rewritten, those are "new" lines; SonarCloud's new-code duplication gate (the one
check not runnable locally, doesn't parse `.astro`) could trip — the exact U2 trap. No
`sonar-project.properties`/workflow sonar step exists (Automatic Analysis), so a CPD
exclusion isn't reliably settable from the repo; a shared-needle module is invasive
because the two scripts assert intentionally different lists.
**Choice:** Trim ui-smoke to a true smoke check — a few route-distinctive,
confirmed-rendering needles per route (each list starts with the route-unique
`data-route-id`, so no 10+ line run can form) plus the full forbidden-term sweep. The
exhaustive content contract stays in verify-acceptance (incl. the 9 `/app/requests`
needles). Correct separation of concerns (smoke = render signal; acceptance = contract),
lowest-risk certain fix, touches only the file U3 owns. Re-ran buyer smoke → 7 routes pass.

### Exit-review summary (5 lenses, adversarially scoped)
- Spec fidelity: faithful; 2 benign minors (—"Free plan" rendered in `.qtop` not `.qsub`;
  `bolt` glyph used since the sprite has no `i-bolt-last` — code correct). No change needed.
- a11y/CodeRabbit: clean (all non-nav controls `<button type="button">`, no unused imports,
  `should…when…` test names, `Number.NaN` guards, `.map`-rendered cards, no `key=`).
- Duplication/correctness: helper logic verified test-by-test; the one MAJOR (above) fixed.
- Copy discipline: clean (no banned terms, zero exclamations on frame 04, honest referral,
  rose only on the Buy action, no Create-Request/Match-screen scope leak).
- Route-promotion integrity: empirically consistent — verify 18 routes, buyer smoke 7,
  no vacuous passes; `dist/app/requests/index.html` present.
