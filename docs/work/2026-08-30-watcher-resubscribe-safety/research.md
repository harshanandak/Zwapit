# Watcher resubscribe safety research

Issue: `ffea45c9-2783-48a0-90cf-b84c592eb1ed`

## Product meaning

A Request (`wants`) is the buyer's demand for one canonical catalog occurrence. An
availability Alert is the payoff: Zwapit watches the exact
`catalogItemId|city|date|format` occurrence, queues a notification when official
inventory becomes available, and deep-links the buyer out to BookMyShow or District.
Zwapit does not book the official inventory or touch that payment.

Resubscription matters because an explicit request to watch again must restore the
same occurrence, not silently move another request or report success without another
delivery attempt.

## Verified current behavior

- `convex/watcher.ts:343-348` sanitizes the exact collapse key and appends a 32-bit
  rolling hash. The loop iterates Unicode code points but hashes only
  `charCodeAt(0)`, so different astral characters with the same high surrogate, such
  as `😀` and `😁`, collide. The sanitizer also maps both surrogate pairs to the
  same underscores. This reproduces the still-current PR #48 review finding.
- `convex/watcher.ts:349-361` finds attached wants or rows using only the current
  generated key. A detached pre-hash row has neither `monitorTargetId` nor the new
  key, so it is missed and a replacement row is inserted.
- `convex/watcher.ts:685-732` deduplicates notifications on
  user/target/event/type/channel. When a known-live target is restored, a prior
  `sent` or terminal `failed` row causes enqueue to do nothing.
- `convex/__tests__/watcher.test.ts:1733-1783` varies both catalog item and city.
  The catalog item difference prevents it from isolating a sanitized-key collision.
- A repository-wide search found no consumer that parses or pattern-matches the
  generated `want_alert_...` structure. Tracked consumers treat `wantKey` as an
  opaque string. `convex/seed.ts` is a second producer, however, and currently
  emits a third sanitize-only format without persisting `collapseKey`.
- `convex/_generated/ai/guidelines.md` is absent, so this work proceeds under the
  repository Convex guidance only.

Evidence rung: rung 4 for all three bad paths. The RED run reproduced the identical
astral key, replacement insertion for both detached legacy shapes, unchanged terminal
outbox rows in closed and still-live cases, and duplicate legacy seed rows.

## Constraints

- Keep the collapse key byte-exact and limited to catalog item, city, date, format.
- Preserve every existing public `wantKey`; compatibility is lookup-only.
- Keep `createAlert` as the authenticated client-facing mutation exception.
- Audit want, monitor, and notification transitions.
- Preserve normal event fan-out idempotency.
- Make no schema, generated API, dependency, routing, native, or frontend change.
- Do not silently merge or delete already-duplicated wants. The repository is
  pre-user, so this slice prevents new corruption and preserves every existing
  key; verified duplicate live data would require a separate migration.

## Candidate approach

1. Generate new public keys from a lossless, format-versioned encoding of the exact
   buyer/collapse-key tuple, rather than a sanitized finite hash. Share the helper
   with the demo seed and preserve the seed's old-key lookup for rerun compatibility.
2. If attached/current-key lookup misses, query `wants.by_buyer` and match the exact
   persisted `collapseKey`, or reconstruct it from legacy watch fields.
3. On explicit reattachment only, requeue each existing terminal `sent`/`failed`
   notification to `pending`, reset delivery-attempt fields, and append a
   buyer-attributed `notification_requeued` audit row. Leave `pending` and
   `sending` rows alone. Both closed-to-live and already-live reattachments flow
   through one post-attach enqueue decision.

## Alternatives rejected initially

- A larger hash: collision-resistant is not collision-free and repeats the root
  design error.
- Rewriting old keys: breaks public references and requires migration/backfill.
- Creating another notification row: preserves the old row but complicates dedupe
  and can leave two active deliveries after repeated reattachment. The append-only
  audit log already preserves state-transition history while the outbox row holds
  current delivery state.
