# Beads Handoff: zwapit-noq

Issue: zwapit-noq
Branch: feat/seller-listing-persistence
Stage: dev handoff after Claude Task 4 (UI wiring)

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

## Claude Task 4 (UI wiring) — complete

Claude-owned seller UI now persists the first-slice listing through the Codex
adapter. Files changed (6, all in Claude's owned set; `StepNav.astro` unchanged):

- `src/components/seller/format.ts` — added pure `buildSellerDraftFromListing`,
  `sellerSubmissionView`, `SellerSubmissionView`, and the `zwapit:seller-draft` /
  `zwapit:seller-published` storage-key constants. No DOM/sessionStorage in this
  module (page scripts own that).
- `src/pages/app/sell/{upload,confirm,price,promise,orders}.astro` — embed the
  detected draft as inline JSON, carry it (and the chosen price) via
  sessionStorage, submit at the promise step via `submitSellerListingDraft`, and
  render friendly states: submitted / Waitlist Only / Under review / Cannot List /
  signed-out / phone verification required / retry (incl. no-Convex `mock`
  fallback). Delayed-login + phone gate preserved.

Fresh validation after Task 4 (from the worktree): `bun run check` 0/0/11,
`bun test` 89 pass / 0 fail, `bun run build` 15 pages, slice verifier passed,
e2e-buyer passed, e2e-seller passed.

Changes are in the working tree (not committed) per the user's commit-on-request
rule; ready for Codex review / commit.

## Open item for Codex (Task 5)

- Seller e2e/test coverage for the new submit path: `scripts/e2e-seller.mjs` is
  not Claude-owned and CLAUDE.md assigns tests to Codex, so Claude deferred the
  Task-4 RED test. The pure, testable surface is `sellerSubmissionView` in
  `src/components/seller/format.ts`; add assertions covering submitted / waitlist /
  review / cannot-list / auth / phone / retry outcomes.
- Coverage caveat: the promise-step submit interaction (click -> preventDefault ->
  validate -> `submitSellerListingDraft` -> `sellerSubmissionView` -> navigate ->
  orders banner) is not exercised by any gate run here (e2e-seller drives the lib
  layer, slice verifier only greps server HTML) and was not browser-tested; it
  needs the Codex-owned seller e2e to be truly verified end-to-end.

## Next

Codex runs Task 5 final validation/review and adds the deferred seller e2e
coverage. No backend contract change was needed during UI wiring.
