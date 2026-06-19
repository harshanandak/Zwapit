# U8 — Alert payoff / Match · tasks

Ordered: shared helper (TDD) → screen → wiring → promotion → verify. One file-owner
per task; no overlap within a wave.

## Task 1 — navMap `/app/alerts` special-case (TDD)
OWNS: `src/lib/ui/__tests__/navMap.test.ts`, `src/lib/ui/navMap.ts`
- RED: add a describe block — `resolveNav("/app/alerts")` →
  `{ tab: "requests", accent: "#6FBF9A", showFab: false }`; `/app/alerts/` identical;
  and assert existing routes (home/checkout/sell/requests/profile) are unchanged.
  Run `bun test src/lib/ui/__tests__/navMap.test.ts` → confirm the new cases FAIL
  (current code returns the unknown-route default for `/app/alerts`).
- GREEN: add a jade accent constant (`#6FBF9A`, sourced from `--jade` in global.css)
  and a special-case in `resolveNav`, placed in section 1 (before the tab loop):
  `if (isUnder(path, "/app/alerts")) return state("requests", <jade>, false);`
- Run the test → all pass. Run full `bun test` → 171 + new pass, 0 fail.

## Task 2 — Alerts screen `/app/alerts`
OWNS: `src/pages/app/alerts.astro` (new)
- AppShell `routeId="/app/alerts"` `title="Alerts"` `hideHeader`. Import depth `../../../`.
- Sections (§5): `.pbar` (back `<a href="/app/home">` + "Alerts"); `.divider`
  "JUST NOW"; OFFICIAL `.alert-card.official` (gold rail, `Icon ticket`): h4
  "Tickets are live!", `.chip.live` "Official", `.sub` "Dune · PVR Orion · Sat 21
  Jun, 9:30 PM — official booking just opened.", honesty `.dim` "You + 124 others
  were alerted. Acting early helps — it's never a guaranteed seat.", `.ac-foot`
  `.ac-cta` gold `<a class="btn" href="https://in.bookmyshow.com/" target="_blank"
  rel="noopener noreferrer">Open booking <Icon arrow></a>`; COMMUNITY
  `.alert-card.community` (jade rail, `Icon spark`): h4 "A match for your request",
  `.sub` "Arijit Singh Live - Silver Pass · Bengaluru Arena · from a verified
  seller.", price block `.price-d` "₹390" + `.disc` "13% off · was ₹450", chips
  `.chip.protect` "Protected payment" + `.chip.mode` "Official transfer", `.ac-foot`
  `.ac-cta` `<a class="btn btn-primary sweep" href="/app/checkout/listing_bms_event_1">
  Buy with Protection</a>`; protection `.trust-band` (`Icon shield`) "Your payment is
  held safely until the transfer is confirmed."; `.divider` "EARLIER" + data-driven
  muted `.solid` rows (array of past alerts).
- No client script (no interactivity needed). No new CSS.
- `bun run build` → 0/0; page emits `data-route-id="/app/alerts"`.

## Task 3 — Entrance + bell wiring
OWNS: `src/components/AppShell.astro`, `src/pages/app/home.astro`
- AppShell: add `"/app/alerts"` to `ENTRANCE_ROUTES`.
- home.astro: rewire the bell nav (currently `/app/requests`) → `/app/alerts`.
- Build → confirm `data-entrance` present on the alerts page; bell href updated.

## Task 4 — Route promotion
OWNS: `docs/IMPLEMENTATION_CONTRACT.md`, `scripts/verify-first-visible-slice.mjs`,
`scripts/ui-smoke-buyer.mjs`
- Contract: add `- /app/alerts -> Alert payoff / Match: official availability alert
  (deep-links out) + community resale match (Buy with Protection).`
- verify: add `["/app/alerts", "app/alerts/index.html"]` to `routes`; add a single-
  line `routeContentChecks` entry: `["/app/alerts", ["Alerts", "Tickets are live",
  "Open booking", "A match for your request", "Buy with Protection", "13% off"]]`.
- smoke: add `["/app/alerts", "app/alerts", ['data-route-id="/app/alerts"', "Tickets
  are live", "A match for your request", "Buy with Protection"]]`.
- route-coverage picks it up from the contract automatically (16 → 17).

## Task 5 — Full verification (CI parity, all via `bun`)
- `bun run build` (0/0, 17 pages) · `bun test` (all pass) · `bun scripts/ui-smoke-buyer.mjs`
  (10 routes) · `bun scripts/verify-first-visible-slice.mjs` (exit 0, 17 routes) ·
  `bun scripts/route-coverage.mjs` (17 routes).
- Adversarial exit review (spec fidelity, a11y/correctness, route/CTA integrity,
  discount-integrity/copy) before ship.
