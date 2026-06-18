# U3 — Requests tab (v5)

- **Slug:** u3-requests
- **Date:** 2026-06-18
- **Status:** planned
- **Branch / worktree:** `feat/u3-requests` · `.worktrees/u3-requests`
- **Classification:** Standard (new screen + route promotion; no auth/payment/schema)

## Purpose

Build the v5 **Requests** screen at `/app/requests` (currently a known-forward 404) and
promote it to a real contract route. Requests is the product's primary surface — the list of
"tell us what you want" alerts a user has set, with their state (Active / Matched / Purchased
/ Expired), the alert types armed on each, a match signal, and the alert-wave priority. It is
the landing screen (preview frame "04 · Requests"), bronze accent `#C98B5F`.

Mock-first and display-led, exactly like U1/U2: the only wired datum is one **Matched**
request whose "Buy" links to the live mock listing (`loadListingFlowView` → `isLiveResale`).
The Create-Request flow (frame 03), the Alert-payoff/Match screen (frame 05), real request
state, quota enforcement, referrals, and tiers are backend (Codex) / later waves and out of
scope here.

Builds on F1 (design system) + U1 (Home/Listings helpers) + U2 (Search helpers/pattern). UI
locked to the build-ready spec `docs/work/2026-06-12-ui-revamp/alerts-requests-screen-spec.md`
§4 and design.md §5/§7.

## Success criteria

