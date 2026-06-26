# Events Phase 2 — design

## Feature
- **Slug:** events-phase2
- **Date:** 2026-06-26
- **Status:** design (Phase 1 — design intent captured, approved in session)
- **Epic:** zwapit-3re
- **Branch / worktree:** feat/events-phase2 / .worktrees/events-phase2

## Purpose
Extend the official-availability watcher and the canonical catalog from **movies** to **live events** —
"the other half of shows and events." Deliver Zwapit's core promise ("tell us what you want, we'll
notify you when it becomes available") for events: a user sets an alert on a curated event; when its
tickets become available, Zwapit notifies them and **deep-links OUT** to the official booking page.
Zwapit never resells official event inventory and never touches that money (mirrors the movie watcher).

## Success criteria (measurable)
1. A curated live event can be seeded into `catalog_items` (kind `live_event`), **per-occurrence**
   (event + venue + date) with an official booking URL.
2. A user can set an alert on a curated event via the existing alert/`createAlert`/wants path; multiple
   subscribers to the same occurrence **collapse to ONE `monitor_target`** (shared watch).
3. An **internal/admin availability action** marks an occurrence "tickets live" → the existing
   notification engine enqueues + dispatches one notification per subscriber × channel (idempotent, with
   the claim/retry/lease shipped in Phase B), each carrying the official **deep-link OUT**.
4. A payoff query returns the live payoff (event, venue, date, booking URL) for the **caller's own**
   alert only (A01); a not-yet-live alert returns a waiting state.
5. Expiry: a past-date event alert expires and closes its target via the existing `expire-wants` cron —
   no perpetual watching.
6. **Zero external/egress calls** in the v1 availability path (curated-first).
7. A **time-boxed research spike** documents whether BMS/District expose usable EVENT availability
   endpoints, with a go/no-go for an automated polling adapter in a follow-up slice.
8. New tests pass; `tsc --project convex/tsconfig.json` clean; **no regression** to the movie watcher
   (current baseline stays green).

## Out of scope (explicit)
- **Community RESALE of event tickets** (protected-payment matching, checkout, custody, transfer modes,
  payout, dispute) — separate future epic; event transferability/legal differs from movies.
- **Automated event-source polling / parsers** — NOT built in this slice; gated on the research spike,
  shipped as a follow-up only for validated sources.
- **Third-party event sources** (Ticketmaster, Insider, Eventbrite, …) — spike covers BMS + District only.
- Discount / price-drop alert **delivery** for events beyond what movies already deliver (availability +
  last_minute only).
- Any new payment, admin-dashboard, or category-expansion surface.

## Approach selected — Option A: curated-availability-first watcher
Chosen over (B) watcher + resale and (C) catalog + alerts-only.

- **Reuses ~90% of the hardened watcher engine**: `monitor_targets` collapse/state-machine,
  `availability_events`, `notification_queue` (claim/retry/lease), `expire-wants` cron, snapshot-hash
  caching, audit logs — all source-agnostic.
- **v1 availability = an internal/admin mutation** (e.g. `markEventAvailable`) that flips the target live
  + records an `availability_event` with the official booking URL → fires enqueue/dispatch. **Zero
  scraping, zero egress.**
- **Automated polling is additive and evidence-gated** (spike → follow-up adapter), so v1 never depends
  on unvalidated event APIs.
- **Catalog**: per-occurrence curated rows (event + venue + date), curated canonical id (no TMDB
  analogue), cross-source via the existing `collapseKey` + name-fallback dedupe (extends the zwapit-46i.3
  decision). Events map onto the normalized-show shape (section/tier as the theatre/format analog), so
  **no new availability tables**.

**Rationale:** delivers the full alert→notify→deep-link promise end-to-end for events, de-risks the one
genuine unknown (event APIs), defers the heavy/risky money path, and is the lowest-egress design.

- **Why not B:** resale is a separate heavy epic (custody, transferability, checkout/dispute duplication)
  for an unproven category — against custody + "Do Not Build Yet" rules; prove demand/availability first.
