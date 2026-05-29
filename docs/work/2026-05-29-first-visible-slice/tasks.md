# First Visible Slice Tasks

Issue: `zwapit-27t`
Design: `docs/work/2026-05-29-first-visible-slice/design.md`
Feature slug: `first-visible-slice`
Forge stage: `/plan`
Status: evaluator fixes applied; `/dev` remains blocked until Forge gates pass

## Sequencing Rules

- Do tasks in order unless a later task is explicitly marked parallel-safe.
- Do not start parallel UI/backend work until Task 2 is complete.
- Do not add real auth, real payments, Razorpay, production admin, or production source integrations in this slice.
- Every implementation task must check `docs/IMPLEMENTATION_CONTRACT.md`.
- UI tasks that start before fixture modules exist must use only `docs/IMPLEMENTATION_CONTRACT.md` fixture fields and must not invent fields.

## Ownership Matrix

| Track | Owner | Owns | Cannot Edit In Parallel |
| --- | --- | --- | --- |
| Scaffold | Codex | `package.json`, config files, route shell, initial app structure | all app files until Task 2 completes |
| State/rules | Codex | `src/lib/mock/**`, `src/lib/rules/**`, `src/lib/state/**`, tests | route shell, UI copy/components unless handed off |
| Buyer UI | Claude | `src/pages/app/home.astro`, listing/checkout/tickets routes, buyer components | shared types, package/config, seller routes |
| Seller UI | Claude | sell routes, seller Orders route, seller components | shared types, package/config, buyer routes |
| Integration | Codex + Claude handoff | explicit files from completed tasks only | any file still owned by another active agent |

Shared files requiring serial handoff:
- `package.json`
- `astro.config.*`
- `tailwind.config.*`
- `capacitor.config.*`
- `src/lib/types.ts`
- route layout/navigation constants
- global styles

## Task 1: Scaffold Astro React Tailwind Capacitor

Owner: Codex
Depends on: none
Parallel-safe: no
File(s): `package.json`, `bun.lock`, `tsconfig.json`, `astro.config.mjs`, `tailwind.config.mjs`, `postcss.config.mjs`, `capacitor.config.ts`, `src/env.d.ts`, `src/styles/global.css`, `src/layouts/AppLayout.astro`, `public/favicon.svg`
OWNS: all scaffold/config/app files until Task 2 is complete
What to implement: createAppScaffold(), configureTailwind(), configureCapacitor(), preservePlanningDocs()

TDD steps:
1. Write or define smoke check: `bunx astro check` or equivalent must fail before scaffold because app config is absent.
2. Implement the scaffold and package scripts for `dev`, `build`, and `check`.
3. Run the check/build command and record the passing output.
4. Confirm no files under `docs/` were deleted.

Expected output:
- Astro + React app setup
- Tailwind setup
- Capacitor setup
- package scripts for dev/build/check
- no feature UI beyond shell placeholders

Validation:
- install succeeds
- typecheck/build command exists
- no docs are deleted

## Task 2: Implement Route Skeleton And Mobile Shell

Owner: Codex, then Claude can refine UI after handoff
Depends on: Task 1
Parallel-safe: no
File(s): `src/pages/index.astro`, `src/pages/app/index.astro`, `src/pages/app/home.astro`, `src/pages/app/sell/index.astro`, `src/pages/app/sell/upload.astro`, `src/pages/app/sell/confirm.astro`, `src/pages/app/sell/price.astro`, `src/pages/app/sell/promise.astro`, `src/pages/app/sell/orders.astro`, `src/pages/app/tickets.astro`, `src/pages/app/listings/[listingId].astro`, `src/pages/app/checkout/[listingId].astro`, `src/pages/app/orders/[orderId].astro`, `src/pages/app/me.astro`, `src/pages/admin/index.astro`, `src/components/AppShell.*`, `src/components/BottomNav.*`
OWNS: route files and shell/navigation components
What to implement: renderRouteSkeletons(), renderBottomNav(), redirectAppIndex(), renderAdminPlaceholder()

