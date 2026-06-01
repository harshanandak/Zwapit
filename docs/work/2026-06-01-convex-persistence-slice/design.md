# First Convex Persistence Slice Design

Issue: `zwapit-dk0`
Status: plan ready after evaluator loop

## Goal

Persist the accepted first visible mock flow in Convex while preserving the
current mobile UI behavior and wording.

This slice answers: can the existing Home -> Listing -> Checkout -> My Tickets
and Sell -> Orders timeline flow read/write through Convex without changing what
the user sees?

## Non-Goals

- No real Clerk.
- No real Razorpay.
- No real payments.
- No seller payout setup beyond existing mocked readiness.
- No production admin workflow.
- No demand discovery.
- No category expansion.
- No wallet, real KYC, real OCR, AI parser, or production source integration.

## Approach Selected

Extend the existing mock contracts with a Convex-backed data access layer.

Do not redesign the UI. Do not rename established states or transfer modes. Use
the current mock fixture as deterministic seed data, then make the current
screens consume the same shape through an adapter that can preserve fallback
behavior while Convex is loading or not configured locally.

Existing anchors:

- Data shape: `src/lib/types.ts:124-183`.
- Demo fixture: `src/lib/mock/fixtures.ts:13-32`.
- UI connector functions: `src/lib/flow/mockFlow.ts:37-147`.
- State transitions: `src/lib/state/orderTransitions.ts` and
  `src/lib/state/issueTransitions.ts`.
- Validation: `src/lib/validation/checkoutValidation.ts`,
  `src/lib/validation/sellerValidation.ts`, and
  `src/lib/validation/transferValidation.ts`.
- Current first-slice table direction: `docs/DATA_MODEL.md:39-54`.

## Data Model

Create Convex tables for the first persistence slice only:

- `users`
- `auth_identities`
- `user_verifications`
- `seller_payment_accounts`
- `source_rules`
- `listings`
- `orders`
- `transfer_tasks`
- `issues`
- `audit_logs`

Use Convex document ids internally, but preserve existing external demo ids as
stable fields such as `appUserId`, `listingKey`, `orderKey`, `transferTaskKey`,
and `sourceRuleKey` so current UI routes and tests can map predictably.

Indexes should cover:

- auth identity by provider/provider subject
- listings by public key and state
- orders by buyer id, seller id, public key, and listing id
- transfer tasks by order id
- audit logs by entity type/entity id
- source rules by source/category/version

## Function Surface

Public queries:

- `getCurrentFixtureView`
- `getHomeListings`
- `getListingDetail`
- `getCheckoutView`
- `getBuyerTickets`
- `getBuyerOrder`
- `getSellerOrders`

Public mutations for the mock-visible flow:

- `seedDemoFixture`
- `mockCheckout`
- `sellerSubmitTransfer`
- `buyerConfirmTransfer`
- `buyerReportIssue`

Internal-only functions:

- write audit logs
- enforce transition helpers shared by public mutations
- future payment/refund/payout/admin functions are explicitly excluded

The public mutations must not expose payment, refund, payout, or production
admin operations. `mockCheckout` only records the existing mock paid state and
fee breakdown.

## UI Preservation Strategy

Keep the current Astro routes and visual components intact. Add a React island
or adapter only where live Convex hooks are required. The adapter must return the
same effective shape the Astro pages currently receive from `createMockFixture`
and `connectMock*` helpers.

Loading behavior must not create a new product state. It can show the existing
mock data until Convex data is available or a small existing-style loading
treatment inside the same screen layout.

The existing bottom tabs, seller Orders label, buyer My Tickets label, price
breakdown, transfer deadline, protection deadline, and friendly language remain
unchanged.

## State And Audit Rules

Convex mutations must mirror the current local transition semantics:

- live listing -> mock checkout -> `transfer_pending`
- seller submit -> `transfer_submitted`
- buyer confirm -> `buyer_confirmed`
- protection window -> `dispute_window_open`
- completion remains planned only if currently visible in the mock flow
- issue report remains structured evidence/reason, not free chat

Every order, transfer task, issue, and payout-relevant mock transition writes an
audit log entry. Audit logs store actor role, actor id, entity type/id, action,
from state, to state, and timestamp.

## Dev Split And Handoff

Claude implements first. Codex validates after.

Claude ownership for `/dev`:

- frontend connection to Convex
- preserving mobile UI and wording
- adding Convex client/provider wiring
- creating the first implementation pass for schema, seed/query/mutation files
  required by the visible flow
- updating tests and local evidence for the implemented behavior

Codex validation ownership after Claude handoff:

- backend correctness review
- state machine and audit-log correctness
- Convex schema/function validation
- tests, typecheck, and acceptance verification
- confirming hard exclusions stayed out of implementation

Handoff from Claude to Codex must include:

- branch and commit SHA
- files changed
- Convex dev command used
- seed command or mutation used
- test/typecheck outputs
- notes on any fallback/loading behavior
- explicit statement that real Clerk/Razorpay/payments/payout/admin/demand and
  category expansion were not added

## Acceptance Criteria

- Current user-visible behavior is preserved across Home, listing detail,
  checkout, My Tickets, order timeline, Sell, and seller Orders.
- Demo data persists in Convex and survives page reload during local dev.
- Mock checkout creates/updates the order and transfer task through Convex.
- Seller transfer, buyer confirmation, and issue reporting use Convex mutations
  with the same transition rules as local helpers.
- Audit logs are written for visible state transitions.
- Mock auth remains `mockCurrentUserId = "user_demo_1"`; no real Clerk.
- Mock payment remains mock-only; no Razorpay or real payment provider logic.
- Seller payout readiness remains mocked only.
- No production admin, demand discovery, or category expansion appears in code.
- Tests cover schema/seed data, transition mutations, route data adapters, and
  hard exclusions.

## Ambiguity Policy

If implementation reveals a choice between preserving UI behavior and exposing
new backend fidelity, preserve current UI behavior and record the backend gap for
a later slice.

If a Convex-specific limitation conflicts with existing mock route shapes, add a
thin adapter rather than changing route names, state names, or user-facing copy.

If real auth/payment/payout/admin work becomes necessary to complete a task, stop
and ask the user before expanding scope.

## Technical Research

Convex docs checked on 2026-06-01:

- React apps wrap descendants in `ConvexProvider` with `ConvexReactClient` and
  use `VITE_CONVEX_URL`.
- React `useQuery` returns `undefined` while loading and subscribes to updates.
- Convex schema lives in `convex/schema.ts` with `defineSchema` and
  `defineTable`.
- Convex queries are read-only; mutations are transactional writes.
- Internal mutations are not directly exposed to clients.
- Convex validators from `convex/values` should define args and returns.

## OWASP And Abuse Notes

- Keep mutation args validated with Convex validators.
- Keep mock auth identity server-side in the adapter boundary; do not accept
  arbitrary buyer/seller ids from the client for privileged transitions.
- Keep payment/refund/payout/admin functions out of public mutation surface.
- Treat audit logs as append-only from app code.
- Add idempotency to seed and mock checkout so repeated clicks or reloads do not
  duplicate core documents.
