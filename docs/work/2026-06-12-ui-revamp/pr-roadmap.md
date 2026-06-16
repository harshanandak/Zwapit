# Zwapit — PR Roadmap (Alerts + Requests build-out)

- **Date:** 2026-06-16 · **Owner of doc:** planning · **Supersedes:** any earlier PR plan
- **Reads with:** `design.md` (the spec), `zwapit-ui-revamp-preview.html` (the LOCKED v5 UI),
  `alerts-requests-screen-spec.md` (per-screen copy/components), `CLAUDE.md` (Build Order,
  Agent Ownership, rules).
- **Goal:** ship the redesigned product fast by keeping each PR right-sized (~1–2 days,
  ≤ ~400 net LOC) and running as many independent PRs in parallel as ownership allows.

---

## 1. How we work in every PR

- **Branch/worktree:** `forge worktree create <slug>`; branch `feat/<slug>` (or `fix/`).
  Never work two agents in the same ownership area on the same file at once.
- **TDD-first (`/dev`):** RED → GREEN → REFACTOR per task; spec-compliance review then
  code-quality review. Tests live with the code.
- **Gates before `/ship`:** `astro check` (types) + lint + `bun test` green, with fresh
  output pasted. Critical PRs also get a security pass.
- **Change classification (CLAUDE.md):** schema/payments/auth/migrations = **Critical**
  (plan→dev→validate→ship→review→premerge→verify); features/screens = **Standard**;
  small tweaks = **Simple**.
- **Ownership (CLAUDE.md):** **Codex** = schema, state machines, matching, payments,
  webhooks, security, tests. **Claude** = mobile UI, wording, screen flow, components,
  and Convex wiring *after* the schema/query exists.
- **Shared files need explicit approval before parallel edits:** `convex/schema.ts`,
  `src/lib/types.ts`, routing config, shared types, global constants. F2 owns the schema
  + shared types; everything else consumes them.
- **Mock-first wiring = the parallelism trick:** UI PRs build against the existing
  `src/lib/convex/dataAdapter` mock, then flip to the real Convex query when the backend
  PR lands. This decouples frontend and backend timing so both tracks move at once.
- **Size discipline:** if a PR crosses ~400 net LOC or two clear concerns, split it.
- **Tracking:** file a Beads issue per PR once `bd` sync is repaired in this repo (Dolt DB
  currently not found); until then this doc is the plan of record and PR descriptions
  carry the scope.
- **UI is LOCKED to v5:** reuse the preview's tokens/components; do not introduce new
  fonts, accent colors, emoji, or flat cards. `.sweep` stays on the Buy CTA only.

---

## 2. Current state (start from truth)

Already on `master`/this branch:
- Astro + React + Capacitor shell; Convex backend; Clerk auth behind adapter; phone-gate;
  source rule engine; upload-first seller persistence.
- Convex tables: `users, auth_identities, user_verifications, seller_payment_accounts,
  source_rules, listings, orders, transfer_tasks, issues, catalog_items, wants,
  want_matches, audit_logs`.
- Screens (old nav Home/Sell/Tickets/Me): `home, listings/[id], checkout/[listingId],
  orders/[id], sell/*, tickets, me, admin`.
- The revamp **design + v5 UI concept** (this branch) — not yet implemented in `src/`.

So the build-out = (a) migrate schema to the Alerts+Requests model, (b) replace the UI
shell + screens with the v5 system, (c) add the alerts/matching/notification engine.

---

## 3. Dependency graph & waves

```
WAVE 0 (foundation, run both in parallel)
  F1 Design-system + shell (Claude)        F2 Schema migration + shared types (Codex)
        │                                         │
        ├───────────────┬───────────────┬─────────┼───────────────┬───────────────┐
WAVE 1  ▼ (Claude, mock-first)           ▼ (Codex)                 ▼
  U1 Home + Listings tab           B1 Catalog queries + seed   B2 Alert requests API
  U2 Search                        B3 Listings/orders extend (+fee, discount, auto-drop)
  U3 Create Request + Requests
        │                                 │
WAVE 2  ▼                                 ▼
  U4 Listing detail + checkout     B4 Monitor targets + admin mark-live + availability
  U5 Sell / List a ticket          B5 Matching + alert-wave engine (single-winner)
                                    B6 Notifications (queue + Email + Web Push)
                                    B7 Referrals + subscriptions + service-fee confirm
        │                                 │
WAVE 3  ▼ (wire payoff once B5/B6 land)
  U6 Alert payoff / Match + inbox   U7 Profile + Plans & Referrals
```