TDD steps:
1. Add a route coverage smoke script or test that checks every route path from `docs/IMPLEMENTATION_CONTRACT.md`.
2. Run it before routes exist and confirm missing routes fail.
3. Implement route placeholders and bottom navigation.
4. Run route coverage plus build/check and confirm all routes render.

Expected output:
- bottom nav: Home, Sell, My Tickets, Me
- routes render placeholders without broken navigation
- Seller Orders route exists inside Sell
- `/admin` is placeholder only

Validation:
- every route in the implementation contract renders
- no Transactions bottom-nav label
- no Sales primary seller label

## Task 3: Add Local Mock Fixture Contract

Owner: Codex
Depends on: Task 2
Parallel-safe: yes, after Task 2
File(s): `src/lib/types.ts`, `src/lib/mock/users.ts`, `src/lib/mock/listings.ts`, `src/lib/mock/orders.ts`, `src/lib/mock/transfers.ts`, `src/lib/mock/issues.ts`, `src/lib/mock/audit.ts`, `src/lib/auth/mockAuth.ts`, `src/lib/auth/authAdapter.ts`, `src/lib/mock/__tests__/fixtures.test.ts`
OWNS: `src/lib/types.ts`, `src/lib/mock/**`, `src/lib/auth/**`
What to implement: getCurrentUser(), requireUser(), requirePhoneVerified(), syncUserToConvex(), createMockFixture(), calculateCheckoutTotal()

TDD steps:
1. Write fixture contract tests for IDs, fee, GST, totals, transfer deadlines, auth adapter return shape, and `OFFICIAL_TRANSFER`.
2. Confirm tests fail before fixture modules exist.
3. Implement local TypeScript fixtures and mock auth adapter.
4. Run fixture tests and typecheck.

Expected output:
- `user_demo_1`
- `listing_bms_event_1`
- `order_demo_1`
- `transfer_demo_1`
- `issue_demo_1`
- source rule fixture for `bookmyshow_event`
- auth adapter contract backed by `mockCurrentUserId = "user_demo_1"`

Validation:
- fixture values match `docs/IMPLEMENTATION_CONTRACT.md`
- fee is INR 10 + GST
- transfer mode is `OFFICIAL_TRANSFER`
- auth adapter does not expose provider ids as app ids

## Task 4: Build Buyer UI Flow

Owner: Claude
Depends on: Task 2; may use Task 3 exports after available
Parallel-safe: yes, after Task 2
File(s): `src/pages/app/home.astro`, `src/pages/app/listings/[listingId].astro`, `src/pages/app/checkout/[listingId].astro`, `src/pages/app/tickets.astro`, `src/pages/app/orders/[orderId].astro`, `src/components/buyer/**`
OWNS: buyer route UI and buyer components only
What to implement: renderHomeMarketplace(), renderListingDetail(), renderCheckoutPreview(), renderMyTickets(), renderBuyerTimeline()

TDD steps:
1. Add UI smoke checks or component tests for required buyer copy/states.
2. Confirm checks fail before buyer UI is implemented.
3. Implement buyer UI using only documented fixture fields.
4. Run UI smoke checks and build/check.

Expected output:
- Home marketplace
- listing detail
- checkout preview
- My Tickets
- buyer order timeline

Validation:
- listing detail shows transfer mode, protection, price, INR 10 + GST fee, total, transfer deadline, and protection deadline
- checkout creates/uses mock checkout state only
- My Tickets displays buyer timeline states

## Task 5: Build Seller UI Flow

Owner: Claude
Depends on: Task 2; may use Task 3 exports after available
Parallel-safe: yes, after Task 2
File(s): `src/pages/app/sell/index.astro`, `src/pages/app/sell/upload.astro`, `src/pages/app/sell/confirm.astro`, `src/pages/app/sell/price.astro`, `src/pages/app/sell/promise.astro`, `src/pages/app/sell/orders.astro`, `src/components/seller/**`
OWNS: seller route UI and seller components only
What to implement: renderSellOverview(), renderUploadFlow(), renderDetectedDetails(), renderPriceEstimate(), renderSellerPromise(), renderSellerOrders()

