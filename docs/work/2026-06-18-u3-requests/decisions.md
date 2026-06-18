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
_(none yet)_