Parallelism at peak: Wave 1 can have ~6 PRs in flight (3 Claude UI mock-first + 3 Codex
backend); Wave 2 ~6; Wave 3 ~2–3. The hard serialization points are only F1/F2 (before
everything) and B5/B6 (before U6).

---

## 4. PR breakdown

Size: **S** ≈ ½–1 day, **M** ≈ 1–2 days, **L** ≈ 2–3 days (split if it grows).
Type per CLAUDE.md classification. "Wire" = flip a mock to the real Convex query.

### Wave 0 — Foundation (both parallel)

| ID | Title | Owner | Size | Type | Depends | Scope (in) | Gate |
|----|-------|-------|------|------|---------|-----------|------|
| **F1** | Design-system + app shell | Claude | M | Standard | — | Port v5 tokens + component CSS into `src/styles/global.css`; icon sprite; `AppLayout`/`AppShell` per-route ambient accent; `BottomNav` (5 tabs: Home/Search/Requests/Listings/Profile) + Sell FAB; shared primitives (chip, btn, divider, glass/metal/solid, quota, wave-pill, alert-card, notify-btn, disc). No new screens. | All existing routes still render; `bun test`; `astro check` |
| **F2** | Schema migration → Alerts+Requests | Codex | L | Critical | — | `wants→alert_requests` (+alertTypes/channels/status/tier), `want_matches→matches`, catalog tables (or `catalog_items`+kind), `monitor_targets`, `availability_events`, `notification_queue`, `subscriptions`, `referrals`, `source_snapshots`; listing discount/originalPriceVerified/auto-drop fields; validators; audit entity types; update `src/lib/types.ts`; migrate seed. | Migration plan in PR; types compile; `bun test`; no client-exposed matching mutations |

### Wave 1 — Catalog, requests, browse (parallel)

| ID | Title | Owner | Size | Type | Depends | Scope (in) | Gate |
|----|-------|-------|------|------|---------|-----------|------|
| **B1** | Catalog queries + seed | Codex | M | Standard | F2 | `catalog.list/search` (movies/venues/events/routes); seed fixtures with canonical ids | Query tests; seed loads |
| **B2** | Alert-requests API | Codex | M | Standard | F2 | internal `alertRequests.create/list/cancel/pause`; tier quota enforcement; states Active/Matched/Purchased/Expired; audit | State + quota tests |
| **B3** | Listings + orders extension | Codex | M–L | Critical | F2 | discount + verified-original-price + auto-drop schedule on listings; `₹10+GST` fee; protected order state binding to existing machine | Order-transition + fee tests |
| **U1** | Home (two zones) + Listings tab | Claude | M | Standard | F1 · wire B1/B3 | Official rail (Movies/Events/Bus + Notify-me) + Community rail (Latest/Discounted/Trending); Listings tab (Latest/Trending/Discounted/Ending Soon/Near Me) | Renders from mock then Convex; visual matches preview |
| **U2** | Search + filters | Claude | S–M | Standard | F1 · wire B1 | universal search (Movie/Event/Bus/Voucher/Pass) + filters (price/date/location/source/category); empty → "Create a request" | Empty-state routes to Create Request |
| **U3** | Create Request + Requests tab | Claude | M | Standard | F1 · wire B2 | catalog pick → budget → 4 alert toggles (v1 delivers Availability + Last-minute; Discount/Price-drop are captured now, delivered in Phase 2 and labelled as such); Requests list with quota meter, states, priority, edit/pause | Create→list happy path; quota shown |

### Wave 2 — The engine + transact screens (parallel)

