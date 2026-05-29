# First Visible Slice Design

Issue: `zwapit-27t`
Feature slug: `first-visible-slice`
Forge stage: `/plan`
Status: evaluator fixes applied; `/dev` remains blocked until Forge gates pass

## Forge Gate Status

Canonical Beads issue: `zwapit-27t`.

Verified current gate state:
- `forge status` reports branch `master`, worktree `main`, four uncommitted changes, and no active workflow state.
- `git worktree list` reports only `C:/Users/harsha_befach/Downloads/Zwapit`.
- `bd ready --json` reports no ready issues after duplicate cleanup.
- duplicate failed-plan issues `zwapit-a5s` and `zwapit-140` are closed as duplicates of `zwapit-27t`.
- `zwapit-27t` is `in_progress`, has design metadata, has acceptance criteria, has stored contracts, and has a `plan -> evaluator-review` stage-transition comment.
- `dep-guard.sh check-ripple zwapit-27t` now runs and reports no conflicts after adding the missing Forge helper files, CommonJS package markers for Forge helper scripts, and Windows `bd.exe` resolution to `scripts/dep-guard.sh`.

Before `/dev`, finish these gates:
- create or approve an isolated implementation worktree/branch for this slice
- run a baseline install/check in the implementation worktree
- get explicit user confirmation for the task list

## Goal

Build the first visible Zwapit slice without real auth, real payments,
production admin, or production source integrations.

The slice must prove:
- mobile shell navigation works with Home, Sell, My Tickets, Me
- buyer-side purchases are My Tickets
- seller-side received purchases are Orders inside Sell
- a BookMyShow event mock listing can be browsed, checked out, tracked, and advanced through a transfer timeline
- source/category rules can produce system-first auto-review decisions

## Source Of Truth

- `AGENTS.md`
- `docs/IMPLEMENTATION_CONTRACT.md`
- `docs/SOURCE_RULES.md`
- `docs/development-plan.md`
- `docs/decisions.md`
- `docs/UX_SPEC.md`
- `docs/DATA_MODEL.md`
- `docs/RULE_ENGINE.md`
- `docs/TRUST_SAFETY.md`
- `docs/reference/chatgpt-shared-conversation.md`

## Scope

In scope:
- Astro + React + Tailwind + Capacitor scaffold
- route/view IDs from `docs/IMPLEMENTATION_CONTRACT.md`
- local mock fixture from `docs/IMPLEMENTATION_CONTRACT.md`
- first mobile shell
- Home listing card/detail/checkout preview
- Sell upload/confirm/price/promise flow
- My Tickets timeline
- seller Orders timeline inside Sell
- local source-rule decision model
- local state transition helpers
- UI states, validations, and acceptance checks from the implementation contract
- mock auth adapter contract, backed by `mockCurrentUserId = "user_demo_1"`
- placeholder-only `/admin` screen that explains manual-review concepts without production workflow

Out of scope:
- real Clerk auth
- real payments
- Razorpay
- real payout setup
- production admin workflow
- production source verification
- live Convex writes/functions before the mock UI flow is stable
- demand discovery
- high-value watcher marketplace
- real OCR or AI parser

## Success Criteria

Plan readiness success:
- every executable task has `File(s)`, `OWNS`, `What to implement`, TDD steps, expected output, and validation
- no parallel task owns the same shared file at the same time
- every task maps to `docs/IMPLEMENTATION_CONTRACT.md`, `AGENTS.md`, or this design doc
- evaluator agents find no blocking planning gaps

Implemented slice success:
- all routes in `docs/IMPLEMENTATION_CONTRACT.md` render without broken navigation
- bottom nav shows Home, Sell, My Tickets, Me
- Home shows `listing_bms_event_1`
- listing detail shows transfer mode, protection, price, INR 10 + GST fee, total, transfer deadline, and protection deadline
- Sell flow can move through upload, confirm, price, promise, and auto-approved result
- checkout creates an order as `checkout_pending`, then `mock_pay` transitions it to `transfer_pending`
- My Tickets shows buyer timeline
- Sell Orders shows seller transfer task
- timeline can advance through mock state transitions
- Report issue captures reason code and evidence placeholder
- auth adapter/wrapper contract is documented without implementing real Clerk auth
- no real payment, real auth, real payout, or production admin workflow is implemented

