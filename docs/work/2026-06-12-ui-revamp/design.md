# Zwapit Product Revamp — Design

- **Date:** 2026-06-12
- **Status:** Approved direction (user), execution not started
- **Scope:** Demand-first marketplace mechanic + full UI revamp (glass & metal, District-informed, premium pass)
- **Artifacts:** `zwapit-ui-revamp-preview.html` (v4 visual concept, 6 screens), `convex/schema.ts` (groundwork landed in commit `2a04da8`)

---

## 1. Why this revamp

Two decisions landed on 2026-06-12:

1. **Demand-first wants (reverse listings).** Buyers can post what they want
   before any seller lists it. Recorded in `CLAUDE.md` → "Demand-First Wants
   (Reverse Listings)". This changes Zwapit from a one-way listing feed into a
   two-sided matching marketplace.
2. **Visual revamp.** The current UI (flat token cards in
   `src/components/buyer/ListingCard.astro`, `src/pages/app/*.astro`) is a
   wireframe. The approved direction is the District-informed glass & metal
   system in the preview, refined to a premium register (see §5).

The v1 proof gains a fourth question: *can a buyer request what they want
before supply exists and get matched automatically?*

---

## 2. The two-sided loop (user flows)

### 2.1 Buyer — supply path (exists today as mock)

```
Home (browse live listings)
  → Listing detail (trust grid: mode · payout shield · deadline · recourse)
  → Protection summary → phone OTP → pay (mock)
  → My Tickets stub (Paid ✓ → Seller transfers → You confirm → Done)
  → confirm receipt → dispute window → completed
```

### 2.2 Buyer — demand path (new)

```
Home ("Can't find it?" CTA) or empty search result
  → Request a ticket:
      pick canonical catalog item (movie / live event / bus route)
      + quantity + max price per unit + expiry
  → instant check: live listings already matching? show them now
  → otherwise: Want = open, "You're #N in line"
  → on new matching listing: auto-reserve (time-boxed, e.g. 30 min)
      + push notification
  → buyer accepts → same protected checkout as supply path
  → declined/expired → reservation passes to next Want in line
```

### 2.3 Seller path

```
Sell tab
  → "Buyer waiting" banner (open Wants with budgets — instant-sell pull)
  → upload-first (screenshot/PDF) → confirm details → price → promise transfer
  → rule engine decision (AUTO_APPROVE / BLOCK / WAITLIST / MANUAL)
  → live → matched-to-want or open-market order
  → transfer task → buyer confirms → payout (after dispute window)
```

### 2.4 Matching engine (system actor, internal-only)

```
listing transitions to `live`
  → query open wants: same catalogItemId, qty fit, maxPricePerUnit ≥ listing price
  → order FIFO by want.createdAt
  → create want_match (state=reserved, allocationRank, reservedUntil)
  → notify buyer; on accept → order; on decline/timeout → next rank
  → all transitions audited (audit_logs entityType want / want_match)
```

### 2.5 The flywheel (stickiness model)

- Open requests render on Home as **“Most wanted right now”** → pulls sellers
  (“12 waiting · top budget ₹4,000 · Sell to them”).
- Every new listing can trigger a match → push notification → buyer returns.
- An open request is a standing reason to come back; My Tickets holds both
  what you **have** and what you're **hunting** (Tickets | Requests | Past).
- No dark patterns: reservation windows are honest, queues are real FIFO.

---

## 3. Data relations (as landed in `convex/schema.ts`)

```
catalog_items (:323)        ←  canonical things people want or sell
   │ 1:N
   ├── wants (:346)              buyer demand (catalogItemId :349,
   │      │                      by_catalog_state index :365)
   │      │ 1:N
   │      └── want_matches (:370)   want × listing pairing,
   │              │ N:1              allocationRank + reservedUntil
   ├── listings (:235) ─────────────┘
   │      catalogItemId (:272, optional — required to match)
   │      by_catalog_item index (:277)
   │      │ 1:N
   │      └── orders (:279) ── 1:1 transfer_tasks (:296)
   │                          ── 1:N issues (:308)
   ├── source_rules (:184)   gate both listings and wants
   └── audit_logs (:385)     all transitions incl. want / want_match
users (:155) / auth_identities / user_verifications / seller_payment_accounts
```

Want states: `open → matched → reserved → fulfilled | expired | cancelled`.
Match states: `proposed → reserved → accepted | declined | expired`.

Not yet built (deliberately): wants/match mutations, matching engine,
reservation expiry job, catalog sync actions, notifications. See §6.

---

## 4. Screen system (preview v4)

| # | Screen | Ambient | Job |
|---|--------|---------|-----|
| 01 | Home | violet | discover supply + see demand signals + request entry |
| 02 | Listing detail | rose | trust before pay; price with no surprises |
| 03 | My Tickets | gold | stub wallet; transfer journey; confirm action |
| 04 | Sell | steel | upload-first; buyer-waiting instant sell; eligibility |
| 05 | Request | bronze | catalog pick + 3 fields; instant matches |
| 06 | Matches | bronze | reservations, queue position, raise budget |

