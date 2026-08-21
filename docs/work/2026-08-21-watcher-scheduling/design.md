# Watcher scheduling + audit integrity slice — design

**Date:** 2026-08-21 · **Kernel:** 9b317bb9 (sale-window), gh#41 (want audits),
1428a544 (cleanup-on-timeout), 2427bbc4/e3a43b84/#40 (hygiene)
**Planning inputs:** local synthesis agent (full design), DeepSeek-v4-pro +
GPT-5.3-codex-spark background lanes (flaw-hunt, pending at write time — findings
fold in before ship).

## Problem

1. District event pages publish **exact sale-open instants**, but the watcher
   polls on date-distance tiers — a sale opening today for a January event is
   detected up to 24h late. The single best freshness signal we own is discarded.
2. `createAlert` writes three want-side rows with no `audit_logs` coverage
   (gh#41) — AGENTS never-compromise #4 gap.
3. Deploy-workflow cleanup steps can't run when an earlier job times out
   (1428a544).
4. Stale docs: hazard 6 claims showtime was a collapse-key input (never was);
   convex-ai mirrors look auto-regenerated but aren't; `POLL_NOW=2030` test
   constant is a post-2030 landmine.

## Design decisions

**D1 — Parser returns a side-channel, not a show.**
`parseDistrictEventPage` keeps returning `NormalizedShow[]`; sale-open extraction
lands on a new optional module export `extractSaleOpensAt(text): string | null`
(pure, ISO string, IST offsets preserved verbatim). Rationale: `NormalizedShow`
is the union/dedupe currency — threading scheduling metadata through it would
leak into snapshot hashes and BMS parsers. The action calls the extractor once
per district result row and passes the winner to `rescheduleTarget`.

**D2 — Clamp formula, never raw trust.**
`nextCheckAt = min( max(saleOpensAt + SALE_BUFFER_MS, now + 5min), distanceTier )`.
- Floor (`now+5min`): never poll more often than today's base cadence.
- Cap (distance tier): never *less* often than today's behavior — if the parsed
  instant disagrees wildly with the watch date, tiers win.
- Past/invalid `saleOpensAt` → ignored → pure tiers (fail open toward current
  behavior; parse regressions degrade to exactly today).
- Anchor rule: a resolved instant beyond the target's end-of-day is clamped to
  it — yearless timeline text must never oversleep past the event itself.

**D3 — Invalidation by state machine, not cleanup jobs.**
`saleOpensAt` is only read in the `watching` clean-reschedule branch. `live`
targets stop polling (stop-on-detect); `closed`/`degraded` never reach the
branch; expiry detaches subscribers and closes targets. No new invalidation
paths → no new reverse-path risk (AGENTS surface: forward/reverse unchanged).

**D4 — Audits inside the same mutation, same helper.**
Three `appendWatcherAuditLog` inserts (want_created / want_attached /
target_subscriber_count_changed) at the exact write sites in `createAlert`.
No new mutation, no client exposure, no return-shape change. Audit volume:
+1–2 rows per alert action — accepted for gh#41 completeness; retention out of
scope.

**D5 — CI cleanup: `if: always() && !cancelled()`** on the cleanup steps/jobs of
both deploy workflows, with deployment-id presence guards so a skipped deploy
doesn't fail cleanup. No masking of real failures (job outcome still red).

## Task graph

```
T1 schema ──► T2 parser ──► T4 action wiring ──► T5 audits ──► T7c clock refactor
T3 scheduler clamp (pure, schedule.ts) ─┘            (same-file chain, sequential)
T6 CI workflows (independent)
T7a AGENTS hazard-6 · T7b mirror labels (independent)
```

PR-1 = T1–T4 (+tests) · PR-2 = T5 · PR-3 = T6+T7.

## Risks

| Risk | Mitigation |
|---|---|
| Egress cost of wake-at-open | ≤1 extra fetch per sale window vs today; min-cap preserves tiers |
| False-negative suppression | Parse regression → null → pure tiers (= today); anchor rule caps oversleep |
| Audit volume | Accepted (gh#41); compaction out of scope |
| `_generated` drift | codegen step + both tsc gates; stage deliberately |

## Out of scope

Sale-window **end** instants · pre-sale eligibility modeling · clearing
saleOpensAt on live transition · timezone work beyond preserving source offsets ·
audit retention · watcher.e2e.test.ts clock migration · UI display of sale times ·
wrangler.jsonc (untouched → cf:dry-run N/A).