TDD steps:
1. Add UI smoke checks or component tests for required seller copy/states.
2. Confirm checks fail before seller UI is implemented.
3. Implement seller UI using only documented fixture fields.
4. Run UI smoke checks and build/check.

Expected output:
- Sell overview
- upload flow
- detected details confirmation
- price/payout estimate
- seller promise
- seller Orders

Validation:
- seller flow uses Orders, not Sales
- seller sees transfer required and payout waiting states
- payout setup is mocked only

## Task 6: Implement Local Source Rule Engine

Owner: Codex
Depends on: Task 3
Parallel-safe: yes, after Task 3
File(s): `src/lib/rules/sourceRules.ts`, `src/lib/rules/evaluateRule.ts`, `src/lib/rules/__tests__/evaluateRule.test.ts`
OWNS: `src/lib/rules/**`
What to implement: evaluateSourceRule(), getSourceRule(), classifySourceCategory(), applyPriceRule(), getBlockedBehavior()

TDD steps:
1. Write tests for `AUTO_APPROVE`, `AUTO_BLOCK`, `AUTO_WAITLIST`, and `NEEDS_MANUAL_REVIEW`.
2. Confirm tests fail before rule engine exists.
3. Implement first concrete `bookmyshow_event` rule and generic evaluator.
4. Run rule tests and typecheck.

Expected output:
- local rule evaluation for all four review outputs
- first concrete rule for `bookmyshow_event`
- internal statuses `ALLOW`, `AMBER`, `DEMAND_ONLY`, `BLOCKED`
- required rule fields from `AGENTS.md`

Validation:
- rules include id, version, source, category, transferability, protection level, eligibility fields, price rule, payout policy, blocked behavior, and metadata
- listing stores rule id and rule version
- manual review is exception-only

## Task 7: Implement State Transition Helpers

Owner: Codex
Depends on: Task 3
Parallel-safe: yes, after Task 3
File(s): `src/lib/state/orderTransitions.ts`, `src/lib/state/listingTransitions.ts`, `src/lib/state/issueTransitions.ts`, `src/lib/state/auditEvents.ts`, `src/lib/state/__tests__/orderTransitions.test.ts`, `src/lib/state/__tests__/listingTransitions.test.ts`
OWNS: `src/lib/state/**`
What to implement: mockPay(), sellerMarkTransferred(), buyerConfirmReceived(), openProtectionWindow(), completeAfterWindow(), transferDeadlineMissed(), buyerReportIssue(), submitForRuleCheck(), autoApproveListing(), autoWaitlistListing(), autoBlockListing()

TDD steps:
1. Write transition tests for happy path, invalid actor, invalid state, timeout, and issue path.
2. Confirm tests fail before transition helpers exist.
3. Implement explicit transition helpers and audit event creation.
4. Run transition tests and typecheck.

Expected output:
- local transition helpers for listing, order, transfer, issue, and audit events

Validation:
- invalid actor/action/state transitions are rejected
- checkout starts at `checkout_pending`
- `mockPay()` moves to `transfer_pending`

## Task 8: Add Validation Blockers

Owner: Codex
Depends on: Task 6, Task 7
Parallel-safe: yes
File(s): `src/lib/validation/sellerValidation.ts`, `src/lib/validation/checkoutValidation.ts`, `src/lib/validation/transferValidation.ts`, `src/lib/validation/__tests__/sellerValidation.test.ts`, `src/lib/validation/__tests__/checkoutValidation.test.ts`, `src/lib/validation/__tests__/transferValidation.test.ts`
OWNS: `src/lib/validation/**`
What to implement: validateSellerListing(), validateCheckout(), validateTransferSubmission(), validateBuyerConfirmation()

