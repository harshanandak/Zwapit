# First Convex Persistence Slice Research

Issue: `zwapit-dk0`
Date: 2026-06-01
Scope: plan only; no implementation in this slice-planning turn.

## Planning Question

Plan the next slice after the accepted first visible mock UI: persist the existing
mock-visible flow in Convex while preserving current UI behavior.

## Verified Repo Inputs

- Repo instructions require strict scope discipline and say planning files do not
  authorize implementation by themselves: `AGENTS.md:3-9`.
- Product architecture already selects Convex as the v1 backend:
  `AGENTS.md:54`, `CLAUDE.md:54`.
- Build order puts Convex backend after the visible mock shell and before auth:
  `AGENTS.md:62-68`, `CLAUDE.md:62-68`.
- Auth sequence remains mock user -> Convex data flow -> phone auth -> seller
  payout setup -> payments: `AGENTS.md:86`, `CLAUDE.md:86`.
- Backend rules say Convex owns workflow state, source rules, and order state:
  `AGENTS.md:93-101`, `CLAUDE.md:93-101`.
- Agent ownership says Codex owns backend correctness and state machines, while
  Claude owns UI flow and frontend connection to Convex after schema exists:
  `CLAUDE.md:250-271`.
- The accepted first visible slice explicitly excluded live Convex writes until
  mock UI stability: `docs/work/2026-05-29-first-visible-slice/design.md:68-74`.
- Its evaluator moved Convex persistence into an explicit future follow-up:
  `docs/work/2026-05-29-first-visible-slice/evaluator-report.md:37-41`.

## Current App Surface To Preserve

- Current bottom tabs are Home, Sell, My Tickets, and Me:
  `src/components/BottomNav.astro:9-11`.
- Current visible routes import and render mock fixture/flow data:
  `src/pages/app/home.astro:4-6`,
  `src/pages/app/listings/[listingId].astro:9-15`,
  `src/pages/app/checkout/[listingId].astro:10-16`,
  `src/pages/app/tickets.astro:8`,
  `src/pages/app/sell/promise.astro:5-10`.
- The mock connector surface is `connectMockListingFlow`,
  `connectMockCheckoutFlow`, `connectSellerOrderFlow`, and
  `connectTimelineActions`: `src/lib/flow/mockFlow.ts:37-43`,
  `src/lib/flow/mockFlow.ts:116-147`.
- Existing state transition tests cover the happy path from mock pay through
  transfer, buyer confirmation, protection window, and completion:
  `src/lib/state/__tests__/orderTransitions.test.ts:15-39`.
- Existing validation blocks checkout when listing state, deadline, price
  visibility, source rule, or mocked payout readiness are invalid:
  `src/lib/validation/checkoutValidation.ts:29-47`.

## Current Data Contracts

- `MockListing` stores source rule id/version, price, transfer mode, transfer
  deadline, protection deadline, and state: `src/lib/types.ts:124-138`.
- `MockOrder` stores buyer id, seller id, listing id, order state, mock payment
  status, payment summary, transfer task id, and protection deadline:
  `src/lib/types.ts:143-151`.
- `MockTransferTask` and `AuditEvent` are already typed:
  `src/lib/types.ts:156-183`.
- The demo listing is a live BookMyShow event with `OFFICIAL_TRANSFER`,
  listing price `2400`, and deterministic ids:
  `src/lib/mock/listings.ts:13-29`.
- The demo order starts as `checkout_pending` with `mock_unpaid` status:
  `src/lib/mock/orders.ts:4-12`.
- Source rules and rule evaluation already exist in local code:
  `src/lib/rules/sourceRules.ts:3-21`,
  `src/lib/rules/evaluateRule.ts:36-116`.
- Audit event creation exists locally with deterministic sequence behavior:
  `src/lib/state/auditEvents.ts:1-27`.

## Existing Docs To Extend

- `docs/DATA_MODEL.md:39-54` already names the first Convex slice tables:
  users, auth identities, seller payment accounts, source rules, listings,
  orders, transfer tasks, and audit logs.
- `docs/DATA_MODEL.md:68-81` says internal app user ids must be used on
  orders/listings/payments/transfer tasks.
- `docs/DATA_MODEL.md:86-89` says first-slice orders store buyer id, seller id,
  listing id, mock payment summary, transfer task id, and state.
- `docs/development-plan.md:59-62` previously expected Claude to connect first
  UI screens to Convex after Codex backend planning/schema work.

## Current Convex Documentation Checked

Sources queried through Context7 on 2026-06-01:

- Convex React quickstart: `https://docs.convex.dev/quickstart/react`
  - React integration uses `ConvexReactClient`, `ConvexProvider`, and
    `VITE_CONVEX_URL`.
- Convex React API: `https://docs.convex.dev/api/modules/react`
  - `useQuery` returns `undefined` while loading and subscribes reactively.
  - `useMutation` is the React write hook for Convex functions.
- Convex server API: `https://docs.convex.dev/api/modules/server`
  - `convex/schema.ts` exports `defineSchema` and `defineTable`.
  - public queries are read-only; mutations perform transactional writes.
  - internal mutations are not exposed directly to clients.
- Convex values API: `https://docs.convex.dev/api/modules/values`
  - `v` validators define argument and return validation.

## DRY And Blast-Radius Findings

- There is no checked-in `convex/` directory in the repo at planning time.
- `package.json` has Astro, React, Tailwind, Capacitor, Wrangler, and tests, but
  no Convex dependency yet.
- Convex mentions currently exist only in docs and instructions, not executable
  app code.
- Current implementation should extend existing source contracts rather than
  rename them: `src/lib/types.ts`, `src/lib/rules/**`, `src/lib/state/**`,
  `src/lib/validation/**`, and `src/lib/flow/mockFlow.ts`.

## Planning Conclusion

The next slice should add Convex persistence as a narrow data-flow replacement
behind the existing mock-visible behavior. It should seed the same demo data,
read it through Convex-backed adapters, and run the same transition semantics in
Convex mutations while leaving real auth, real payment, payout setup, production
admin, demand discovery, and category expansion out of scope.