## Architecture

Start with Astro + React + Tailwind + Capacitor.

Use local TypeScript data modules for the first UI slice:
- mock users
- auth adapter contract
- source rules
- listing
- order
- transfer task
- issue
- audit events

Convex boundary:
- Convex is the v1 backend direction.
- The first visible slice may add Convex dependency/config as scaffold only if needed.
- Do not add live Convex writes, Convex functions, or production persistence until the mock UI flow is accepted.

## Routes

Implement real routes:
- `/`
- `/app`
- `/app/home`
- `/app/sell`
- `/app/sell/upload`
- `/app/sell/confirm`
- `/app/sell/price`
- `/app/sell/promise`
- `/app/sell/orders`
- `/app/tickets`
- `/app/listings/:listingId`
- `/app/checkout/:listingId`
- `/app/orders/:orderId`
- `/app/me`
- `/admin`

`/admin` is placeholder-only for this slice. It may show manual-review concepts and sample rule decisions, but it must not implement production review operations.

## UX Decisions

Bottom nav:
- Home
- Sell
- My Tickets
- Me

Do not use Transactions as a bottom-nav label.
Avoid Sales as the primary seller-side label.

Mock fee:
- INR 10 + GST

## Resolved Enum Decision

Use `OFFICIAL_TRANSFER` as a valid first-slice transfer mode for the BookMyShow event fixture.

Reason:
- `docs/IMPLEMENTATION_CONTRACT.md`, `docs/SOURCE_RULES.md`, and `docs/RULE_ENGINE.md` already use `OFFICIAL_TRANSFER`.
- `AGENTS.md` now lists `OFFICIAL_TRANSFER` alongside `OFFICIAL_REISSUE`, `CUSTOMER_MANAGED_HANDOFF`, `CODE_REVEAL`, and `IDENTITY_BOUND`.

Do not rename this enum during implementation unless the user explicitly reopens the transfer-mode model.

## Auth Adapter Contract

Document and mock these functions in the first slice:
- `getCurrentUser()`
- `requireUser()`
- `requirePhoneVerified()`
- `syncUserToConvex()`

Implementation behavior:
- use internal app user id `user_demo_1`
- do not use Clerk ids as primary app ids
- return mock verified phone status only
- keep the contract replaceable so Clerk can be swapped later
- do not implement real Clerk auth in this slice

## Rule Model

System-first review outputs:
- `AUTO_APPROVE`
- `AUTO_BLOCK`
- `AUTO_WAITLIST`
- `NEEDS_MANUAL_REVIEW`

Internal source rule statuses:
- `ALLOW`
- `AMBER`
- `DEMAND_ONLY`
- `BLOCKED`

First source/category:
- `bookmyshow_event`

Known future source/category targets:
- `bookmyshow_movie`
- `district_movie`
- `district_event`
- `bus_travel`
- `watchers`

Every source rule must carry:
- source and category
- source/category classification
- transferability status
- transfer mode
- buyer protection level
- manual review flag/reasons
- required eligibility fields
- price cap or price review rule
- payout policy
- blocked category behavior
- rule id and version

Manual review is exception-only. The system should automatically approve, block, or waitlist whenever the rule has enough confidence.

## Data Contract

Use `docs/IMPLEMENTATION_CONTRACT.md` for:
- fixture IDs
- field names
- state transition actions
- validation blockers
- issue reason codes
- UI states
- acceptance criteria

Do not invent alternate names during implementation.

## Edge Cases

