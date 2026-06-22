# Design — Official-Availability Watcher (BMS + District)

- **Feature:** `availability-watcher`
- **Date:** 2026-06-22
- **Status:** design approved (build authorized end-to-end by project owner; Codex-owns-backend split waived for this task)
- **Classification:** Critical (new architecture + schema migration + external integration)
- **Branch / worktree:** `feat/availability-watcher` · `.worktrees/availability-watcher`

Research basis (already validated this session, copied into this branch under `docs/work/2026-06-20-catalog-data-maps-research/`): `availability-watcher-implementation-spec.md`, `bms-oss-reuse-execution.md`, `district-reuse-execution.md`, `decisions.md`, `availability-watcher-crawlers.md`. This doc is the formal plan; those are the proof.

## Purpose

Deliver the core product promise — *"Tell us what you want, we'll notify you when it becomes available."* When a user sets an alert for a movie+city+date, Zwapit watches **BookMyShow ∪ District** for that show, and the moment booking opens at any theatre, notifies every subscriber and **deep-links them OUT** to the official site to book. Zwapit never resells official inventory or touches that money.

## Success criteria (measurable)

1. A user can create an alert (movie + city + date [+ format]) → a `wants`/alert row + a deduped `monitor_targets` row exist; many users on the same show collapse to **one** watcher (one `monitor_targets` row).
2. An internal action, given a monitor target, fetches **both** sources via Parallel Extract (batched), parses them, and returns a normalized `{ isOpen, theatres[], showtimes[], bookingUrl }` — **unioned across BMS+District, deduped by canonical venue**.
3. The cron polls only **in-window** active targets, **stops on detect** (status `watching → live`), and fires each subscriber **once** (idempotent `notification_queue`).
4. BMS parse decodes `AVAIL_STATUS_MAP` (0–3); District parse extracts theatre→showtime→format from rendered text; both behind the same normalized shape.
5. A "Tickets are live" payoff renders for the subscriber with a working **deep-link OUT** (BMS/District URL). No client-exposed matching/monitor/availability mutations.
6. `bun test` green; type-check + lint clean; Parallel + senders mocked in tests (no network, no secrets in repo).

## Out of scope (explicit)

