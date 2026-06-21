# Convex Alerts read-model · design

## Goal
Wire the part of the Alerts inbox (`/app/alerts`, §5 "alert payoff / match") that can be honestly
backed by real data — the **community resale match card** — to Convex, replacing the hardcoded
Arijit card. The official-availability card and the "Earlier" feed stay illustrative.

## Scope decision (advisor): minimal-reuse, NO new table
Most of the alerts inbox is the OUTPUT of internal systems that do not exist in v1 and are
explicitly deferred + Codex-owned per CLAUDE.md (notifications, monitor/shared-watch,
availability watching, matching — all internal-only, audited). Inventing an `alert_events`
table now would fabricate the log of a system that isn't built, inside a frontend-wiring slice —
scope creep + ownership crossing + the same "fake feed" smell we avoid with fake discounts.

What is genuinely backable: only the **match card** — and the data already exists as the buyer's
`want_match` → live listing (the same join the requests slice computes). So:
- **Match card** → real, from `getAlertsForBuyer` (matched want → active match → live listing).
- **Official availability card** → stays static illustrative (Zwapit holds no availability data;
  the watcher is the deferred internal system; the deep-link is a labelled placeholder OUT to the
  official site).
- **"Earlier" feed** → stays static illustrative (price-drop / official-opened / purchased events
  have no source until the notification/monitor system lands).

If the full persisted feed is ever wanted, that is a SEPARATE internal-system slice needing
explicit opt-in — not this one. PR/handoff will say the availability card + Earlier feed are
illustrative until the internal watcher/notification system lands.

## Data model
NO schema change. `getAlertsForBuyer` (read-only, `args: {}`, pinned to `DEMO_BUYER_ID`) iterates
the buyer's wants, finds an active `want_match` (`proposed`/`reserved`/`accepted`) whose listing is
`state: "live"`, and returns the matched listing's display fields:
`{ matches: [{ title, venue, listingKey, price, transferMode }] }` (title/venue/price/transferMode
from the listing doc). One card per matched want. Mirrors the requests slice's match-resolution.

## The match card (real)
- subtitle: `"{title} · {venue} · from a verified seller"` → Coldplay - Music of the Spheres ·
  DY Patil Stadium, Navi Mumbai · from a verified seller.
- price: `formatInr(price)` → ₹3,500 (the Coldplay listing's `listingPrice`).
- discount: **"Seller price"** — `discountBadge` returns null for real listings (no verified
  original price field yet), so NO "% off". Drops the fabricated "13% off · was ₹450".
- transfer mode: `transferModeLabel(transferMode)` → "Official Transfer".
- Buy → **`/app/listings/{listingKey}`** (listing detail → protection → checkout). NOT
  `/app/checkout/...`: the checkout route prerenders only the fixture and ignores `:listingId`, so
  a coldplay checkout URL would 404. Listing detail is param-driven + prerenders all community
  listings (PR #27) and is the correct protection-first flow — same as the requests Buy link.

## Dual behaviour (established conventions)
- `args: {}` pinned to `DEMO_BUYER_ID`; read-only; no matching mutation exposed.
- `loadAlerts()` guard validates TYPES not emptiness (empty matches is valid — a buyer with no
  current match shows no match card); falls back on missing/throw/shape-drift.
- `MOCK_ALERTS` mirrors the seed exactly (one Coldplay match: price 3500, OFFICIAL_TRANSFER,
  listing_event_coldplay_1) so CI (no env) and Convex builds render identically.
- Counts/fields from the backend; label/price/discount derived in the one frontend place
  (`transferModeLabel`, `formatInr`, `discountBadge`).

## Verification
Dev-only deploy (`npx convex dev --once`) → seed → probe `getAlertsForBuyer`. Both build paths
green via `verify-first-visible-slice`. `/app/alerts` needle: drop "13% off"; add
"Coldplay - Music of the Spheres", "Seller price", "Official Transfer"; keep "Tickets are live",
"Open booking", "A match for your request", "Buy with Protection", trust-band copy.

## Security analysis (OWASP)
Low-risk, read-only, pre-auth, demo-pinned:
- **A01 Broken access control** — `args: {}`, pinned to `DEMO_BUYER_ID`; no client id; no cross-user
  read. Swap to `ctx.auth.getUserIdentity()` on auth landing.
- **A03 Injection / XSS / CSRF** — no external input, read-only; Astro escapes rendered values; the
  official deep-link is a static, known official URL (no fabricated/unvalidated event URL).
- **A02 Sensitive data exposure** — returns the matched listing's public display fields only; no
  buyer identity/PII; no budgets (unlike the seller-blind interest signal rules).
- **Audit / custody** — no money/transfer/payout action here (Buy navigates to the protected flow);
  no audit-log entry required; matching stays an internal mutation, not exposed.