First slice must define visible behavior for:
- blocked source rule hides or blocks checkout
- waitlist-only listing cannot be purchased
- transfer deadline already passed
- buyer has not acknowledged eligibility restrictions
- mocked seller payout account is not `mock_ready`
- seller tries to submit transfer evidence in the wrong order state
- buyer tries to confirm before seller transfer submission
- buyer reports an issue from an active order
- `/admin` exists but cannot approve/reject anything in production

## Technical Research

Local research inputs already captured:
- `docs/work/2026-05-29-first-visible-slice/research.md`
- `docs/reference/chatgpt-shared-conversation.md`
- source docs listed above

Implementation approach selected:
- local TypeScript state first, because the user wants the visible mock flow and core state model before backend/payment/admin expansion
- system-first rule engine before manual review UI, because manual review is exception-only
- auth adapter contract before Clerk implementation, because the user chose Clerk for speed but wants provider replacement possible

No removal/rename blast-radius task is needed except the transfer-mode enum check, which is resolved by adding `OFFICIAL_TRANSFER` to `AGENTS.md` rather than renaming existing docs.

## OWASP Review

First slice has no real auth, payment, upload storage, or production admin writes, but it must still prepare for:
- A01 Broken Access Control: route actions must check mock actor/role and reject wrong actor transitions
- A03 Injection: issue/evidence placeholders must be treated as text and not rendered as HTML
- A04 Insecure Design: state transitions must be explicit and reject invalid transitions
- A05 Security Misconfiguration: `/admin` must remain placeholder-only
- A07 Identification and Authentication Failures: auth adapter must avoid provider ids as primary app ids
- A08 Software and Data Integrity Failures: rule decisions must store rule id and version
- A09 Logging and Monitoring Failures: local audit events should be modeled for state changes

## TDD Scenarios

Minimum Codex test/smoke scenarios:
- happy path: live listing -> checkout_pending -> mock_pay -> transfer_pending -> transfer_submitted -> buyer_confirmed -> dispute_window_open -> completed
- blocked checkout: AUTO_BLOCK or AUTO_WAITLIST listing cannot proceed to mock pay
- invalid actor/state: buyer cannot submit seller transfer and seller cannot confirm buyer receipt
- deadline edge: passed transfer deadline blocks checkout and transfer submission
- issue path: buyer can report `ticket_not_transferred` with evidence placeholder from an active order

## Ambiguity Policy

Implementation agents must use this rubric when a missing detail appears:
- >= 80% confidence from `AGENTS.md`, `docs/IMPLEMENTATION_CONTRACT.md`, or this design: proceed and document the choice in the task notes
- < 80% confidence or any user-facing design uncertainty: stop and ask the user
- payment, auth provider, source integration, admin workflow, or custody ambiguity: stop and ask even if a likely answer exists

## Agent Ownership

Codex owns:
- scaffold and shared setup files initially
- local state machine and source-rule model
- validation logic
- acceptance checks
- later Convex schema

Claude owns after scaffold is stable:
- mobile UI shell
- route layouts
- screen states
- buyer flow UI
- seller flow UI
- friendly copy

Shared files require one owner at a time:
- `package.json`
- routing config
- shared types
- global constants
- schema-related frontend types

## Parallelization Plan

Do not parallelize before scaffold and route structure are stable.

After scaffold:
- Claude A: Home, listing detail, checkout, My Tickets UI
- Claude B: Sell upload, seller Orders UI
- Codex A: local fixtures and state transition helpers
- Codex B: source-rule model and validation tests

Parallel agents must not edit the same shared file without explicit user approval.

## Risks

- Forge CLI `plan` command currently fails to parse Beads create output on this machine. The Beads issue was created directly as `zwapit-27t`.
- Windows path handling in Forge `--path` is unreliable; run Forge commands from the repo working directory.
- The current checkout is `master`, not an isolated implementation worktree.
- Do not let implementation agents treat this plan as permission to continue beyond their assigned task.