- **Why not C:** ships alerts that never pay off — fails the core promise for events.

## Constraints (hard limits)
- **Efficiency / egress (user directive):** the availability path must be **near-zero-egress**. Reuse the
  cost levers — shared-watcher collapse (many alerts → one watch), snapshot-hash caching (unchanged =
  no-op), windowed + stop-on-detect polling, expiry/close (stop past-date polling). Any future automated
  adapter must use **conditional requests** (ETag / If-Modified-Since), coalesced/batched fetches, and
  never poll per-user. Cache catalog/read-models so reads make no external calls.
  **Index-range rule:** index-range queries (e.g. `dueTargets` on `by_status_next_check`) must
  exclude non-eligible rows IN the range — via a sentinel key (curated targets get a far-future
  `nextCheckAt`) or a range bound — never via a post-`.take()` filter, which lets ineligible rows
  consume the budget and starve eligible ones. (Same trap as Phase B's `expiredAlertWants`.)
- **Internal-only mutations:** matching/monitor/availability/notification mutations stay
  `internalMutation`/`internalAction` — never client-callable. Only alert-create (client mutation) +
  payoff (query) face the client, both authorized via the identity helper (A01).
- **Deep-link OUT only:** `bookingUrl` is always the official BMS/District/organiser page; Zwapit never
  books or holds event inventory or money.
- **Audit:** every event-watcher state transition writes an `audit_logs` row.
- **User-facing language** (CLAUDE.md): "Set an alert", "We'll notify you", "Tickets are live", deep-link
  OUT; never surface internal terms (monitor target, etc.).
- **Prefer reuse over new tables:** discriminate events from movies via `catalog_items.kind` /
  `category`, not new event-specific tables, unless a concrete gap forces one.
- **No regression** to the movie watcher.

## Edge cases (decisions from Q&A)
- **No booking URL yet:** alert can be set (catalog row exists); target stays `watching`; payoff shows
  waiting; admin sets URL + marks available when it opens.
- **Same event on BMS AND District:** collapse via `collapseKey` (canonical event id + city + date) +
  name-fallback dedupe → one watch, one notification per subscriber.
- **Past-date event:** `expire-wants` cron expires the alert + closes the target (reused).
- **Section/tier-only availability** (concerts/sports, no theatre): represented in the normalized-show
  theatre/format fields; payoff lists what's available + deep-links OUT.
- **Curated event edited/cancelled:** admin closes the target (reuse the detach/close path) → subscribers
  see a closed state.
- **Late subscriber on an already-live event:** notified immediately from the last `availability_event`
  (reuses the `createAlert` late-subscriber path).
- **Spike finds NO usable event API:** v1 ships curated-only; automated polling deferred — promise still met.

## Ambiguity policy
Use the 7-dimension rubric scoring (per /dev decision gate). **≥80% confidence:** proceed and record the
decision in `decisions.md`. **<80%:** stop and ask the user. Phase-2 spike outcomes that change the data
model feed back into this doc before /dev.

## Open items carried into Phase 2 (research)
- Research spike: BMS + District EVENT availability endpoints — exist? URL/payload shape? (all prior
  research was movies-only). Output: go/no-go + data map for a follow-up automated adapter.
- OWASP Top-10 pass for the new client/admin surfaces (alert-create reuse, admin availability mutation).
- TDD scenarios (≥3) for the curated availability path.
- DRY check: confirm the reused engine functions (createAlert, enqueue/dispatch, expire) generalize
  without forking; identify the minimal events-specific additions.

## Technical Research

### DRY / reuse boundary (verified against code at master `4da67c6`)
**Generic — reuse as-is:** `monitor_targets` (collapse + state machine), `availability_events`,
`notification_queue` + `enqueueForEvent`/`dispatchNotifications` (claim/retry/lease), `expire-wants`
cron + `expireWants`/`detachSubscriberCore`, snapshot-hash caching, `appendWatcherAuditLog`,
`requireAuthenticatedAppUser` (A01). None assume "movie".

**`createAlert` — two movie-specific assumptions to generalize** (convex/watcher.ts):
- `:253–257` builds `sources` from `buildBmsUrl`/`buildDistrictUrl` and throws `NO_WATCHABLE_SOURCE`
  when none exist. **Curated events have no pollable source**, so this would wrongly reject them. Fix:
  allow a curated target with `sources: []` (it is admin-driven, never polled) — derive "watchable"
  from catalog kind, not only from a buildable URL.
- `:316` hardcodes `category: "movie_ticket"` on the want insert. Fix: derive category from
  `catalog_items.kind` (`live_event` → `event_ticket`).

**Net-new (small):** an internal `markEventAvailable` mutation (admin/curated) that records an
`availability_event` (official booking URL) + advances the target to `live` + calls `enqueueForEvent`
— i.e. the manual analog of `pollDueTargets`→`recordAvailability`. No new tables.

**Conclusion:** extend, don't fork. Generalize `createAlert` (or add a thin `createEventAlert` that
shares a core), add `markEventAvailable`, seed curated `live_event` rows. Movie watcher untouched.

