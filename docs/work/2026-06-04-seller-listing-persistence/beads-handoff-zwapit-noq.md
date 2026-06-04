# Beads Handoff: zwapit-noq

Issue: zwapit-noq
Branch: feat/seller-listing-persistence
Stage: plan

## Summary

Planned the next Zwapit PR as persisted upload-first seller listing submission. This follows the verified build-order gap: seller upload screens exist, but they still use a mock fixture and do not create a Convex listing.

## Key Decisions

- Codex implements backend submission contract first.
- Claude implements seller UI wiring only after Codex handoff.
- Shared files require serial handoff.
- Upload remains mock/structured; no real file reading, OCR, or AI parsing.
- Listing owner id must be internal app user id only.

## Artifacts

- `docs/work/2026-06-04-seller-listing-persistence/research.md`
- `docs/work/2026-06-04-seller-listing-persistence/design.md`
- `docs/work/2026-06-04-seller-listing-persistence/tasks.md`
- `docs/work/2026-06-04-seller-listing-persistence/decisions.md`
- `docs/work/2026-06-04-seller-listing-persistence/evaluator-report.md`
- `docs/work/2026-06-04-seller-listing-persistence/evidence.md`

## Next

Wait for explicit user instruction before `/dev`.