1. `/app/requests` renders the v5 Requests screen (bronze) in spec §4 order:
   `.home-top` "Your requests" + display-only "New" → `.quota` meter ("2 / 3 active requests",
   thin track fill, "Free plan" sub) → state-filter `.seg` (Active / Matched / Purchased /
   Expired) → a `.reqcard` list (mapped from a mock array; the Matched one is `.reqcard.hot`)
   → the soft `.nudge` referral card ("Invite 3 verified friends → one extra request and
   earlier alerts." / "See referrals").
2. `/app/requests` promoted to a real contract route: removed from `knownForwardRoutes`, added
   to the acceptance `routes` table + `IMPLEMENTATION_CONTRACT.md` + route-coverage + buyer
   smoke, with mustContain assertions. Requests tab lights up (bronze); Sell FAB shown.
3. Each `.reqcard` renders from a typed mock array via `.map` (no hardcoded near-identical
   cards): state chip via `requestStateMeta(state)` (Active→`chip req`, Matched→`chip live`,
   Purchased→`chip protect`, Expired→`chip mut`), catalog title + venue/date `.sub`, a
   `.reqmeta` row (budget "Up to ₹420" via `formatInr` + `.alertglyphs` with armed types lit),
   a `.matchrow` ("N matches this week" + `.wave-pill` Standard/Priority/High), and
   `.reqactions` (Edit / Pause as `<button type="button">`).
4. One **Matched** card is wired: its `.matchrow .buy` is a real link to the live mock listing
   (`/app/listings/:id` from `loadListingFlowView` + `isLiveResale`). Discount-integrity holds
   (no "% off" without a verified original price). All other cards are display content.
5. `requestQuota(used, total)` and `requestStateMeta(state)` — small, tested pure helpers:
   - `requestQuota(used,total)` → `{ label: "2 / 3 active requests", percent: <0–100 clamped> }`;
     guards negative / non-finite / total≤0 (use `Number.isNaN`, never bare `NaN`).
   - `requestStateMeta(state)` → `{ label, chip }` total map over the four request states with
     a safe default.
6. a11y-correct from the start: every non-navigating control — the Active/Matched/Purchased/
   Expired filter `.seg`, "New", per-card Edit / Pause, "See referrals" — is a
   `<button type="button">`, never an hrefless `<a>` (the U1/U2/CodeRabbit lesson). The only
   `<a>` is the wired Matched "Buy" → `/app/listings/:id`.
7. All gates green: astro check, build, bun test, acceptance, buyer+seller smoke,
   route-coverage, audit. Test names follow the repo `should [behavior] when [condition]`
   convention.
8. Fidelity to the locked frame; **no new component CSS** — every Requests class
   (`.quota .reqcard .reqcard.hot .reqmeta .alertglyphs .matchrow .wave-pill .reqactions
   .nudge .chip.req .chip.mut .seg`) already exists in the F1 port (global.css 227-229,
   349-360, 418-437). Add only a bronze entrance choreography scoped to `/app/requests`,
   mirroring Home/Search.

## Out of scope (backend / later waves)
- Create-a-Request flow (frame 03): catalog pick + budget + alert-type selection.
- The Alert-payoff / Match screen (frame 05: "Tickets are live" / "A match for your request").
- Real request state, quota enforcement, matching, alert delivery (Convex / Codex).
- Working state-filter tabs, Edit/Pause/New actions, referral/tier logic (visual only).
- `AlertRequest` / `Want` schema in `types.ts` (Codex's schema work) — U3 uses a local mock
  shape only.

## Approach
Mirror U2 exactly: a self-padded v5 screen under `AppShell routeId="/app/requests" hideHeader`
rendering its own `.home-top`, driven by a local typed mock array of requests (`.map`-rendered
`.reqcard`s) plus the two tested pure helpers. Wire exactly one Matched card's Buy to the live
mock listing via `loadListingFlowView()` + `isLiveResale` (consistent with U2's one wired
result). Promote the route through the same acceptance/contract path U1/U2 used.

**Proactive dedup (advisor item 1):** also make `scripts/ui-smoke-buyer.mjs` data-driven in
this slice. It currently copy-pastes a per-route `read`+`must` block (35.3% overall duplication
in SonarCloud) and U3 would add another. Converting it to a route→needles array + one loop
(the same fix already applied to `verify-first-visible-slice.mjs`) removes the SonarCloud
new-code-duplication risk for U3 and pre-empts it for U4–U7. SonarCloud does not parse `.astro`,
so the screen markup never counts — the verification scripts are the only duplication surface.

## Edge cases (decided)
- **Quota math:** `requestQuota(used,total)` clamps `percent` to 0–100 (used>total → 100;
  used<0 or non-finite or total≤0 → label still renders, percent 0). Guarded with
  `Number.isNaN`. Mock shows "2 / 3 active requests" (67% fill).
- **State → chip mapping (spec line 104):** Active→`chip req` (bronze), Matched→`chip live`
  (gold), Purchased→`chip protect` (jade), Expired→`chip mut` (faint). Total map; unknown →
  Active styling as the safe default.
- **Discount-integrity:** the wired Matched card shows "Seller price" unless a verified
  original price exists (no mock has one) — pinned by the existing acceptance "% off" guard,
  extended to `/app/requests`.
- **Forward CTAs vs route-coverage:** "New" (→ Create Request, frame 03), Edit, Pause, and
  "See referrals" are display-only `<button type="button">` with no `href`, so
  `verifyRouteCoverage` stays green without inventing routes that don't exist yet. The only
  navigating link is the Matched "Buy" → `/app/listings/:id`, which resolves.
- **a11y:** every non-navigating control is `<button type="button">`; the only `<a>` is the
  real Buy link.
- **Copy discipline:** exclamation-free (the single allowed exclamation "Tickets are live"
  belongs to frame 05, not here). No banned user-facing terms (queue, #N in line, demand…).

## Ambiguity policy
7-dimension rubric per the /dev decision gate. ≥80% confidence → proceed + document; <80% →
stop and ask. The design is locked to spec §4, so gates should be rare.

## Technical Research
- **DRY (verified in global.css):** `.quota`/`.qtop`/`.track`/`.qsub` (355-360),
  `.reqcard`/`.reqcard.hot`/`.rhead`/`.icbx` (418-424), `.reqmeta`/`.alertglyphs`/`.ic.on`
  (425-427), `.matchrow`/`.buy`/`.buy.ghost` (428-432), `.reqactions` (433-434), `.nudge`
  (435-437), `.wave-pill`/`.priority`/`.high` (349-352), `.chip.req`/`.chip.mut` (229),
  `.chip.live`/`.chip.protect` (227-228), `.seg` (U2) all already exist → reuse, no new CSS.
- Helpers `isLiveResale`, `discountBadge`, `transferModeLabel`, `formatInr`, `formatDateTime`,
  `loadListingFlowView` exist (U1/U2) → reuse. Add only `requestQuota` + `requestStateMeta`.
- `navMap.ts` already has the `requests` tab (`/app/requests`, icon `bell`), bronze accent
  `#C98B5F`, and `requests` in `FAB_TABS` → AppShell lights the tab + shows the FAB with no
  nav change.
- **Route-promotion blast radius:** `/app/requests` is in `knownForwardRoutes`
  (verify-first-visible-slice.mjs:46), absent from `IMPLEMENTATION_CONTRACT.md`, the acceptance
  `routes` table, and buyer smoke → add in all four. `search.astro:88` already links to
  `/app/requests` (its empty-state CTA), so promoting the route also satisfies that forward
  link in route-coverage.
- **Icons:** verify availability in `Icon.astro` for bell, tag, drop, bolt-last/zap, spark,
  edit, gift, plus, people; reuse existing names where the sprite differs, add missing glyphs
  additively only if absent (Icon.astro is shared — additive icon entries only, no API change).
- **OWASP:** static SSR of mock data + two pure label helpers. No auth/payment/input/network
  surface this slice. A03 injection — Astro auto-escapes; no user input. A10 SSRF — frontend
  makes no external calls; the only link is an internal route. No applicable risks introduced.
- **TDD scenarios:** (1) `requestQuota(2,3)` → `{label:"2 / 3 active requests",percent:66}`;
  (2) `requestQuota(0,3)` → percent 0; (3) `requestQuota(5,3)` → percent 100 (clamp);
  (4) `requestQuota(-1,0)` / non-finite → guarded, percent 0; (5) `requestStateMeta("matched")`
  → `{label:"Matched",chip:"live"}`; (6) each of the 4 states maps correctly + unknown default;
  (7) acceptance: `/app/requests` renders title + quota + state filter + a reqcard + nudge
  (RED before the page exists → GREEN after).