### OWASP Top-10 (this slice's surface = client alert-create + payoff query + internal admin mutation)
- **A01 Broken Access Control** — APPLIES. Payoff returns only the caller's own alert (reuse the
  `buyerId === user.appUserId` check). The availability mutation MUST be `internalMutation` (never in
  the client `api`); curated-admin authorization gated internally. *Mitigation:* internal-only +
  identity checks, all audited.
- **A03 Injection / unsafe URL** — APPLIES. `bookingUrl` allowlisted to official https BMS/District/
  organiser hosts before persisting (reuse `officialBookingUrl`). City/date/event inputs trimmed +
  validated (reuse the `normalizeAlertInput` pattern).
- **A04 Insecure Design** — curated-first avoids fragile scraping; deep-link OUT only; no custody/money.
- **A08 Data Integrity** — snapshot-hash dedup + idempotent `dedupeKey` enqueue (reused) prevent
  duplicate/false-fire notifications.
- **A09 Logging** — every transition writes an `audit_logs` row (reused).
- **A10 SSRF** — NOT in this slice (no outbound fetch on the curated path). The FUTURE automated adapter
  must allowlist source hosts and fetch only catalog-derived URLs, never user-supplied ones.

### TDD scenarios (≥3)
1. **Happy path:** seed a curated `live_event` → user sets an event alert → two subscribers collapse to
   ONE `monitor_target` → admin `markEventAvailable` (with official URL) → exactly one pending
   notification per subscriber × channel, each carrying the deep-link OUT → payoff returns `live` with
   event/venue/date/bookingUrl.
2. **Error / access control (A01):** another user's `getAlertPayoff` for this alert returns `null`;
   `markEventAvailable` is internal-only (absent from the client `api`, only `internal`); a non-official
   `bookingUrl` is rejected/sanitised to "".
3. **Edge:** a curated event with NO automated source does **not** throw `NO_WATCHABLE_SOURCE` (curated
   target allowed); a past-date event alert is expired + its target closed by `expireWants`; a late
   subscriber arming an already-live event is notified immediately from the last `availability_event`.

### Research spike — BMS/District EVENT availability endpoints (deferred to first /dev task, time-boxed)
All prior reverse-engineering (`docs/work/2026-06-20-catalog-data-maps-research/*`) covered **movies
only** (BMS `showtimes/byvenue` + `showtimes-by-event`; District SSR `/movies/...-MV<id>`). Whether
BMS/District expose an **event** availability analog is **unvalidated**. Because the v1 curated path
needs no source, the spike does **not** gate this slice — it is the **first task** (time-boxed: inspect
a BMS event page's embedded JSON + a District event page's `__NEXT_DATA__` for an availability signal;
note URL/payload shape or conclude "no clean API"). Output: a go/no-go + (if go) a data map that gates a
**separate follow-up adapter slice**. Egress note: the eventual adapter must reuse shared-collapse +
snapshot caching + conditional requests (see constraint above). If no-go, v1 ships curated-only.
