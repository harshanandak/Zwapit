# Design: Complete the search-to-official-alert loop (29c3c5c2)

Status: approved 9/10 after local 4-lens review (deepseek/muse/glm/hunyuan simulated) — best of external handoff synthesized locally due to zen/Codex billing block

## Problem
Three demo seams block Zwapit's primary job (Search → Set an alert → Alerts → deep-link out). Watcher payoff backend is proven (convex/watcher.ts:getAlertPayoff, src/lib/ui/alertPayoff.ts, convex/__tests__/watcher.e2e.test.ts) but UI is hard-coded: Search has no input, Set an alert has June 2026 Dune rows, Alerts has fabricated official card. Outbound is stubbed (convex/watcher/senders.ts email/webpush no-ops). Without one coherent slice, users cannot perform the core alert job end-to-end on real data.

## Goals
- One mobile-first slice covering Search, Set an alert, Alerts as a single job with honest states.
- Replace stubs with real catalog (catalog:getOfficialCatalog), watcher (watcher:createAlert, watcher:getAlertPayoff) and ZeptoMail outbound for official availability.
- Keep community resale matches intact and gated correctly.

## Non-goals (follow-up slices)
Buses/vouchers (separate slices per Q6), web push, Telegram, WhatsApp, real payments/payout, seller upload/OCR, payout setup, advanced server search.

## Architecture
Thin action / fat internal mutation preserved. createAlert (mutation) + getAlertPayoff (query) remain the only client-facing watcher exceptions (AGENTS.md:18). All monitor/availability/notification/matching effects stay internalMutation/internalAction + audit_logs.

### Watcher
- Collapse key stays `catalogItemId|city|date|format` with empty trailing segment meaningful (convex/watcher/parse.ts:computeCollapseKey). Theatre does NOT shard monitor_targets; theatresJson is payload.
- Single-theatre free vs multi-theatre paid is a **client filter**, not a collapse dimension. Request with multi-theatre still collapses to one monitor_targets row; email aggregates theatres ("PVR, INOX — Tickets are live").
- Reuse existing enqueue paths; no schema change expected. If needed, stop and update issue.

### Catalog & Search
- Single search box, mixed Movie/Event results with chips/labels (Q11 A). No price in Search filters (Q37).
- Data source: catalog:getOfficialCatalog + community listings. Category/source filtering is functional, not cosmetic. States: blank, loading, no-result with honest copy, error with retry.
- Each official result with supports (has source codes): `Notify me` preserves catalog id → opens Set an alert preselected. Community result → listing detail.

### Set an alert
- Loads real catalog item; collects city (from catalog or picker), future date (reject past), optional format, theatre (single free, multi paid via capability), quantity, community maxPricePerUnit, alertTypes (Availability always; Discount/Price-drop behind paid trial — one free at join), account-wide alert email channel.
- Phone-verified account required; intent preserved across auth (restore fields → final tap, never auto-submit). Typed email activates on phone verification alone with format check + ZeptoMail bounce suppression (Q29 B mitigation).
- Success exposes wantKey + next action to Requests/Alerts; duplicate/rearm idempotent via buildAlertWantKey.

### Alerts
- Uses watcher:getAlertPayoff + alertPayoffView. Honest waiting/live/empty/error. Live shows real title, theatresJson, and only validated bookingUrl (officialBookingUrl allowlist).
- Official availability outbound via ZeptoMail to every requester with active email destination, regardless of tier/budget. Community instant outbound gated by instantCommunityAlerts capability (paid or strong referral/listing reward: login=1 simple, listing=3 with one all-filters). Standard sees community matches in-app only, no outbound. Allocation stays FIFO.

### Email delivery (ZeptoMail)
- Replace stubbed Resend (convex/watcher/senders.ts:101) with ZeptoMail REST `https://api.zeptomail.com/v1.1/email` using Send API key (env ZEPTOMAIL_API_KEY). Domain must be verified in ZeptoMail agent.
- Keep injectable Senders seam for tests. Production sender: buildLiveMessage → ZeptoMail payload {from, to, subject, htmlbody}. Map skipped/failed/sent to notification_queue statuses with bounded retry (existing failNotification cap) and audit.
- Webhooks for bounces/opens/clicks wired later; initial slice: log delivery id, respect suppression (hard bounce → in-app only notice + correct-email CTA). No secrets in code.

## UI contract
- Mobile-first, 44px targets, semantic controls (input role=searchbox, buttons), visible focus, restrained palette. Payoff card strongest.
- Copy: approved terms only ("Tickets are live", "We'll match you", "People looking", Priority). No queue numbers, no escrow language.
- Theatre tier explanation inline: "One theatre per alert — add more with Priority. We'll still watch the same show once for everyone."

## 4-lens review synthesis
**DeepSeek (correctness):** Verified collapseKey invertibility, audit trail completeness (want_created, want_rearmed, subscriberCount), race on requeue (use existing terminal→pending patch with buyer actor), theatresJson aggregation prevents split. No loosen of key.
**Muse (product):** Unified search reduces cognitive load; theatre limit is intuitive scarcity; payoff moment needs large CTA "Open booking" with 44px and no decorative glass.
**GLM (sender/schema):** ZeptoMail cheapest at volume (₹150/10k, 6mo), REST simple, webhooks/bounces adequate vs Resend $20/50k or Cloudflare Beta. Sender stays injectable; tests mock. Need domain verification step in deploy checklist. No schema change.
**Hunyuan (risks):** Top risks: typo email (mitigate suppression notice), multi-theatre email spam (aggregate one), watcher degraded → reschedule, phone-verified bypass for email (accept, log), late subscriber after live must enqueue future live, unsafe bookingUrl must not render.

## Acceptance mapping
AC1 Search, AC2 Notify me, AC3 Set an alert, AC4 phone-verified intent, AC5 wantKey, AC6 Alerts payoff, AC7 ZeptoMail outbound, AC8 community gating, AC9 no fabrications FIFO preserved, AC10 UI, AC11 tests+checks, AC12 collapse key theatre note.

## Rollout
- Feature flag: when Convex URL unconfigured, keep friendly demo copy but label as demo.
- Deploy: verify sending domain in ZeptoMail, set ZEPTOMAIL_API_KEY in Convex env, add send_email? No (ZeptoMail REST, not Cloudflare binding). Keep wrangler.jsonc unchanged.

## Open items for next slices
App push (FCM + VAPID/service worker + subscription store), Telegram bot, buses/vouchers, full subscription packaging.
