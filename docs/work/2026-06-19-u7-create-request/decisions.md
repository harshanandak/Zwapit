# U7 — Create Request / Set an alert · decisions log

## Classification
**Standard** — new screen + additive route promotion + rewire entry CTAs; no auth/payment/schema/
route-removal. Workflow: plan → dev → validate → ship → review → premerge.

## Pre-committed decisions (from /plan orientation)
1. **Route:** `/app/requests/new`, added as `src/pages/app/requests/new.astro` alongside the flat
   `requests.astro` (Astro coexists a page file with a same-named dir — no move). Fallback: convert
   to `requests/index.astro` if the build rejects coexistence.
2. **Mock-first submit:** "Create request & alert me" is a plain `<a href="/app/requests">` — no real
   want-creation mutation (that's internal-only/audited backend per CLAUDE.md; matching/allotment is
   never a client mutation). Avoids a submit click-path test.
3. **Light interactivity (mock):** category-tile select, alert toggles (aria-pressed), and budget/qty
   steppers work client-side (null-guarded, mirrors the Sell screen) but persist nothing.
4. **Rewire 4 entry CTAs** to `/app/requests/new`: home "Create a request" (req-cta) + home
   empty-state "Create a request" + search "Create a request instead" + the Requests "New" button
   (display-only → real link). Keep the home bell-nav on `/app/requests` (the list). Required because
   `knownForwardRoutes` is empty (U6) — every link must resolve.
5. **No new component CSS** — every §3 class exists (`.steps`/`.step`/`.step-ln` 369-375, `.tiles`/
   `.tile` 377-382, `.searchbar` 255, `.catres` 363-368, `.buyerwait` 279-282, `.formrow`/`.stepper`
   383-387, `.chan-row` 628, `.note`, `.stickybar` 465-469). `i-zap` for last-minute. Only an additive
   bronze entrance line for `/app/requests/new`.
6. Out of scope: real catalog search (TMDB/events/bus), the want-creation + matching mutations, real
   date/budget validation, the Alert-payoff screen (§5), Plans (§10).

## Decisions (filled during /dev)

### Exit-review (4 lenses) — outcome
- Spec fidelity: faithful, microcopy verbatim; 2 cosmetic nits left (Dune mock embellishment; in-flow
  CTA + `i-zap` + inline note — all documented deviations).
- a11y/correctness: script has no throw paths (null-guarded steppers/selects). Two LOW fixes applied:
  - Invalid HTML nesting — the `.catres` catalog rows are `<button>`s; their `.tx` was a `<div>` (flow
    content in a button). Changed `.tx` to a `<span>` (all-phrasing → valid; CSS/layout unchanged).
  - Single-select a11y — category tiles + catalog rows now carry `aria-pressed`, synced in
    `singleSelect` (the alert toggles already had it).
- Route/CTA integrity: CLEAN — flat `requests.astro` + `requests/new.astro` both build; 4 CTAs rewired;
  no dangling links (knownForwardRoutes empty); 16 routes, 171 tests.
- Duplication/copy: CLEAN — verify/smoke additions are single-line; no forbidden terms (no "Sales"/
  "queue"/"#N"), no stray exclamations; social-proof exposes no identity/budget/queue number.