TDD steps:
1. Write blocker tests for every validation rule in `docs/IMPLEMENTATION_CONTRACT.md`.
2. Confirm tests fail before validation modules exist.
3. Implement validation functions with explicit reason codes.
4. Run validation tests and typecheck.

Expected output:
- validation blockers for seller listing, checkout, transfer submission, and buyer confirmation

Validation:
- seller listing creation blocks missing required fields
- checkout blocks non-live listing, expired deadline, hidden total, blocked/waitlist rules, and non-ready mock payout account
- transfer submission blocks wrong state or missing evidence
- buyer confirmation blocks wrong state

## Task 9: Integrate Buyer/Seller UI With Local State

Owner: Claude + Codex handoff
Depends on: Task 4, Task 5, Task 6, Task 7, Task 8
Parallel-safe: no
File(s): `src/pages/app/home.astro`, `src/pages/app/listings/[listingId].astro`, `src/pages/app/checkout/[listingId].astro`, `src/pages/app/tickets.astro`, `src/pages/app/orders/[orderId].astro`, `src/pages/app/sell/index.astro`, `src/pages/app/sell/upload.astro`, `src/pages/app/sell/confirm.astro`, `src/pages/app/sell/price.astro`, `src/pages/app/sell/promise.astro`, `src/pages/app/sell/orders.astro`, `src/lib/mock/listings.ts`, `src/lib/mock/orders.ts`, `src/lib/state/orderTransitions.ts`, `src/lib/rules/evaluateRule.ts`, `src/lib/validation/checkoutValidation.ts`
OWNS: integration touchpoints only after previous owners hand off
What to implement: connectMockListingFlow(), connectMockCheckoutFlow(), connectSellerOrderFlow(), connectTimelineActions()

TDD steps:
1. Add end-to-end smoke checks for buyer and seller mock paths.
2. Confirm smoke checks fail before integration.
3. Wire UI flows to local fixtures/state helpers.
4. Run smoke checks, unit tests, and build/check.

Expected output:
- buyer can go Home -> Listing -> Checkout -> My Tickets timeline
- seller can go Sell -> Upload -> Confirm -> Price -> Promise -> Orders
- timeline advances through mock state transitions

Validation:
- buyer path works with local state only
- seller path works with local state only
- no real auth/payment/admin/source integration is introduced

## Task 10: Acceptance Verification

Owner: Codex
Depends on: Task 9
Parallel-safe: no
File(s): `docs/IMPLEMENTATION_CONTRACT.md`, `scripts/verify-first-visible-slice.mjs`, `tests/acceptance/firstVisibleSlice.test.ts`, `src/pages/index.astro`, `src/pages/app/index.astro`, `src/pages/app/home.astro`, `src/pages/app/sell/index.astro`, `src/pages/app/tickets.astro`, `src/pages/app/me.astro`, `src/pages/admin/index.astro`
OWNS: verification only; no product changes unless a failed check requires a focused fix
What to implement: verifyAcceptanceCriteria(), verifyNoScopeDrift(), verifyRouteCoverage()

TDD steps:
1. Run the full route coverage, unit tests, typecheck, and build/check suite.
2. Run manual or browser smoke checks for the mobile shell.
3. Run evaluator agents for implementation-scope drift.
4. Fix only failures tied to this task, then rerun checks.

Expected output:
- route coverage check
- typecheck/build
- visual/manual smoke check
- evaluator confirmation

Validation:
- all acceptance criteria in `docs/IMPLEMENTATION_CONTRACT.md` pass
- no real auth/payment/admin/source integration added
- evaluator agents find no blocking implementation-scope drift

## Future Follow-Up Requiring Explicit User Approval

Plan the next Convex persistence slice only after the first visible mock UI is accepted and the user explicitly asks for it.

Future scope:
- first backend schema/persistence slice
- no payments, settlement holds, notifications, demand discovery, or production admin unless separately approved
