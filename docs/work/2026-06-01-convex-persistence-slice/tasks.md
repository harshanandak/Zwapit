# First Convex Persistence Slice Tasks

Issue: `zwapit-dk0`
Workflow: Claude implements first; Codex validates after.

## Global Constraints

- Do not implement during this planning turn.
- Preserve current UI behavior and user-facing wording.
- Keep mock auth as `mockCurrentUserId = "user_demo_1"`.
- No real Clerk, Razorpay, payments, payout setup, production admin, demand
  discovery, or category expansion.
- Do not run Claude and Codex against the same files in parallel.
- Package/config/schema/shared-type edits are owned by the active implementer
  only until handoff.

## Wave 1: Claude Implementation

### Task 1: Add Convex Project Wiring

Owner: Claude
Depends on: accepted plan
Parallel-safe: no
Files:

- `package.json`
- `bun.lock`
- `convex/**`
- `src/lib/convex/**`
- Astro/React entry files needed for provider wiring

OWNS: Convex package/config/provider setup.

What to implement:

- Install the `convex` package.
- Initialize the local `convex/` folder.
- Add a provider/client boundary using `PUBLIC_CONVEX_URL` for browser code,
  with `VITE_CONVEX_URL` retained only as a legacy fallback.
- Keep app boot resilient when Convex is not configured in a local shell.

TDD steps:

1. Add a failing test or smoke check proving Convex client wiring is discoverable
   without changing visible route behavior.
2. Implement the smallest provider/client boundary.
3. Run `bun run check`.

Expected output:

- Convex can be started locally.
- Existing visible routes still render.
- No real auth or payment code appears.

Validation:

- `bun run check`
- route smoke/acceptance command used by the accepted visible slice

### Task 2: Create First-Slice Convex Schema

Owner: Claude
Depends on: Task 1
Parallel-safe: no
Files:

- `convex/schema.ts`
- `convex/_generated/**`
- schema tests or generated type checks

OWNS: first-slice Convex schema.

What to implement:

- Add tables for users, auth identities, user verifications, mocked seller
  payment accounts, source rules, listings, orders, transfer tasks, issues, and
  audit logs.
- Add indexes described in `design.md`.
- Preserve public demo keys for routes/tests.

TDD steps:

1. Add schema/type checks for required fields and indexes.
2. Implement schema.
3. Regenerate Convex-generated files through the documented Convex dev command.

Expected output:

- Schema models existing `src/lib/types.ts` contracts without renaming states.

Validation:

- Convex codegen/check command
- `bun run check`

### Task 3: Seed Existing Demo Fixture Into Convex

Owner: Claude
Depends on: Task 2
Parallel-safe: no
Files:

- `convex/seed.ts` or equivalent seed mutation file
- `src/lib/mock/**` only if importing fixture helpers is required
- tests for seed idempotency

OWNS: deterministic demo seed.

What to implement:

- Seed the current `createMockFixture()` data into Convex.
- Make seeding idempotent by public demo keys.
- Store source rule id/version, mock seller payment readiness, listing, order,
  transfer task, issue draft, and initial audit-log baseline.

TDD steps:

1. Add a failing seed idempotency test.
2. Implement seed mutation.
3. Run seed twice and prove no duplicate core docs.

Expected output:

- Local Convex contains exactly one demo listing/order/transfer task for the
  accepted mock flow after repeated seeding.

Validation:

- seed test
- Convex dashboard/query output or CLI evidence

### Task 4: Add Convex Data Access Adapter

Owner: Claude
Depends on: Task 3
Parallel-safe: no
Files:

- `src/lib/convex/**`
- `src/lib/flow/mockFlow.ts`
- focused tests for adapter shape

OWNS: UI-compatible data adapter.

What to implement:

- Add read adapters that return the same effective shape currently produced by
  `createMockFixture()` and `connectMock*`.
- Add mutation wrappers for mock checkout, seller submit transfer, buyer confirm,
  and buyer report issue.
- Keep fallback/loading behavior within current UI expectations.

TDD steps:

1. Add failing adapter contract tests comparing Convex-backed view shape to
   current mock flow shape.
