# Auth And Identity Slice Tasks

Issue: `zwapit-skf`

## Ownership Model

Codex implements first and owns backend correctness, adapter contract, Convex identity mapping, security boundaries, and tests.

Claude implements UI auth states only after Codex provides the backend contract handoff evidence listed in Task 6.

Codex validates after Claude and before ship.

## Task 1 - Codex - Adapter Contract Tests

Files likely affected: `src/lib/auth/**`, `src/lib/types.ts`, auth tests.

RED:
- Add tests for signed-out, signed-in, phone-verification-required, and mock fallback adapter states.
- Add assertion that provider id is not returned as app user id.

GREEN:
- Define the adapter result types and no-op/mock implementation shape needed by later tasks.

Acceptance:
- Tests fail before implementation and pass after.
- Existing mock `user_demo_1` behavior remains available in local/test mode.

## Task 2 - Codex - Convex Identity Sync

Files likely affected: `convex/schema.ts`, new/updated Convex auth identity functions, generated Convex files, Convex tests.

RED:
- Add tests for create, reuse, provider subject uniqueness, and phone verification default.

GREEN:
- Implement idempotent sync from provider subject to internal app user id.
- Store provider subject only in `auth_identities`.

Acceptance:
- Repeated sync returns the same app user id.
- `users`, `auth_identities`, and `user_verifications` remain consistent.

## Task 3 - Codex - Guard Persisted Actions

Files likely affected: `convex/orders.ts`, `convex/listings.ts`, `convex/model.ts`, adapter/data tests.

RED:
- Add tests that missing auth, wrong buyer, and wrong seller are rejected.
- Add tests that valid buyer/seller use stored app ids for actor fields.

GREEN:
- Derive actor app user id from identity mapping before order/listing transitions.

Acceptance:
- Client-supplied buyer/seller ids are not authoritative for protected paths.
- Demo compatibility is explicit and isolated.

## Task 4 - Codex - Login Gate Contract For UI

Files likely affected: `src/lib/auth/**`, `src/lib/convex/dataAdapter.ts`, lightweight UI state contract tests.

RED:
- Add tests for buy/sell action auth requirements and redirect intent preservation.

GREEN:
- Expose a small UI contract that says whether an action can proceed, needs sign-in, or needs phone verification.

Acceptance:
- Existing route flow remains listing -> protection -> checkout.
- No payment, payout, KYC, admin, demand, or category code appears.

## Task 5 - Claude - UI Auth States After Backend Handoff

Entry contract:
- Codex has completed Tasks 1-4.
- Task 6 handoff evidence exists.

Files likely affected: listing detail buy action, sell entry action, shared auth state components if needed.

Implement:
- Signed-out action state for buy.
- Signed-out action state for sell.
- Phone-verification-needed state shape.
- Loading/error states from the adapter contract.

Acceptance:
- UI behavior remains mobile-first and preserves current visible flow.
- No new product feature surfaces are added.

## Task 6 - Codex - Backend Contract Handoff To Claude

Write evidence before Claude starts:

- Adapter state/result shape.
- Convex functions and their allowed callers.
- UI action contract examples.
- Test command output.
- Explicit hard exclusions still absent.

## Task 7 - Codex - Validation After Claude

Run:

- `bun run check`
- `bunx tsc --project convex/tsconfig.json --noEmit`
- `bun test`
- `bun run build`
- `bun scripts/verify-first-visible-slice.mjs`
- `bun scripts/e2e-buyer.mjs`
- `bun scripts/e2e-seller.mjs`
- scope drift search for Razorpay, payments, payout setup, full KYC, admin expansion, demand discovery, and category expansion

Acceptance:
- All required gates pass or failures are documented with a new Beads blocker.
- Codex confirms no provider ids are used as app ids in app data.

