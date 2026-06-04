# Beads Handoff: zwapit-noq

Issue: zwapit-noq
Branch: feat/seller-listing-persistence
Stage: dev handoff after Codex Tasks 1-3

## Summary

Planned and completed Codex-owned backend/shared Tasks 1-3 for persisted upload-first seller listing submission. This follows the verified build-order gap: seller upload screens exist, but they still use a mock fixture and do not create a Convex listing.

## Key Decisions

- Codex implements backend submission contract first.
- Claude implements seller UI wiring only after Codex handoff.
- Shared files require serial handoff.
- Upload remains mock/structured; no real file reading, OCR, or AI parsing.
- Listing owner id must be internal app user id only.

## Completed

- `97e0490` backend verified-seller submission mutation.
- `162c585` rule-state mapping and deterministic duplicate update behavior.
- `2000446` shared frontend adapter handoff contract.
- `4c7ca7c` evidence correction for Task 3 commit.

## Artifacts

- `docs/work/2026-06-04-seller-listing-persistence/research.md`
- `docs/work/2026-06-04-seller-listing-persistence/design.md`
- `docs/work/2026-06-04-seller-listing-persistence/tasks.md`
- `docs/work/2026-06-04-seller-listing-persistence/decisions.md`
- `docs/work/2026-06-04-seller-listing-persistence/evaluator-report.md`
- `docs/work/2026-06-04-seller-listing-persistence/evidence.md`

## Validation

- `bun test`: 89 pass / 0 fail.
- `bun run check`: 0 errors, 0 warnings, 11 existing hints.
- `bun run build`: passed.
- `bun scripts/verify-first-visible-slice.mjs`: passed.
- `bun scripts/e2e-buyer.mjs`: passed.
- `bun scripts/e2e-seller.mjs`: passed.
- Provider-owner search: no matches for provider ids being used as listing/order/app owner ids.

## Next

Claude starts Task 4 UI wiring from `tasks.md`. Codex should not implement
seller route/component UI unless validation after Claude handoff proves a narrow
fix is required.