| ID | Title | Owner | Size | Type | Depends | Scope (in) | Gate |
|----|-------|-------|------|------|---------|-----------|------|
| **B4** | Monitor targets + admin mark-live | Codex | M | Critical | F2·B2 | shared-watch dedup (exact collapse key); `availability_events`; admin "mark live" trigger; statuses Watching/Live/Closed | Dedup + idempotency tests |
| **B5** | Matching + alert-wave engine | Codex | M–L | Critical | F2·B2·B3·B4 | match requests↔supply; alert waves; **single-winner atomic + auto-refund**; idempotent notif enqueue; internal-only + audited (split B5a engine / B5b single-winner if >400 LOC) | Race/refund + dedup tests |
| **B6** | Notifications (queue + Email + Push) | Codex | M–L | Critical | F2·B4·B5 | `notification_queue` worker; Email + Web Push adapters; per-channel/per-type consent; frequency cap; quiet hours; **time-based Last-minute trigger** (cron near event time). Split B6a (queue+consent) / B6b (Email+Push adapters) if >400 LOC | Queue state + consent tests |
| **U4** | Listing detail + checkout | Claude | M | Standard | F1·B3 | trust grid (mode/payout/deadline/report); verified-only discount; protected buy + full price breakdown (reads B3's fee constant — full price up front); single-winner UX: soft-lock "Reserved" + "Already sold — fully refunded" copy | Buy happy path against B3 |
| **U5** | Sell / List a ticket | Claude | M | Standard | F1·B3·(B4 count) · after U4 | upload-first; people-looking signal (no buyer info); price + original + discount% + urgent + auto-drop schedule control (schedule is persisted in v1; executed by a Phase 2 job) | Publish happy path; verified-only badge |

### Wave 3 — Payoff + account (parallel)

| ID | Title | Owner | Size | Type | Depends | Scope (in) | Gate |
|----|-------|-------|------|------|---------|-----------|------|
| **B7** | Referrals + subscriptions + fee confirm | Codex | M | Critical | F2 | referral reward unlock on verified actions; tier entitlement reflection; service-fee confirm/dedupe | Reward-gating + idempotency tests |
| **U6** | Alert payoff / Match + inbox | Claude | M | Standard | F1·B5·B6 | "Tickets are live" official card → Open booking; community match → Buy with Protection; notification inbox | Both payoff shapes; sweep on Buy only |
| **U7** | Profile + Plans & Referrals | Claude | M | Standard | F1·B2·B7 | Buying/Selling hubs; tier card + referral ladder; channel toggles; alert-wave explainer ("never guaranteed") | Hubs route; Plus sold on web note |

---

## 5. Out of scope now (Phase 2 / Phase 3 backlog — separate epics)

- **Phase 2:** bus category end-to-end; Discount + Price-drop alert *delivery*; Telegram
  channel (after DLT/opt-in groundwork); subscriptions *purchase* on web/PWA (app-store
  rule); real source adapters (BMS/District) behind partnerships; auto price-drop
  execution job; basic admin dashboard UI.
- **Phase 3:** WhatsApp; advanced matching; Private Hold tokens; optional queue numbers;
  partner/affiliate integrations.
- Do-not-build (CLAUDE.md) unless asked: chat, wallet, full ledger, real OCR/KYC, etc.

---

## 6. Coordination & risk notes

- **F1 + F2 are the only universal blockers** — land them first, in parallel. Everything
  else fans out behind them.
- **`src/lib/types.ts` is shared:** F2 publishes the types; UI PRs consume. If a UI PR
  needs a type before F2 merges, stub it locally and reconcile on wire-up.
- **B5 is the heart and the riskiest** — keep its tests adversarial (double-pay race,
  dedup, idempotent notifications per design.md §8.5). Split if it grows.
- **Compliance is per-PR, not a final step:** real people-looking counts (U1/U5), full
  price up front (U4), honest priority/no numbers (U3/U7), verified-only discount
  (U1/U4/U5), consent-first (U3/U7/B6) — see design.md §8.
- **Each PR references** its design.md section(s) and the screen in the v5 preview so the
  reviewer can check fidelity to the locked UI.
- **v1 vs Phase 2 delivery:** Availability + Last-minute alerts deliver in v1; **Discount
  and Price-drop alert *delivery*, and auto price-drop *execution*, are Phase 2** — but
  their capture UI (U3/U5) and data fields (B3) ship now and are labelled "coming soon".
- **Sequence U4 before U5** (both consume B3's listing/order types) to avoid concurrent
  reconciliation of the shared `types.ts`.
