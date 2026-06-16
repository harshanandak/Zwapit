# Zwapit Product Revamp — Design

- **Date:** 2026-06-12 · **Revised:** 2026-06-16 (pivot to Alerts + Requests)
- **Status:** Approved direction (user). Design + UI concept landed; backend/schema is Codex's next step.
- **Scope:** Reframe Zwapit as an **Alerts + Requests** marketplace; full UI revamp in the v4
  premium glass & metal language (District-informed).
- **Artifacts:** `zwapit-ui-revamp-preview.html` (v5 visual concept, 10 screens),
  `alerts-requests-screen-spec.md` (build-ready screen spec), `convex/schema.ts`
  (wants/catalog groundwork landed in `2a04da8`, to be extended — see §6).

---

## 1. The core idea

> **Tell us what you want, and we'll notify you when it becomes available.**

This single promise is the product. It applies to movies, live events, bus tickets,
vouchers, passes, resale tickets, price drops, and future categories. The earlier
"demand-first wants" decision (2026-06-12) was the seed; this revision makes the
**alert** — not the listing — the primary object users create and return for.

Why this is the right shape: a normal marketplace is dead until sellers arrive.
Zwapit captures **demand first** (a private request + an alert), then fills it from
either supply source. An open request is a standing reason to come back, and every
new piece of supply is a push notification. That is a stronger network effect than a
plain buy/sell board.

---

## 2. Two supply sources

### 2.1 Official supply (availability alerts)
Tickets that have not yet opened on official platforms (BookMyShow "BMS",
District by Zomato). The user asks to be told the moment a specific
**movie + theatre + date + showtime** opens for booking.

- Zwapit runs its **own backend**; the frontend never calls BMS/District directly.
- A **shared watch** model: many users wanting the same show subscribe to **one**
  internal monitor; one checker notifies all subscribers (500 users → 1 watcher).
- The alert deep-links the user **out to the official platform to book** — Zwapit
  does not resell official inventory and never touches that money. This is both the
  truthful model and the lowest-risk one (see §8.4).
- MVP checking can be a **manual admin "mark live"** trigger; later, source adapters
  (`bmsMonitor`, `districtMonitor`) read public availability. Pursue official
  affiliate/deep-link partnerships so monitoring is contractually permitted.

### 2.2 Community supply (resale listings + match alerts)
A user resells their own ticket/pass. The matching engine notifies requesters whose
request fits, and the purchase runs through Zwapit's **protected payment** flow.
This is where Zwapit actually transacts and earns its service fee.

---

## 3. Mechanics

### 3.1 Requests (private)
A request = category + canonical catalog item + date + budget + preferences + the
alert types the user wants. Requests are **private**, not a public board.

- **States:** `Active → Matched → Purchased | Expired` (also `Cancelled`).
- **Quota by tier** (see §3.4): Free = **3 active requests**; the UI shows a
  "2 / 3 active" meter so users self-manage. A request stops counting when
  purchased / expired / cancelled.

### 3.2 Alert types
- **Availability** — tell me the moment tickets are live.
- **Discount** — tell me when the price drops below my budget.
- **Price-drop** — tell me when a seller's price decreases (incl. scheduled drops).
- **Last-minute** — alert me close to showtime/departure.

### 3.3 Matching = alert waves, not a hard queue (v1)
No paid holds and no exact queue numbers in v1. When supply appears:

```text
Supply appears (official goes live  OR  community listing created)
  → find matching requests (catalog id + budget + qty/format fit)
  → Wave 1: priority/referral/best-match users
  → +3–5 min → Wave 2: all matching requesters
  → Wave 3: public Browse (Listings tab)
First valid buyer to complete protected payment wins (community).
```

- User-facing status is **Standard / Priority / High Priority** — never "#N in line".
- Priority is earned by referrals / Plus and is honestly framed as *"you may hear
  earlier — never a guaranteed booking."*
- Wave size is **scaled to known supply** (a 1-ticket listing alerts a small Wave 1,
  not every priority user — avoids "alert spam for nothing"). See §8.5 for the
  correctness rules (single-winner, dedup, idempotent notifications).

