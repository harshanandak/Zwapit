# U7 — Create Request / Set an alert (v5)

- **Slug:** u7-create-request
- **Date:** 2026-06-19
- **Status:** planned
- **Branch / worktree:** `feat/u7-create-request` · `.worktrees/u7-create-request`
- **Classification:** Standard (new screen + route promotion + rewire entry CTAs; additive; no auth/payment/schema/route-removal)

## Purpose

Build the v5 **Create Request / "Set an alert"** screen at `/app/requests/new` and wire the entry
points to it. This is the product's primary action — "tell us what you want" — that feeds the
Requests tab (U3). One scrolling screen with a Category → Item → Budget → Alerts step strip,
bronze accent. Mock-first/display-led: real catalog search (TMDB/events/bus), the want-creation
mutation, and matching are backend (Codex) / internal-only and out of scope. UI locked to spec §3
(`alerts-requests-screen-spec.md`).

## Success criteria

1. `/app/requests/new` renders the v5 §3 screen (bronze) in order: `.pbar`/topbar "Set an alert" →
   step strip `.steps`/`.step`/`.step-ln` (Category → Item → Budget → Alerts) → Category `.tiles`
   (Movie/Event/Bus/Voucher/Pass, one `.tile.sel`) → catalog `.searchbar` + `.catres` result rows
   (one `.catres.sel` with a canonical detail line) → social-proof `.buyerwait` ("You + 124 others
   waiting for this show" + "One alert, shared by everyone watching this show.") → Budget `.formrow`s
   with `.stepper`s (Max price per ticket, Tickets) + an "Alert me until" expiry row → Alerts toggle
   list (`.chan-row`: Availability/Discount/Price-drop/Last-minute, each with a one-line benefit) →
   reassurance `.note` ("booking is never guaranteed") → sticky "Create request & alert me".
2. `/app/requests/new` promoted to a real contract route: added to the acceptance `routes` table +
   `routeContentChecks` + `IMPLEMENTATION_CONTRACT.md` + buyer smoke. (`knownForwardRoutes` is empty
   since U6, so the route MUST be in the contract for the rewired CTAs to pass route-coverage.)
3. Entry CTAs rewired to `/app/requests/new`: home "Create a request" (req-cta) + home empty-state
   "Create a request" + search empty-state "Create a request instead" + the Requests "New" button
   (currently display-only → becomes a real link). The home bell-nav stays on `/app/requests` (list).
4. Light interactivity (mock, no persistence): category tiles select (`.sel`), alert toggles
   (`aria-pressed`), and budget/quantity `.stepper`s adjust — via a small null-guarded client script
   mirroring the Sell screen. The "Create request & alert me" CTA navigates to `/app/requests`
   (mock "created" — no real want-creation mutation; matching/allotment is internal-only).
5. a11y from the start: category tiles, alert toggles, steppers, and "Set an alert" back control are
   `<button type="button">` (steppers labelled); the only `<a>` are real links (the CTA →
   `/app/requests`, the back → `/app/requests`). Bronze entrance choreography on `/app/requests/new`.
6. All gates green: astro check, build, bun test, acceptance, buyer + seller smoke, route-coverage,
   audit. Copy exclamation-free except the allowed contexts; no banned terms.
7. **No new component CSS** — every §3 class (`.steps .step .step-ln .tiles .tile .searchbar .catres
   .buyerwait .formrow .stepper .chan-row .note .stickybar .btn-primary`) already exists in the F1
   port (+ `.chan-row` added in U6). `i-zap` substitutes for the spec's `i-bolt-last`.

## Out of scope (backend / later waves)
- Real catalog search / canonical item resolution (TMDB for movies, curated events/bus) — the
  catalog rows are mock content; the searchbar is a display element.
- The real want-creation mutation + matching/allotment (internal-only, audited — Codex/Convex).
- Real expiry/date picker, real budget validation against catalog price caps.
- The Alert-payoff/Match screen (§5) and Plans (§10).

## Approach
Mirror U5/U6: a self-padded v5 screen under `AppShell routeId="/app/requests/new" hideHeader` (navMap
resolves it to the requests tab + bronze + no FAB via `isUnder("/app/requests")`). Add
`src/pages/app/requests/new.astro` alongside the existing flat `requests.astro` (Astro coexists a
page file with a same-named dir — no move). Light client interactivity mirrors the Sell screen's
stepper/toggle pattern (null-guarded). Promote the route + rewire the 4 entry CTAs.

## Edge cases (decided)
- **Route structure:** keep `src/pages/app/requests.astro` flat; add `src/pages/app/requests/new.astro`
  (coexistence). If the build rejects coexistence, fall back to converting to `requests/index.astro`.
- **Mock submit:** "Create request & alert me" → `/app/requests` (no mutation). Avoids a submit
  click-path test; the interactivity is visual-only.
- **Steppers:** budget + quantity clamp to sensible minimums (≥0 / ≥1), `Number`-safe, like Sell.
- **Empty `knownForwardRoutes`:** every rewired CTA points at `/app/requests/new` (now a contract
  route) — route-coverage stays green.
- **Copy:** "You + 124 others waiting for this show" is the people-looking signal (no buyer identity).
  No banned terms; the one allowed exclamation rule isn't triggered here.

## Ambiguity policy
7-dimension rubric per the /dev decision gate. ≥80% confidence → proceed + document; <80% → stop and
ask. Locked to §3; gates should be rare.

## Technical Research
- **DRY (verified):** `.steps`/`.step`/`.step-ln` (369-375), `.tiles`/`.tile`/`.tile.sel` (377-382),
  `.searchbar` (255), `.catres`/`.catres.sel` (363-368), `.buyerwait` (279-282), `.formrow`/`.stepper`
  (383-387), `.chan-row` (628, U6), `.note` (464/620), `.stickybar` (465-469), `.btn-primary` (233) all
  exist → reuse, no new CSS.
- Icons all in IconSprite (film/music/bus/voucher/pass/bell/tag/drop/zap/people/clock/back/search/
  minus/plus/check). Use `i-zap` for last-minute (no `i-bolt-last`).
- `navMap.resolveNav("/app/requests/new")` → requests tab, bronze, FAB hidden (sub-path) — no change.
- **Route-promotion blast radius:** add `/app/requests/new` to routes[]/routeContentChecks/contract/
  buyer-smoke; rewire 4 CTAs (home ×2, search ×1, requests "New"). No navMap/knownForwardRoutes change
  beyond the route being in the contract.
- **OWASP:** static SSR + a small client script that toggles classes / steps numbers (no network,
  no persistence, no auth/payment surface). A03 — Astro auto-escapes; the searchbar is a display
  element (no user input wired). A10 — no external calls. No applicable risk introduced.
- **TDD scenarios:** (1) acceptance: `/app/requests/new` renders "Set an alert", Category, Movie,
  Max price per ticket, Availability, "Create request & alert me" (RED before the page → GREEN
  after); (2) route-coverage: the rewired CTAs resolve to the new contract route; (3) buyer smoke:
  data-route-id + distinctive needles.
