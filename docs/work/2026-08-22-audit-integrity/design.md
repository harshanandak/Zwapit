# Audit integrity + hygiene slice â€” design

**Date:** 2026-08-22 Â· **Kernel:** gh#41 (want audits), 1428a544 (cleanup-on-timeout),
e3a43b84 (mirror labels), #40 (hazard-6 reword), 2427bbc4 (POLL_NOW), ff3e0a5a (chase nit)
**Planning inputs:** GPT-5.6-sol (primary plan, pi lane) Â· DeepSeek-v4-flash-free (test
matrix + stress-test, pi lane â€” free tier dodges the OpenCode billing wall that killed
the pro lane) Â· Claude-Fable-5 standing in for "muse" (no such provider exists in any
harness) as adversarial edge-case hunt. Findings fold in before ship.

## Problem

1. `createAlert` writes three want-side rows with zero `audit_logs` coverage
   (gh#41) â€” a live violation of AGENTS never-compromise #4.
2. Deploy-workflow cleanup steps can't run when an earlier job times out.
3. Docs drift: hazard 6 claims showtime was a collapse-key input; convex-ai
   mirrors look auto-regenerated; `POLL_NOW=2030` test constant is a landmine.

## Draft design (lanes critique this)

**A â€” Want audits, same mutation, no dedupe on content-change:**
| Write site | Audit row |
|---|---|
| wants INSERT (new subscriber) | `{action:"want_created", entityType:"want", entityId:wantKey, toState:"open"}` |
| wants PATCH (re-arm) | `{action:"want_rearmed", entityType:"want", entityId:wantKey}` |
| subscriberCount increment | `{action:"monitor_target_subscriber_count_changed", entityType:"monitor_target", entityId:collapseKey, fromState:String(old), toState:String(new)}` |

Open questions sent to lanes: dedupe no-op re-arms? OCC-retry double-write risk?
Late-subscriber-on-live ordering vs audits?

**B â€” CI cleanup:** inspect-first, then `if: always() && !cancelled()` +
deployment-id presence guards.

**C/D â€” docs + chase-sort one-liner** per kernel notes.

## Risks

Audit volume from re-arm spam (lane question 1) Â· OCC retry double-writes
(question 2) Â· CI cleanup double-fire Â· POLL_NOW migration colliding with fixed
fixture dates.

## Out of scope

Backlog drain ops run (2427bbc4 part a) Â· audit retention/compaction Â· any UI of
audit rows Â· Telegram/email senders Â· payment surfaces.

## Acceptance scenarios (walked before ship)

1. New buyer subscribes -> audit_logs gains want_created (entityId=wantKey, toState=open, actorRole=buyer) AND monitor_target_subscriber_count_changed (entityId=collapseKey, from->to counts, actorRole=buyer).
2. Same buyer re-arms -> want_rearmed row; NO second count-change row.
3. Second buyer joins -> own want_created + one more count-change (total 2).
4. Chase selection: two past-opened general windows -> most recent wins.
5. Sale window beyond event EOD -> not persisted, not audited as window-driven.

## OWASP note (A09 Security Logging & Monitoring Failures)

These rows close the gh#41 logging gap: every createAlert write is now attributable (actorId+actorRole) and sequenced (by_seq). No PII beyond existing buyer ids; no secrets in messages. Risk accepted: audit volume from re-arm spam (each call writes 1 rearmed row) — bounded by client action rate, compaction deferred.
