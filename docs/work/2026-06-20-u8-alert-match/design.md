# U8 — Alert payoff / Match (v5 §5) · design

**Slug:** u8-alert-match · **Date:** 2026-06-20 · **Branch:** feat/u8-alert-match
**Status:** in progress · **Classification:** Standard (new screen + one shared-file edit)

## Purpose

Build the v5 §5 **Alert payoff / Match** screen — the "your alert paid off" inbox the
home bell opens. It is the moment the core promise ("Tell us what you want, we'll
notify you when it's available") delivers: a just-fired official availability alert
("Tickets are live!") that deep-links the user OUT to official booking, and a
community resale match ("A match for your request") that converts via protected
payment. This is where the alert/request model becomes visible value.

## Success criteria

- New route `/app/alerts` renders the §5 frame: topbar (back + "Alerts"), "JUST NOW"
  divider, an official `.alert-card` (gold rail) + a community `.alert-card` (jade
  rail), a protection `.trust-band`, an "EARLIER" history list, and the bottom nav.
- The bottom nav shows **Requests active** and the ambient accent is **jade** (`#6FBF9A`).
- Official card CTA "Open booking" deep-links OUT (external anchor, never an in-app
  route, never an API call to the platform). Community card CTA "Buy with Protection"
  routes to the real `/app/checkout/:listingId` flow.
- The home bell opens `/app/alerts` (was `/app/requests`).
- Route promoted: contract + acceptance (`verify-first-visible-slice.mjs`) + buyer
  smoke + route-coverage (16 → 17 routes). All gates green; SonarCloud new-code
  duplication 0%.

## Out of scope (mock-first / later)

- Real matching / availability / notification mutations — internal-only, audited,
  never client-exposed (CLAUDE.md). Cards are display-led mock copy; CTAs navigate only.
- Real official-platform integration (the frontend never calls BookMyShow/District);
  "Open booking" is a static external deep-link placeholder.
- Alert preferences/management, per-alert settings, real "EARLIER" history data.
- §10 Plans & Referrals (the only remaining v5 surface after this).

## Approach selected

- **Route + accent (user decision, Option B "go for quality"):** top-level
  `src/pages/app/alerts.astro` → `/app/alerts`, with a dedicated `resolveNav`
  special-case → `{ tab: "requests", accent: jade #6FBF9A, showFab: false }`.
  Rejected `/app/requests/alerts` (auto-resolves but only in bronze; forcing jade
  there needs a case before the tab loop — fragile, per advisor).
- **No new component CSS** — every §5 class already exists in `global.css`:
  `.alert-card` (+ `.rail`/`.ac-body`/`.ac-top`/`.ac-ic`/`.sub`/`.ac-foot`/`.pr`/
  `.ac-cta`, `.official`(gold) / `.community`(jade) variants), `.trust-band`,
  `.chip.live`/`.protect`/`.mode`, `.disc`, `.price-d`, `.divider`, `.solid`.
  Entrance animation: add `/app/alerts` to `ENTRANCE_ROUTES` in AppShell (the U7
  `[data-entrance]` hook) — **zero CSS edits**.
- **Mock-first / display-led** (mirrors U7): no persistence, no mutations; the screen
  is illustrative copy. EARLIER rows are a data-driven array (SonarCloud CPD safety).

## Constraints / decisions

- **Shared file:** `navMap.ts` is routing config (Agent Ownership). User approved the
  contained edit by choosing the quality option. Add a single special-case + a jade
  accent constant; do not disturb existing cases. Covered by a RED-first unit test.
- **The one exclamation:** "Tickets are live!" is the ONLY exclamation in the product
  (spec §global + §5). Verified: no automated gate bans `!` (checked verify/coverage/
  smoke + tests). Keep every other line exclamation-free.
- **Discount integrity:** §5 shows `.disc` "13% off · was ₹450 (verified only)". The
  discount-integrity gate scopes to the 5 fixture-bound marketplace routes
  (home/listings/search/requests/sell) — `/app/alerts` is NOT one. §5 is the screen
  that *illustrates* a verified-original match ("from a verified seller"). Render the
  disc with arithmetically-correct values (450→390 = 13% off), as display-led mock,
  documented — so it is consistent with the spec and does not contradict the gate.
- **External-link safety:** "Open booking" anchor uses `target="_blank"
  rel="noopener noreferrer"`. verify/coverage skip non-`/` hrefs, so it does not trip
  the dangling-link gate; community CTA `/app/checkout/<id>` resolves via the existing
  prefix handler.
- Decided self (per advisor): back → `/app/home` (the bell's origin); community CTA →
  `/app/checkout/<listingId>`; EARLIER rows data-driven.

## Edge cases

- Unknown/sub routes still resolve safely (existing default branch unchanged).
- `/app/alerts/` trailing slash tolerated (normalize()).
- No forbidden user-facing terms (escrow/settlement/dispute/…/Sales/Transactions/KYC/
  queue/demand) — §5 copy is clean; asserted by the smoke forbidden-term sweep.

## Technical research / OWASP

- Static, server-rendered mock screen: no user input, no auth, no mutations, no
  network calls → minimal risk surface. A03/A07/A08 N/A. Only outward link hardened
  with `rel="noopener noreferrer"` (reverse-tabnabbing). No secrets, no PII.

## TDD scenarios

1. **Happy:** `resolveNav("/app/alerts")` → `{ tab: "requests", accent: "#6FBF9A", showFab: false }`.
2. **Edge:** `/app/alerts/` (trailing slash) resolves identically.
3. **Regression:** every existing route (home/checkout/sell/requests/profile/legacy)
   resolves exactly as before — jade case must not capture or shift them.

## Ambiguity policy

7-dimension rubric; ≥80% confidence → proceed + document; else ask. The one user
decision (route+accent) is resolved. Discount-integrity + exclamation handled above.
