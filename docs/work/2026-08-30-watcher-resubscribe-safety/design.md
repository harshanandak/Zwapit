# Watcher resubscribe safety design

Status: approved at 9/10 after cross-model review round 2

## Problem

The alert payoff can fail in three linked ways after detachment: two accepted Unicode
occurrences can receive the same public key, an older exact request can be missed and
duplicated, and a restored known-live request can be blocked by the notification
outbox's original fire-once dedupe row.

## Design

### 1. Exact public key for new wants

Add one pure `buildAlertWantKey` helper in `convex/watcher/parse.ts`. It emits:

`want_alert_v2~<buyer code points in base36 joined by ->~<collapse-key code points in base36 joined by ->`

Each component is computed as
`Array.from(value, char => char.codePointAt(0)!.toString(36)).join("-")`; using
`charCodeAt(0)` is forbidden because it recreates the astral collision. Base-36
tokens contain only `0-9a-z`; `-` preserves code-point boundaries and `~`
preserves tuple boundaries. The mapping is injective for the full JavaScript string,
including astral characters and lone surrogates, and has no finite hash. The `~`
format marker also makes every v2 key disjoint from legacy sanitized keys. Existing
rows keep their key.

`createAlert` and fresh demo seed inserts use this helper. `seed.ts` first checks the
new key, then uses the same by-buyer exact-occurrence fallback as `createAlert`, so
rerunning against any old attached or detached seed format does not duplicate it;
fresh rows also persist `collapseKey`.

### 2. Exact legacy lookup

Keep the fast attached-target and current-key lookups. If both miss, query the
existing `wants.by_buyer` index in creation order. This compatibility scan covers
detached rows made under both the current hash key and older pre-hash key. A row
matches only when:

- its persisted `collapseKey` equals the requested exact key; or
- it predates that field and recomputing with `computeCollapseKey` from
  `catalogItemId`, trimmed `watchCity`, trimmed `watchDate`, and trimmed optional
  `watchFormat` equals the requested exact key. Missing format retains the required
  empty trailing collapse-key segment.

The earliest exact row is rearmed in place and keeps its original public key.
Rows with absent or empty `watchCity`/`watchDate` are skipped before reconstruction,
so non-watcher requests cannot match. The scan runs only
after both fast paths miss. This slice does not delete or merge multiple pre-existing
exact matches; finding those in deployed data requires a separate migration rather
than a destructive guess in `createAlert`.

### 3. Explicit live-payoff requeue

Track the target's effective post-attach status and remove the separate inner
closed-to-live enqueue. Both closed-to-live and already-live cases then use one
post-attach `enqueueForEvent` call. Pass an optional reattached-want id only when an
existing detached row becomes attached; brand-new and already-attached calls do not
receive requeue authority.

Ordinary event fan-out remains unchanged. For every currently selected
alert-type/channel dedupe row of the authorized reattached want only (dropped
preferences are not re-notified):

- no existing row: insert the normal pending row;
- `pending` or `sending`: no-op because a delivery is already active;
- `sent` or `failed`: patch the same outbox row to `pending`, clear
  `sentAt`/`claimedAt`, reset `attempts` to zero, and audit
  `notification_requeued` from the terminal state to `pending` with
  `actorId = buyerId` and `actorRole = buyer`.

Repeated idempotent `createAlert` calls while already attached cannot requeue.
Because the outbox row stores current delivery state while `audit_logs` is the
append-only history, reusing the row does not erase the prior transition record.

## State paths

Forward: detached `expired` want -> `open`; closed target -> `watching` or `live`;
terminal notification -> `pending` when known availability exists.

Reverse: the existing expiry sweep returns the want to `expired` and detaches it;
the existing dispatcher returns a requeued notification to `sent`, retryable
`pending`, or terminal `failed`. No new state is introduced.

## Security and integrity

- OWASP A01: authentication and internal app-user identity remain unchanged.
- OWASP A04/A08: exact matching prevents cross-occurrence reassignment and ambiguous
  public-key reads.
- OWASP A09: the explicit notification requeue receives an audit transition.
- No secret, provider call, booking operation, payment, or user-supplied URL is added.

## Acceptance criteria

1. Same buyer/catalog/date alerts for `Delhi😀` and `Delhi😁` produce distinct keys,
   wants, and monitor targets; each `getAlertPayoff` lookup returns its own occurrence.
2. Detached old-format wants both with and without `collapseKey` are rearmed in place
   from exact occurrence data, preserving their public key and one-row cardinality;
   a non-watcher request cannot match.
3. Reattaching to known-live availability requeues prior `sent` and `failed`
   notification rows to `pending`, resets attempt/claim/send fields, and appends one
   buyer-attributed audit transition per affected alert-type/channel row.
4. Existing pending/sending rows, repeated already-attached calls, and ordinary event
   fan-out do not duplicate or reset delivery.
5. Fresh seeds use the v2 helper and persist `collapseKey`; rerunning over a legacy
   sanitize-only or current-hash seed remains one want and one subscriber.
6. Targeted watcher/seed/parse tests, both TypeScript checks, Astro check, route check, build,
   full tests, Cloudflare dry run, and local CodeRabbit review pass.

## Non-goals

- No change to collapse-key dimensions, watcher polling, expiry policy, channels,
  actual sender delivery, frontend copy, schema, or deployed data. No destructive
  cleanup of already-corrupted duplicates is attempted without live evidence.
