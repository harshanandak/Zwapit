# Watcher resubscribe safety decisions

## D1: preserve old keys

Existing `wantKey` values remain untouched. New key generation changes only inserts;
legacy rows are found by exact occurrence data and rearmed in place.

## D2: requeue terminal outbox rows

An explicit detached-to-attached transition is a new delivery request. Reuse the
same outbox row only after `sent` or terminal `failed`; preserve delivery history in
`audit_logs`. Active `pending`/`sending` work remains idempotent.

## D3: version and share the key generator

New keys use a `want_alert_v2~...~...` base-36 code-point encoding whose token and
tuple delimiters are disjoint. `createAlert` and fresh demo seeds share the helper;
the seed retains an explicit lookup for its known sanitize-only legacy key.

## D4: no destructive duplicate cleanup

Compatibility lookup preserves old keys and reuses the earliest exact match. It does
not delete or merge multiple existing matches. Zwapit is pre-user; if deployed data
verification later finds duplicates, that becomes an explicit migration with its own
reverse path.