### 3.4 Tiers & referrals (discovery, not guaranteed access)
Tiers limit **request count and alert speed**, never guarantee a ticket.

| Tier | Active requests | Alerts | Hold token |
|---|---|---|---|
| Free | 3 | Standard | — |
| Verified | 5 | Standard | — |
| Referral Boost | 10 (temp) | Earlier | 1 (limited) |
| Plus | 20 | Earlier + discount + price-drop | Limited |
| Power (later) | 50 | Advanced | Category-capped |

Referrals are rewarded **only for meaningful actions** (phone-verify / first request /
first list / first buy) — never raw installs — with abuse controls (§8.7). Launch
leans on **referrals before paid subscriptions** to build liquidity first.

### 3.5 Seller side
Upload-first. The seller sees a **people-looking signal** ("52 people looking ·
high interest") with **no buyer identity, no budgets, no priority numbers**. Seller
sets price, optional original price, optional discount, an urgent toggle, and an
optional **auto price-drop schedule** (drop ₹X every N min before start). A
**"X% off" badge renders only when the original price is verified** from the uploaded
artifact; otherwise the UI shows a plain "Seller price" (§8.6).

### 3.6 Notifications
- **v1:** Email + Web Push (both consent-gated).
- **Later:** Telegram, then WhatsApp.
- Consent is **per-channel and per-alert-type, unchecked by default**, with
  per-request and global opt-out, frequency caps, and quiet hours (§8.3).
- India onboarding before launch: TRAI **DLT** header/template registration for SMS,
  and explicit prior **opt-in + approved templates** for WhatsApp Business (P2
  prerequisite — these channels stay off until then).

### 3.7 Matching levels & referral rewards

The alert-wave system (§3.3) exposes three named matching levels, introduced in order:

- **Open Alert (v1 default):** notify all matching requesters; first valid buyer wins.
  Used for low/medium demand — most listings.
- **Early Alert (v1, earned):** Priority / Plus / referral users are notified a few
  minutes earlier (Wave 1). No lock — just a head start.
- **Private Hold (later):** a short, time-boxed hold of one listing for one buyer.
  Rare; limited to high-value/high-demand items and trusted users; framed as "up to
  N minutes" because time-sensitive tickets can't always be held.

Referral rewards (earned; before paid subscriptions; unlock only on a verified friend's
meaningful action — phone verify / first request / first list / first buy — never raw
installs; abuse controls in §8.7):

- 1 verified friend → +1 active request
- 3 verified friends → Early Alert for 7 days
- 5 verified friends → 1 Private Hold token (used rarely)
- 10 verified friends → Plus for 30 days

---

## 4. User flows

**Buyer — official availability alert**
```text
Home / Search → "Set an alert" → pick movie + theatre + date + showtime + format
  → choose alert types + budget → request Active ("you + 124 others waiting")
  → tickets open → "Tickets are live" alert → Open booking (out to official site)
```

**Buyer — community match**
```text
Open request (Active)
  → a matching listing is created → alert wave → "A match for your request"
  → Buy with Protection (phone OTP → pay) → My purchases
  → seller transfers → buyer confirms → completed
```

**Seller**
```text
Sell (FAB / Profile) → upload ticket → confirm parsed details
  → see "52 people looking" → set price (+ optional discount / auto-drop)
  → rule engine decision → live → matched requesters alerted
  → first protected payment wins → transfer → buyer confirms → payout
```

**Matching engine (system actor, internal-only, audited)**
```text
supply event → resolve canonical catalog id → find fitting requests
  → emit alert waves (idempotent per user/target/event/type)
  → single-winner atomic transition on the listing → order → audit log
```

---

## 5. Navigation & screen system

**Bottom tabs (5):** Home · Search · Requests · Listings · Profile.
Selling has **no center tab** — it's a prominent **"List a ticket" FAB** above the nav
(Home/Search/Listings) plus a **Selling hub in Profile**. (Decision: keeps the spec's
5 tabs intact; the v4 elevated-center Sell button is replaced by the FAB. A buy/sell
*mode* toggle was considered and rejected as heavier than needed.)

| # | Screen | Ambient | Job |
|---|--------|---------|-----|
| 01 | Home | violet | official-vs-community zones; alert entry; trust |
| 02 | Search | steel | universal search + filters; empty → create a request |
| 03 | Create Request / Set an alert | bronze | catalog pick + budget + alert types |
| 04 | Requests | bronze | request states, quota meter, alerts, priority |
| 05 | Alert payoff / Match | jade + rose | "Tickets are live" + community match → Buy |
| 06 | Listings | rose | resale marketplace (Latest/Trending/Discounted/…) |
| 07 | Listing detail | rose | trust grid + verified discount + protected buy |
| 08 | Sell / List a ticket | steel | upload-first; people-looking; price + auto-drop |
| 09 | Profile | gold | Buying + Selling hubs; tier card; channel toggles |
| 10 | Plans & Referrals | gold | Free vs Plus; referral ladder; alert-wave explainer |

**Per-screen specifics** (full copy/icon spec in `alerts-requests-screen-spec.md`):
- **Home** rails: Official tickets (Movies / Events / Bus, each with a Notify-me
  affordance) and Community listings (Latest · Discounted · Trending).
- **Search** scope: Movie / Event / Bus / Voucher / Pass; filters: price, date,
  location, source, category; an empty result offers "Create a request instead".
- **Listings** sections: Latest · Trending · Discounted · Ending Soon · Near Me.
- **Profile** hubs — Buying: My Requests · Saved · Purchases · Notifications;
  Selling: My Listings · Sales · Payouts · History.
- **Sell FAB** ("List a ticket") appears on Home, Search, Requests, and Listings;
  selling is also reachable from the Profile Selling hub. No center Sell tab.

Per-screen ambient identity is District's signature; the v4 premium pass keeps its
intensity low. Full per-screen section/copy/icon spec: `alerts-requests-screen-spec.md`.

---

## 6. Data model

### 6.1 Landed groundwork (`convex/schema.ts`, commit `2a04da8`)
`catalog_items`, `wants`, `want_matches`, optional `catalogItemId` + `by_catalog_item`
index on `listings`, and want/want_match audit entity types.

### 6.2 Target schema for the Alerts + Requests model
This **supersedes/extends** the wants groundwork. Schema work is **Codex-owned**
(`convex/schema.ts` is a shared file requiring explicit approval); documented here so
implementation is unambiguous.

```text
users
catalog_movies / catalog_venues / catalog_events / catalog_routes   (canonical, source-tagged)
alert_requests        ← was `wants`: + alertTypes[], channels[], tier/priority, status
monitor_targets       ← shared watch: collapse key = catalog id + theatre + date + showtime + format
                        many alert_requests : one monitor_target
availability_events   ← a monitor_target going "live" (one row per drop)
notification_queue    ← idempotent per (userId, targetId, eventId, alertType); pending/sent/failed
listings              ← + discount fields, originalPriceVerified, autoPriceDrop schedule
want_matches → matches ← listing × alert_request pairing, alert-wave rank
orders / transactions ← protected payment + ₹10 service fee
subscriptions / referrals
source_snapshots      ← adapter read cache + snapshotHash for change detection
audit_logs            ← all internal transitions
```

Relations (essentials):
```text
catalog_*  1─N  alert_requests  N─1  monitor_targets  1─N  availability_events
                     │                                        │
                     └────────── matches ──────── listings ───┘  1─N orders 1─N transactions
```
Migration note: `wants → alert_requests` (add alertTypes/channels/status), `want_matches
→ matches`, `catalog_items → catalog_movies/venues/events/routes` (or keep `catalog_items`
with a `kind` discriminator — Codex's call). `monitor_targets`, `availability_events`,
`notification_queue`, `source_snapshots`, `subscriptions`, `referrals` are new.

Scope notes: **voucher/pass** catalogs are a future catalog kind (Phase 2+) — §1's
promise states the full vision, not the v1 data model. Seller **payout-setup**
readiness lives in the existing `seller_payment_accounts`; a seller **reliability
score** (§8.7) is a future field there.

### 6.3 API shape (own backend; never call BMS/District from the client)
```text
GET  /api/catalog/movies?source=BMS      GET /api/catalog/venues?source=BMS&city=…
GET  /api/catalog/regions?source=BMS
POST /api/alerts   GET /api/alerts   GET /api/alerts/count
GET  /api/subscription/status   GET /api/notifications/status   GET /api/referral-code
```
Use `source` (`BMS` / `DISTRICT`), not `app`. Source adapters return
`{ isLive, bookingUrl, showtimes?, priceRange?, snapshotHash }`.

### 6.4 Admin & ops surface (internal)
- **Catalogs:** movies, venues, cities, events, routes — curated / seeded / synced,
  reviewed before going live.
- **Monitor targets:** status `Watching → Live → Closed`, with subscriber count.
- **Alert requests:** per-target waiting count ("125 users waiting").
- **Notification queue:** rows `pending → sent | failed`, retryable.

All admin actions are internal-only and audited; no client-exposed matching or monitor
mutations.

### 6.5 Source adapters & MVP sequence
`snapshotHash` lets a cron detect change cheaply (cached in `source_snapshots`). Get
availability by, in order of preference: (1) official partner/affiliate feed,
(2) documented public JSON endpoint, (3) rendered check — last resort, see ToS risk
§8.4. **Build-first order:** manual admin "mark live" → one BMS checker → one District
checker. Do not overbuild monitoring before the demand loop is proven.

Alert payload (per request; extensible to events / bus / vouchers / resale):
```json
{ source:"BMS"|"DISTRICT", type:"movie", movie_name, venue_id, screen_type,
  seat_types:[], target_date, time_window_start, time_window_end,
  notification_channels:["email","push"], selected_language, selected_format,
  is_premium, plan_type }
```
Notification copy (official): title "Tickets are live", body "Dune · PVR Orion ·
Sat 9:30 PM — book now", action "Open booking" (deep-links to the official site).

The alert payload mirrors the external source contract (snake_case); internal Convex
tables and fields stay camelCase — adapters translate at the boundary.

---

## 7. Visual language (v4 premium — unchanged, extended)

Base system is the approved v4 pass and stays exactly: charcoal `#0D0C0F`; Fraunces
serif for display/prices/wordmark only; Space Grotesk for UI; **one** action color rose
`#F23D7F` (anything that moves money); jade = protection, gold = deadlines/tickets/plans,
steel = transfer/sell, bronze = requests, violet = home. Stroke SVG icons only (no
emoji). Glass (`.gl`) for fixed chrome + hero cards; `.solid` translucent fills for
scrolling lists (Capacitor WebView perf); `.metal` sheen for money moments; animated
`.sweep` **only** on the "Buy with Protection" CTA. Per-screen ambient glow + metallic
phone frame; letterspaced dividers; notched ticket stubs.

New components introduced for this model: `.quota` (request meter), `.alert-card`
(payoff card with accent rail), `.wave-pill` (Standard/Priority status), `.notify-btn`
(bell affordance on official items), `.demand-band` (people-looking banner), `.drop-sched`
(auto price-drop control), `.tier-card`, `.compare` (Free vs Plus), `.ladder` (referral
rewards), `.chan-row` (channel toggles), `.disc` (verified-only discount badge).

**UI style is LOCKED to v5.** The 10-screen `zwapit-ui-revamp-preview.html` is the
canonical visual reference and the approved style. Implementation must reuse this exact
system — tokens, components, per-screen ambient identities, and the restraint rules —
and **build on it without degrading it**: no reverting to flat token cards, no new
fonts, no extra accent colors, no emoji in chrome, no candy bevels or neon, and keep
`.sweep` on the Buy CTA only. New surfaces extend the existing component vocabulary
rather than inventing parallel styles.

---

## 8. Monetization & compliance

Source: adversarial review (2026-06-16). App-store sections cite the live guidelines;
**CCPA dark-pattern and TRAI section numbers are the established framework and must be
re-verified against the primary gazette/PDF before legal sign-off.**

### 8.0 Business model
- **Primary revenue:** success fee on a completed purchase (mock ₹10 + GST).
- **Growth engine:** referrals (earned requests + earlier alerts) before paid tiers.
- **Liquidity engine:** seller discounts + buyer discount/price-drop alerts pull both
  sides of the market together.
- **Future revenue:** Plus subscription (more requests, earlier alerts) — sold on
  web/PWA per §8.2, never positioned as guaranteed access.

Launch on success-fee + referrals to build liquidity; introduce subscriptions only
after the loop works. Collect demand data throughout (a partnership/operator story).

### 8.1 Launch monetization = service fee only
The ticket purchase (movie/event/bus/resale) is a **physical good/service consumed
outside the app** — exempt from in-app purchase under **Apple 3.1.3(e)** and Google
Play's physical-goods/transport exemption. So Razorpay + the **₹10 + GST** service fee
is compliant in-app on both stores.

### 8.2 Do NOT sell tiers / hold tokens / alert-speed inside the native app (P0)
Subscriptions or extra-request/alert-speed unlocks are "app functionality" → **IAP
mandatory (Apple 3.1.1, Play Billing)**. Selling them via Razorpay in-app risks
account removal. Safe path: **ship no in-app tier sale in v1**; later sell Plus on
**web/PWA**, grant entitlement server-side, and have the app merely reflect it (no
in-app upgrade CTA on iOS). Keep ticket payment and any premium-access payment as
**separate** flows — never bundle.

### 8.3 Dark patterns (India CCPA Guidelines, 2023)
- **"X people looking" must be a true, labelled, real-time count** (e.g. "52 set alerts
  in 24h"); never seed/round/freeze. If too few, show "New listing".
- **No fake countdowns** — timers only for real deadlines (event start, real
  reservation expiry).
- **Full price up front**: item + ₹10 + GST + total at checkout entry, not only at
  final confirm (avoids drip-pricing).
- **Honest priority**: no "#N in line"; show Standard/Priority with the disclosure that
  paying/referring affects alert order, "not a guaranteed booking".
- **No pre-ticked consent**; **symmetric, neutral cancel/downgrade** (no confirm-shaming).

### 8.4 Official-source ToS & brand (P1)
Scraping/Playwright against BMS/District likely breaches ToS and can be silently
IP-blocked. Prefer **manual-trigger MVP + official affiliate/deep-link partnerships**;
throttle and degrade gracefully if blocked. **Text-only** source references, **no
logos**, explicit "Zwapit is not affiliated with BookMyShow/District" disclaimer; frame
official supply as **"availability alerts that send you to the official site to book."**

### 8.5 Matching correctness (P0/P1)
- **Single-winner**: atomic compare-and-set on listing state; first captured payment
  wins; any second simultaneous capture is **auto-refunded** ("Already sold — fully
  refunded"). Add a 90–120s pre-payment soft lock so the loser sees "Reserved" before
  paying.
- **Dedup key is exact** (catalog id + theatre + date + showtime + screen/format);
  preferences filter *who is notified*, not which target is checked; re-validate on send.
- **Idempotent notifications** keyed `(userId, targetId, eventId, alertType)`; cap
  per-user-per-drop to stop triple-notify.
- **Refund/timeout**: explicit timeout → auto-refund; payout only after buyer confirms +
  report window closes. (Consistent with existing custody rules — provider holds money.)

### 8.6 Discount integrity (P1)
"X% off" renders **only** when original price is verified from the uploaded artifact;
cap implied discount at verified face value. Seller-typed original price (unverified)
may show as muted plain text, never a strikethrough/% badge. Surface above-face resale
honestly and check per-state reselling laws before enabling.

### 8.7 Trust & abuse (P1)
Referral reward only after distinct verified phone + device/IP heuristics + a real
non-reversible action; cap/day; flag clusters. Count only **phone-verified** requests
toward the people-looking signal. Seller reliability score; payout setup required
before a listing is purchasable; penalties for confirmed no-shows.

### 8.8 OWASP security analysis (Top 10)
Threat analysis for the alerts / matching / payment surfaces (complements §8.1–8.7):

- **A01 Broken Access Control** — matching, monitor, availability, payout, and refund
  mutations are **internal-only**; clients never call them. Orders/listings are scoped to
  the internal app user id (never a provider id). Enforce server-side auth + actor checks
  on every mutation.
- **A02 Cryptographic Failures** — no card data/PII stored; Razorpay holds the money; no
  internal wallet. Secrets (Convex/Clerk/Cloudflare) live in env, never in client bundles.
- **A03 Injection** — Convex validators on all args; catalog comes from typed adapters,
  not free text; no raw SQL. Sanitize user-submitted catalog entries before review.
- **A04 Insecure Design** — single-winner atomic transition + idempotent notifications
  (§8.5) prevent double-pay/double-notify; alert waves avoid queue gaming.
- **A05 Security Misconfiguration** — static-asset Worker; least-privilege Cloudflare
  token; no debug endpoints; `bun audit` gate in CI.
- **A06 Vulnerable & Outdated Components** — `bun audit` gate; transitive CVEs pinned via
  `overrides`.
- **A07 Identification & Auth Failures** — Clerk + phone-verification gates for buy/sell;
  internal app user id kept separate from provider identity (`auth_identities`).
- **A08 Software & Data Integrity** — verified-only discount badge (§8.6); append-only
  audit logs on transitions; webhook signature + idempotency for payments (later).
- **A09 Logging & Monitoring** — append-only `audit_logs`; Cloudflare observability on;
  `notification_queue` tracks pending/sent/failed.
- **A10 SSRF** — source adapters fetch only allowlisted official hosts, server-side and
  throttled; the client never issues those requests (§8.4).

Decision rationale & alternatives are recorded inline per section (e.g., service-fee-only
vs in-app subscriptions §8.1–8.2; alert waves vs hard queue §3.3; static assets vs edge
SSR — deferred unless server endpoints are needed).

---

## 9. Execution plan

Respects `CLAUDE.md` Build Order and Agent Ownership (Codex: backend/state machines/
schema; Claude: UI/flows). Shared files (`convex/schema.ts`, `src/lib/types.ts`,
routing) need explicit approval before parallel edits.

- **Phase 0 — Design tokens (Claude).** Port v4 tokens + new components into
  `src/styles/global.css`; rebuild `BottomNav.astro` (5 tabs + Sell FAB) and
  `AppShell.astro` (per-route ambient accent). Gate: visual check all routes,
  `bun test`, `npm run check`.
- **Phase 1 — Movies + alerts + community + requests (P1 in the user's plan).**
  - Codex: `catalog_movies/venues`, `alert_requests`, `monitor_targets`,
    `availability_events`, `notification_queue` (email + web push), admin "mark live"
    trigger, matching/alert-wave engine (single-winner, idempotent), listings query.
  - Claude: Home (zones), Search, Create Request, Requests, Alert payoff, Listings,
    Listing detail, Sell, Profile, Plans screens wired to Convex.
  - Gate: end-to-end mock — create request → admin marks live → alert fires; create
    community listing → match alert → protected buy. State + matching tests.
- **Phase 2.** Bus tickets; discount + price-drop alerts; Telegram; referrals;
  subscriptions (web/PWA per §8.2).
- **Phase 3.** WhatsApp; auto price drops; priority alerts; advanced matching;
  partner/affiliate integrations.

---

## 10. Risks & open questions (prioritized)

1. **P0 — App-store billing**: never sell tiers/tokens in-app (§8.2). Decide the
   web/PWA subscription path before building Plus.
2. **P0 — Dark-pattern exposure**: real-time people-looking count, full price up front,
   honest priority, no pre-ticked consent (§8.3). Re-verify CCPA section text.
3. **P0 — Double-pay race**: single-winner atomic transition + auto-refund (§8.5).
4. **P1 — Official-source ToS/brand**: partnerships over scraping; no logos; "not
   affiliated" disclaimer (§8.4).
5. **P1 — Notification consent/spam**: per-channel/per-type opt-in, caps, quiet hours;
   keep SMS/WhatsApp off until DLT/Meta compliance is built (§8.3, TRAI verify).
6. **P1 — Discount integrity & state reselling laws** (§8.6).
7. **P1 — Referral/demand-signal fraud** (§8.7).
8. **P2 — Reservation/soft-lock window length** (90–120s lock; alert-wave 3–5 min) —
   needs tuning against real conversion.
9. **P2 — Catalog dedup** across TMDB/manual/user submissions before Phase 2.
10. **Ops — Beads tracking** is broken in this worktree (Dolt DB not found); file
    Phase issues once sync is repaired.