- Real Parallel/Resend/web-push **credentials** in tests or repo (env-only; the shared test key is rotated and never committed).
- The full `wants → alert_requests` table **rename** from the 2026-06-12 design — we **extend `wants`** instead (see Approach). Rename is a separate migration.
- Per-show **fill-status** from District (colour-coded → not in Parallel's text); only booking-open + theatre + showtime + format for District. BMS supplies fill-status.
- WhatsApp / Telegram channels (Email + Web Push only now; CLAUDE.md keeps WA/TG off until DLT compliance).
- Discount / Price-drop alert *delivery* (capture the alert types now; only **Availability** + **Last-minute** are delivered in this slice — matches the u7 decision).
- Google Maps wiring, payments, admin dashboard, community-resale matching (separate features).
- Real seller/buyer auth changes — reuse existing `mockCurrentUserId` / identity helpers.

## Approach selected — extend, don't duplicate

DRY review of `convex/schema.ts` found the catalog + request groundwork already exists. So:

**Extend existing tables** (additive, optional fields — no data loss, no breaking change):
- `catalog_items` → add optional source-code fields: `bmsEventCode`, `bmsRegionCode`, `bmsVenueCode`, `districtMvCode`, `districtCdCode`, `districtCitySlug`, `lat`, `long`. (A movie catalog row carries its BMS `ET…`/region + District `MV…`/city-slug; a venue-kind row carries `bmsVenueCode`/`districtCdCode`. Some carry both source codes, some one — D5 union mapping.)
- `wants` → add optional alert fields: `watchCity`, `watchDate`, `watchFormat?`, `alertTypes: []`, `channels: []`, `monitorTargetId?`. (`wants` IS the request/alert object; we add the watch dimensions + alert prefs without renaming.)
- `audit_logs.entityType` union → add `"monitor_target"`, `"availability_event"`, `"notification"`.

**Add new tables** (genuinely new — the watcher engine):
- `monitor_targets` — `{ collapseKey, catalogItemId, city, date, format?, sources:["bms"?,"district"?], status:"watching"|"live"|"closed"|"degraded", lastSnapshotHash?, subscriberCount, windowStart?, windowEnd?, lastCheckedAt?, nextCheckAt? }`. `collapseKey = catalogItemId|city|date|format`. Indexes: `by_collapse_key`, `by_status_next_check`.
- `availability_events` — one row per detected open: `{ monitorTargetId, source, detectedAt, theatresJson, bookingUrl, snapshotHash }`. Index `by_target`.
- `notification_queue` — `{ userId, monitorTargetId, availabilityEventId, alertType, channel, status:"pending"|"sent"|"failed", dedupeKey, createdAt, sentAt? }`. Idempotent on `dedupeKey = userId|monitorTargetId|availabilityEventId|alertType|channel`. Index `by_dedupe`, `by_status`.
- `source_snapshots` — adapter read cache: `{ monitorTargetId, source, snapshotHash, fetchedAt }`. Index `by_target_source`.

**Function layers** (match existing conventions; introduce internal fns/actions/cron — none exist yet):
- `convex/watcher/parse.ts` — **pure** (no Convex): `parseBmsByVenue/ByEvent(json)`, `parseDistrictMovieCity(text)`, `AVAIL_STATUS_MAP`, `normalizeToShow()`, `unionAndDedupe(bms, district, venueMap)`, `computeCollapseKey()`, `snapshotHash()`. Fully unit-testable.
- `convex/watcher/adapters.ts` — `buildBmsUrl()/buildDistrictUrl()` + the `extractViaParallel(urls)` action wrapper (the only network surface; mocked in tests via an injected fetcher).
- `convex/watcher.ts` — `internalQuery` dueTargets, `internalMutation` recordAvailability / enqueueNotifications / advanceTargetState (+ `appendAuditLog`), `internalAction` pollDueTargets (cron entry) and dispatchNotifications. Client-facing: `createAlert` (mutation, find-or-create monitor target), `getAlertPayoff` (query).
- `convex/crons.ts` — schedule `pollDueTargets` every N minutes.
- `convex/model.ts` — extend with `monitorTargetByCollapseKey`, snapshot helpers (reuse `appendAuditLog`).
- Frontend: alert-create wiring + a "Tickets are live" payoff card with deep-link (reuse v5 `.alert-card` component).

**Cost levers baked in** (from spec §5): shared `monitor_targets` dedup, windowed polling + stop-on-detect, one call per movie+city covers all theatres, batch BMS+District URLs in one Parallel call, platform-routing (only the sources a target's catalog item has codes for).

## Constraints (hard)

- **Internal-only + audited:** matching/monitor/availability/notification mutations are `internalMutation`/`internalAction` — never client-callable. Every state transition writes an `audit_logs` row.
- **Deep-link OUT only:** `availability_events.bookingUrl` is always the official BMS/District page; Zwapit never books or holds inventory.
- **Non-load-bearing:** on source block / shape change, target → `degraded`; fall back to community-resale + admin signals + the deep-link CTA. Real-user-triggered (a target exists only because someone set an alert) — no blanket cron over the whole catalogue.
- **Frontend never calls BMS/District** — only Convex; Convex actions call Parallel.
- **No secrets in repo:** `PARALLEL_API_KEY` (and later `RESEND_API_KEY`, VAPID keys) via Convex env; tests inject mock fetchers/senders.
- **Language:** `monitor_target` etc. are internal table names; all user-facing copy uses approved terms ("Tickets are live", "Notify me", "We'll match you"). No banned user-facing words.

## Edge cases (decisions)

- **Source returns empty / blocked (403/empty):** treat as "not open"; increment a fail counter; after K consecutive fails on a target → `degraded` (suppress, keep deep-link CTA). Never crash the cron.
- **Only one source has the show:** union still fires (open on either source). A catalog item with only one source's code → poll only that source (platform-routing).
- **Stale cache:** BMS URL gets a cache-bust query param each poll; District is `no-cache` (none needed).
- **Snapshot churn:** hash a **narrow** normalized field set (theatre+showtime+open-flag), not raw page, to avoid false fires.
- **Concurrent pollers / double-create:** find-or-create monitor target is idempotent on `collapseKey` (unique-ish via `by_collapse_key`); notification idempotent on `dedupeKey`.
- **Out-of-window date / expired alert:** target not polled; expired `wants` decrement subscriberCount; target with 0 subscribers → `closed`.
- **Detection after already-live:** fire-once per subscriber; new subscribers to an already-`live` target get notified immediately from the last `availability_event`, not a re-poll.

## Ambiguity policy

Use the /dev 7-dimension decision-gate rubric. **≥ 80% confidence: proceed and document inline.** **< 80%: stop and ask.** Anything touching the `wants` shape, `schema.ts` unions, or a user-facing string that risks a banned term → stop and confirm.

## Technical Research

Endpoints/parse logic are **empirically validated this session** (see the copied execution docs); not re-researched.

- **BMS (clean JSON, validated):** `GET in.bookmyshow.com/api/v2/mobile/showtimes/byvenue?appCode=MOBAND2&appVersion=9700&venueCode=<VC>&dateCode=YYYYMMDD` (no headers) and `…/api/movies-data/showtimes-by-event?…eventCode=ET…&regionCode=<R>&bmsId=<any>&token=<any>` (fake creds OK; validate region params). Seed: `/api/explore/v1/discover/regions`, `/api/v2/mobile/venues?regionCode=<R>&eventType=MT`. Decode `AVAIL_STATUS_MAP {0:SoldOut,1:AlmostFull,2:FillingFast,3:Available}`.
- **District (rendered text, validated):** `GET www.district.in/movies/<slug>-movie-tickets-in-<city>-MV<id>?fromdate=YYYY-MM-DD` via Parallel `full_content` → parse `* <Theatre>` / `+ HH:MM <format>`. Booking-open ⇔ theatres present. Discovery: `…/movies/<city>-movie-tickets` → MV-coded URLs. Gateway is token-gated/empty via Parallel — text-parse is the path.
- **Parallel Extract:** `POST api.parallel.ai/v1beta/extract { urls:[…], full_content:true }` → `results[]`; **bills per URL** (~$0.001), supports multi-URL batching. Returns raw JSON for BMS API URLs, cleaned text for District HTML.

### OWASP Top 10 analysis (this feature's surface)

- **A01 Broken Access Control** — APPLIES. Mitigation: all monitor/availability/notification mutations are `internal*` (not in the client API surface); `createAlert`/`getAlertPayoff` authorize via existing identity helpers; a user only reads their own alerts/notifications.
- **A02 Cryptographic Failures** — APPLIES (API keys). Mitigation: `PARALLEL_API_KEY`/sender keys in Convex env only; never logged, never in repo/tests; the shared test key rotated.
- **A03 Injection** — APPLIES (building source URLs from catalog codes; parsing untrusted HTML/JSON). Mitigation: codes are validated/escaped into URL templates (allowlist charset on ET/MV/venue codes); parser treats source bytes as untrusted, never `eval`s, bounds output.
- **A04 Insecure Design** — Mitigation: non-load-bearing watcher, deep-link-out (no custody), fail-safe `degraded` state, real-user-triggered.
- **A05 Security Misconfiguration** — Mitigation: cron + actions internal; no new public HTTP endpoints; env-gated senders default to no-op when unset.
- **A06 Vulnerable Components** — Mitigation: no new heavy deps; `web-push` (VAPID) + `resend` are the only candidates, added at the notify task with audit.
- **A08 Data Integrity** — APPLIES (idempotency). Mitigation: `collapseKey`/`dedupeKey` uniqueness; snapshot-hash diff; audit log on every transition.
- **A09 Logging/Monitoring** — Mitigation: `audit_logs` for every monitor/availability/notification transition (append-only, seq-ordered).
- **A10 SSRF** — APPLIES (server fetches URLs). Mitigation: the only fetch target is `api.parallel.ai` (Parallel does the outbound BMS/District fetch); Convex never fetches arbitrary user-supplied URLs — source URLs are built from validated catalog codes against fixed host templates.

### TDD test scenarios (≥3; full list in tasks.md)

1. **Happy path** — `parseBmsByVenue(fixtureJson)` → normalized shows with decoded statuses; `parseDistrictMovieCity(fixtureText)` → theatres+showtimes; `unionAndDedupe` merges a venue present on both into one. Detection flips `watching → live`, enqueues one notification per subscriber.
2. **Error/failure path** — adapter returns empty/403 → target stays `watching`, fail-counter increments, K fails → `degraded`, no notification, no crash.
3. **Edge case** — two alerts on the same movie+city+date collapse to one `monitor_targets` row (subscriberCount=2); both notified once; a third late subscriber to a `live` target is notified immediately from the last event (idempotent, no duplicate).
4. **Idempotency** — re-running poll on an already-`live` target with an unchanged snapshot hash creates no new event and no duplicate notification.
5. **Platform-routing** — a catalog item with only `districtMvCode` polls District only (one URL), not BMS.