Per-screen ambient identity is District's signature and stays; the premium
pass (§5) lowers its intensity.

---

## 5. Visual language — premium pass (v3 → v4)

Diagnosis of "AI-ish" in v3: emoji used as iconography, saturated neon
gradients, glossy bevelled buttons, animated light sweeps everywhere,
letter-glyph posters, playful copy ("🪄 we'll hunt for you").

v4 rules:

- **Iconography:** stroke SVG icons only (1.8px stroke, rounded caps).
  Emojis are banned from chrome; allowed nowhere except actual content.
- **Type:** Space Grotesk for UI; Fraunces (serif) reserved for display
  moments — prices, headline numerals, the wordmark. No Unbounded.
- **Color:** one action color (rose `#F23D7F`) everywhere money moves;
  jade = protection, gold = deadlines/tickets, steel = transfer modes,
  bronze = requests. Saturation pulled down ~20% from v3; neon lime and
  cyan retired.
- **Glass:** fixed chrome only (nav dock, search, sticky bars) + hero cards.
  Scrolling list items use solid translucent fills (also a Capacitor WebView
  performance rule — `backdrop-filter` is GPU-expensive on low-end Android).
- **Metal:** reserved for money moments only (buyer-waiting, payout rows).
  Static sheen; the animated sweep survives only on the primary CTA.
- **Buttons:** flat premium — solid fill, hairline border, subtle top
  highlight; no candy bevels, no big colored drop shadows.
- **Chips:** hairline outline, 9.5px uppercase letterspaced, dot indicators.
- **Copy:** composed, short, benefit-first. "Reserved for you · 28:43".
  No wizard metaphors, no exclamation marks.

---

## 6. Execution plan

Order respects `CLAUDE.md` Build Order (8 → 9 → 10 …) and Agent Ownership
(Codex: backend/state machines; Claude: UI/flows). Shared files
(`convex/schema.ts`, `src/lib/types.ts`, routing) need explicit user approval
before parallel edits.

### Phase 0 — Design tokens (Claude, small)
Port v4 tokens into `src/styles/global.css` (replace the current mixed
oklch theme — orange borders and 3px offset shadows go away). Rebuild
`BottomNav.astro` (glass dock + center Sell action) and `AppShell.astro`
(ambient per-route accent). Gate: visual check on all existing routes,
`bun test`, `npm run check`.

### Phase 1 — Listing marketplace (Build order 8)
- Codex: `listings.list` Convex query (live + waitlist_only, by_state index),
  seed 4–6 fixture listings with catalogItemId.
- Claude: Home browse (poster cards, dividers, story-ring genre filters),
  ListingCard v2, listing detail trust grid.
- Gate: home renders N listings from Convex; tests for query filters.

### Phase 2 — Demand-first slice (Build order 9)
- Codex: catalog seed (manual fixtures first), internal mutations
  `wants.create/cancel`, matching engine on listing→live transition,
  reservation expiry handling, audit events. All internal; no client-exposed
  matching mutations.
- Claude: Request screen (catalog search UI, 3-field form, instant-match
  bar), Requests segment in My Tickets, Most-Wanted strip + Buyer-waiting
  banner fed by real wants.
- Gate: end-to-end mock — post want → list matching ticket → reservation
  appears with deadline → accept → order created. State-transition tests.

### Phase 3 — Checkout + timeline binding (Build order 10–11)
Bind checkout and the stub timeline to live order state (replaces the
hardcoded `displayState` in `src/pages/app/tickets.astro`).

### Phase 4 — Catalog connections (after Phase 2 works on manual data)
- TMDB sync action for movies (region IN, daily; attribution required;
  IMDB has no usable public API — verified 2026-06-12).
- Events: curated + `user_submission` review queue (no public
  BookMyShow/District API; scraping is out).
- Bus routes: curated corridors; Google Places only for stop/location
  metadata if needed.

### Phase 5 — Notifications
Push on match/reservation (Capacitor push). Without this the demand loop
loses most of its stickiness — schedule directly after Phase 2 proves out.

---

## 7. Risks & open questions

1. **Reservation window length** — 30 min default; needs a real decision
   (too short = missed matches, too long = starves the open market).
2. **Price caps vs wants** — source_rules price rules (face_value_cap) must
   also clamp `maxPricePerUnit` on wants, or wants become a gouging signal.
3. **Catalog dedup** — user submissions will collide with TMDB/manual rows;
   needs a merge rule before Phase 4.
4. **Multi-quantity fairness** — a 4-qty listing vs three 2-qty wants:
   v1 rule = exact-or-greater qty fit only, no splitting.
5. **WebView performance** — cap concurrent `backdrop-filter` surfaces
   (§5); test on a low-end Android device in Phase 0.
6. **Beads tracking** — `bd` is currently broken in this worktree (Dolt
   database not found); issues for Phases 1–5 should be filed once sync is
   repaired.