2. Implement adapter.
3. Keep existing mock tests green.

Expected output:

- Routes can switch from direct fixture reads to adapter reads without UI copy or
  state regressions.

Validation:

- adapter contract tests
- existing mock fixture/state/validation tests

### Task 5: Connect Existing Screens To Convex-Backed Flow

Owner: Claude
Depends on: Task 4
Parallel-safe: no
Files:

- `src/pages/app/**`
- `src/components/**` only where required for React islands/loading state
- `src/lib/flow/timelinePanel.client.ts`
- route acceptance tests

OWNS: UI connection while preserving behavior.

What to implement:

- Connect Home, listing detail, checkout, My Tickets, buyer order timeline, Sell,
  and seller Orders to Convex-backed adapter data.
- Keep bottom tabs and existing route names.
- Keep seller Orders inside Sell.
- Keep current price breakdown and friendly language.

TDD steps:

1. Add failing route/acceptance checks for visible pages using seeded Convex
   data.
2. Wire pages through adapter.
3. Verify current route screenshots or textual assertions are unchanged.

Expected output:

- The user-visible flow behaves the same, but state survives reload locally.

Validation:

- route acceptance tests
- `bun run check`

### Task 6: Handoff Evidence For Codex

Owner: Claude
Depends on: Tasks 1-5
Parallel-safe: no
Files:

- `docs/work/2026-06-01-convex-persistence-slice/evidence.md`
- optional implementation handoff note under the same folder

OWNS: implementation evidence handoff.

What to implement:

- Record branch, commit SHA, changed files, Convex command, seed command,
  test/typecheck output, and any fallback/loading decisions.
- State explicitly that hard exclusions were not implemented.

TDD steps:

1. Run all validation commands before writing final handoff.
2. Update evidence with exact command outputs or summaries.

Expected output:

- Codex can validate without rediscovering implementation context.

Validation:

- evidence file includes all required handoff fields

## Wave 2: Codex Validation After Claude Handoff

### Task 7: Validate Schema, Functions, State Transitions, And Audit Logs

Owner: Codex
Depends on: Claude handoff evidence
Parallel-safe: no
Files:

- read/review `convex/**`
- read/review `src/lib/**`
- validation notes in `docs/work/2026-06-01-convex-persistence-slice/evidence.md`

OWNS: backend correctness validation.

What to validate:

- Convex schema matches the first-slice data model.
- Public mutations enforce existing transition rules.
- Internal helpers protect audit writes and transition invariants.
- Seed and mock checkout are idempotent.
- No payment/refund/payout/admin mutation is exposed.

Validation:

- Convex codegen/check
- unit tests
- `bun run check`
- source grep for hard exclusions

### Task 8: Validate UI Behavior Preservation

Owner: Codex
Depends on: Task 7
Parallel-safe: no
Files:

- read/review route/component changes
- acceptance evidence under this work folder

OWNS: visible behavior validation.

What to validate:

- Home, Sell, My Tickets, Me tabs remain.
- Seller Orders remains inside Sell.
- Listing detail and checkout still show transfer mode, protected payment, fee,
  total payable, transfer deadline, and protection deadline.
- Buyer/seller timelines show the same states.
- Loading/fallback behavior does not introduce new product flows.

Validation:

- route acceptance tests
- local browser smoke if a dev server is used

### Task 9: Validate Hard Exclusions And Produce Gate Result

Owner: Codex
Depends on: Tasks 7-8
Parallel-safe: no
Files:

- `docs/work/2026-06-01-convex-persistence-slice/evidence.md`

OWNS: final validation gate.

What to validate:

- No real Clerk.
- No Razorpay.
- No real payment provider logic.
- No payout setup beyond mocked readiness.
- No production admin.
- No demand discovery.
- No category expansion.

Validation:

- grep/source search evidence
- final validation summary with pass/fail and any follow-up issues

## `/dev` Entry Contract

Claude may start `/dev` only after this planning branch is merged or the user
explicitly approves implementation from this plan.

Codex may start validation only after Claude provides the handoff evidence listed
in Task 6.
