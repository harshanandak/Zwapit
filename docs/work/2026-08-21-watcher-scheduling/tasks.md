# Watcher scheduling + audit integrity — task list

Branch: feat/sale-window-scheduling (off master 5cf65d1).
Validate each: `bunx tsc --project convex/tsconfig.json --noEmit` + targeted lane; full `bun test` before push.

---

## T1 — Schema: monitor_targets.saleOpensAt [schema → codegen]
**Files:** convex/schema.ts, convex/__tests__/schema.watcher.test.ts
Additive optional ISO string on monitor_targets. Test validates a row with/without it. Codegen inline. `_generated` staged deliberately.

## T2 — Parser: extractSaleOpensAt [pure, parse.ts] — RED→GREEN
Export `extractSaleOpensAt(text): string | null`. Parse the sales-timeline block from district-event-page.txt fixture:
- Prefer earliest **general-sale start**; else earliest **pre-sale start**.
- Parse "Sat 18 Apr, 2026, 2 PM" / "Mon 13 Apr, 1 PM" shapes → ISO with +05:30 (source pages are IST; preserve offset explicitly).
- Only future instants relative to `now` arg (default Date.now()); none → null.
- "Live" marker alone → null (already open — availability markers handle it).
Tests: fixture text yields the April general-sale instant; pre-sale-only text yields pre-sale; past-only text → null; garbage → null.

## T3 — Scheduler: clamp in schedule.ts [pure] — RED→GREEN
`nextCheckWithSaleWindow(nowMs, saleOpensAtIso | undefined, targetDate)`:
- no/invalid/past saleOpensAt → delegate to nextCheckWithBackoff
- clamp = min( max(saleOpensAt+SALE_BUFFER_MS(2min), now+5min), nextCheckWithBackoff(...) )
- anchor: resolved instant > target end-of-day → use target EOD
Tests: wake-at-open beats 24h tier; floor respected; cap respected; past instant falls back.

## T4 — Action wiring [watcher.ts]
pollDueTargets district branch: run extractSaleOpensAt on the parsed content when target is event-kind and not yet open; thread winner through rescheduleTarget({saleOpensAt?, nextCheckAt}) — extend rescheduleTarget args additively; persist saleOpensAt only when present. Schema test updated.

## T5 — Audit want writes [watcher.ts] (PR-2)
Three appendWatcherAuditLog calls at: wants insert (want_created), wants patch attach (want_attached), subscriberCount change (target_subscriber_count_changed). entityType "want"/"monitor_target" per validator. Tests assert one row per write via convex-test query of audit_logs.

## T6 — CI cleanup-on-timeout (PR-3)
cloudflare-worker-preview.yml + production.yml: cleanup steps/jobs get `if: always() && !cancelled()`; guard on deployment id presence.

## T7 — Hygiene (PR-3)
a) AGENTS.md hazard 6 reworded: inputs are catalogItemId|city|date|format; real hazards = dropping empty-format trailing segment, per-caller normalization drift, bypassing occurrence check.
b) Manual-sync label before convex-ai block in .clinerules/.cursorrules/.github/copilot-instructions.md.
c) watcher.test.ts POLL_NOW relative (+POLL_NOW_PLUS_20M); PAST_EXPIRY_NOW stays absolute.
