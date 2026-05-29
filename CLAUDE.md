# Zwapit Agent Rules

## Scope Discipline

- Do only the task explicitly requested in the current message.
- Do not continue pending plan items unless the user asks for that exact item.
- If asked to check something, check it and stop.
- If asked to implement one change, implement that change, verify it, and stop.
- Planning files do not authorize implementation by themselves.

## Verification Rule

- Do not state code facts without reading the actual file first.
- Do not state tool, product, legal, payment, or platform facts without checking a current source first.
- Cite exact local file paths and line numbers when making code or repo claims.
- If something is not verified, say that it is not verified.

## Command Style

- Do not use `cd <dir> && <command>`.
- Use `git -C <dir>` for git commands.
- Prefer native path flags or explicit working-directory options for other tools.

## Product Context

Zwapit is a mobile-first marketplace for transferable tickets, passes, watchers,
bookings, and selected customer-managed handoffs.

The v1 proof is:
- Can a seller list a transferable item easily?
- Can a buyer understand protection and buy safely?
- Can the platform protect payment until transfer/completion without taking custody of the item?

## Current UX Baseline

- Bottom tabs: Home, Sell, My Tickets, Me.
- Login is delayed until a buy or sell action.
- Selling is upload-first and form-later.
- Buying flow: listing detail -> protection -> phone OTP -> pay.
- Buyer purchases are shown as My Tickets.
- Seller-side received purchases are shown as Orders inside Sell.
- Buyer and seller tracking are timeline-based.
- Disputes use structured reasons and evidence, not free chat first.
- Pricing must show full price before payment.
- Trust details must show transfer mode and payout rule upfront.

Older Buy/Sell split tab drafts are not active unless the user explicitly revives them.

## Architecture Decisions

- Use Astro + React for the frontend.
- Use Tailwind for styling.
- Use Capacitor as the app wrapper.
- Use Convex as the v1 backend.
- Add auth after the mock local flow.
- Add Razorpay Route or another RBI-authorized payment aggregator/split-settlement provider after the core order flow works.
- Do not add React Native in v1.
- Do not add a separate Node backend in v1.
- Do not add Neon/Postgres in v1 unless explicitly requested.
- Do not add Cloudflare deployment until the core experience is visible.

## Build Order

1. Product contract and agent instructions.
2. Mobile UI prototype.
3. Astro + React + Capacitor shell.
4. Convex backend.
5. Auth.
6. Upload-first seller flow.
7. Source rule engine.
8. Listing marketplace.
9. Buyer checkout.
10. Order timeline.
11. Transfer workflow.
12. Dispute/refund workflow.
13. Internal settlement hold/release workflow.
14. Admin dashboard.
15. Demand discovery.
16. Category expansion.

Do not skip ahead to payments, admin, or category expansion before the visible mock flow and core state model exist.

## Auth And Identity Rules

- First slice may use `mockCurrentUserId = "user_demo_1"`.
- Sequence: mock user -> Convex data flow -> phone auth -> seller payout setup -> payments.
- Use Clerk first for v1 auth speed, behind an auth adapter/wrapper so it can be replaced later.
- Phone verification is required later for buy/sell actions; full KYC is not part of the first slice.
- Use an internal app user id everywhere in app data.
- Store provider identity separately in `auth_identities`.
- Do not use provider ids such as Clerk ids as primary ids on orders, listings, or payments.

## Backend Rules

- Use Convex for workflow state, source rules, and order state.
- Use internal functions for sensitive operations.
- Do not expose payment, refund, payout, or admin mutations directly to clients.
- All state transitions must be explicit.
- Add audit logs for payment, transfer, refund, issue, and payout actions.
- Never create an internal wallet.
- The payment provider is the money source of truth.
- Do not hold gross buyer money in a platform-owned account.

## Custody Rules

- The platform should not receive tickets or passes first.
- Prefer seller-to-buyer transfer, official issuer transfer, official reissue, or customer-managed handoff.
- If a category requires the platform to take custody, it is not v1 unless explicitly approved.

## Rule Engine Requirements

The rule engine is system-first. It should automatically decide as many listings
and orders as possible.

Rule decisions:
- AUTO_APPROVE
- AUTO_BLOCK
- AUTO_WAITLIST
- NEEDS_MANUAL_REVIEW

Manual review is exception-only. Use it when the rules cannot confidently
approve, block, or waitlist.

Internal source rule statuses:
- ALLOW
- AMBER
- DEMAND_ONLY
- BLOCKED

Transfer modes:
- OFFICIAL_TRANSFER
- OFFICIAL_REISSUE
- CUSTOMER_MANAGED_HANDOFF
- CODE_REVEAL
- IDENTITY_BOUND

Rules must include:
- category: BookMyShow movie, BookMyShow event, District movie, District event, bus travel, watchers, or future category
- source: BookMyShow, District/Zomato, bus operator/platform, other platform, or manual upload
- source/category classification
- transferability status
- buyer protection level
- manual review flag
- required eligibility fields
- price cap or price review rule
- payout policy
- blocked category behavior

## State Rules

Listing states:
- draft
- under_review
- live
- sold
- paused
- expired
- blocked
- waitlist_only

Order states:
- checkout_pending
- payment_captured
- transfer_pending
- fulfilment_in_progress
- transfer_submitted
- buyer_confirmed
- dispute_window_open
- issue_reported
- buyer_rejected
- refund_processing
- refunded
- payout_eligible
- payout_waiting
- payout_released
- payout_sent
- seller_payout_blocked
- completed
- transfer_timeout

First vertical-slice order flow:
- live listing
- mock buyer purchase
- transfer_pending
- transfer_submitted
- buyer_confirmed
- dispute_window_open
- completed

## Payment And Payout Rules

- Do not add real payment provider logic in the first visible slice.
- Later payment flow must include provider order creation, checkout, callback verification, webhook verification, idempotency/dedupe, order paid transition, settlement hold, release job, and refund path.
- Mock checkout fee is confirmed as INR 10 + GST.
- Checkout must show item price, platform fee, total payable, refund conditions, transfer deadline, and protection deadline.
- Seller payout setup must be complete before a listing can become purchasable.
- Payout timing depends on category completion plus dispute window, not only on payment success.

## Transfer Deadline Rules

- Transfer deadlines should be dynamic, such as `min(24 hours from payment, event_start_time - safety_buffer)` where event timing exists.
- Missed transfer deadlines should move the order toward timeout/refund handling.
- Timeline screens must show what happened, what is due next, and what happens if the deadline is missed.

## User-Facing Language

Use friendly language:
- Official Transfer
- Protected Handoff
- Verify & Redeem
- Waitlist Only
- Cannot List
- Protected payment
- Payout
- Report issue
- Upload to Sell
- Buy with Protection
- Transfer needed
- Payout waiting

Avoid user-facing terms:
- escrow
- settlement
- dispute
- merchant
- fulfilment
- entitlement
- KYC
- linked account
- AMBER
- settlement hold

## Do Not Build Yet

Unless the user explicitly asks, do not build:
- chat
- advanced search
- wallet
- complex seller analytics
- operator dashboard
- offline courier workflow
- high-value watcher marketplace
- full Neon financial ledger
- organiser API marketplace
- real OCR
- AI ticket parser
- real KYC
- full legal policy pages

## Agent Ownership

Codex owns:
- backend correctness
- state machines
- Razorpay/payment integration when explicitly requested
- webhook safety
- security review
- schema validation
- edge cases
- tests
- refactoring
- code review

Claude owns:
- mobile-first UI
- friendly wording
- screen flow
- component structure
- form simplification
- UX refinement
- frontend connection to Convex after the schema exists

Shared files require explicit user approval before parallel edits:
- package.json
- routing config
- shared types
- schema-related frontend types
- global constants

Do not run two agents against the same file ownership area at the same time.

## Forge Workflow Instructions

These instructions incorporate the Forge-generated `AGENTS.md` workflow content.
They are subordinate to the Zwapit rules above. If there is any conflict, follow
Zwapit's Scope Discipline, Build Order, Agent Ownership, and Do Not Build Yet
rules first.

Use Forge workflow stages only when the user explicitly asks for Forge workflow
work, uses a Forge command/stage name, or asks to plan, dev, validate, ship,
review, premerge, or verify work through Forge.

## 7-Stage TDD-First Workflow

This project supports a TDD-first Forge workflow with 7 stages:

| Stage | Command | Purpose | Required For |
| --- | --- | --- | --- |
| 1 | `/plan` | Design intent -> research -> branch + worktree + task list | Critical, Standard, Refactor |
| 2 | `/dev` | Subagent-driven TDD per task, with spec and quality review | All types |
| 3 | `/validate` | Validate and debug failures | All types |
| 4 | `/ship` | Create PR with documentation | All types |
| 5 | `/review` | Address PR feedback | Critical, Standard |
| 6 | `/premerge` | Complete docs on feature branch and hand off PR | All types |
| 7 | `/verify` | Post-merge health check for CI and deployments | All types |

Utility: `/status` checks current context before starting work.

## Forge Change Classification

When Forge workflow is requested, classify the change type:

### Critical

Triggers: security, authentication, payments, breaking changes, new architecture,
or data migrations.

Workflow: plan -> dev -> validate -> ship -> review -> premerge -> verify.

### Standard

Triggers: normal features, enhancements, and new components.

Workflow: plan -> dev -> validate -> ship -> review -> premerge.

### Simple

Triggers: bug fixes, UI tweaks, small changes, and minor refactors.

Workflow: dev -> validate -> ship.

### Hotfix

Triggers: production emergencies or critical bugs affecting users.

Workflow: dev -> validate -> ship, with immediate merge allowed when approved.

### Docs

Triggers: documentation updates, README changes, and comment improvements.

Workflow: verify -> ship.

### Refactor

Triggers: code cleanup, performance optimization, and technical debt reduction.

Workflow: plan -> dev -> validate -> ship -> premerge.

## Forge Enforcement Philosophy

Prefer conversational guidance over hard blocking. When prerequisites are
missing, explain the options and ask before expanding scope.

Create accountability for skipped work:
- Allow an explicitly approved skip.
- Create a follow-up Beads issue when appropriate.
- Document technical debt in the commit or PR when appropriate.

Dynamic command files must not hardcode example output when scripts generate
that output dynamically. Reference the script and describe what it does instead.

## Forge TDD Development

Stage 2, `/dev`, uses a task-by-task TDD loop:

1. Read the task list produced by `/plan`, usually at `docs/work/YYYY-MM-DD-<slug>/tasks.md`.
2. Implement each task with a clear RED-GREEN-REFACTOR cycle.
3. RED: write or update a failing test first and capture the failing output.
4. GREEN: implement the smallest change that makes the test pass.
5. REFACTOR: clean up while keeping tests green.
6. Run spec compliance review before code quality review.
7. Use a decision gate when the implementation exposes a spec gap.

## Forge State Management

Forge workflow state should live in Beads metadata so work can survive context
compaction and agent handoffs.

Important fields include:
- issue id
- workflow type
- current stage
- completed stages
- skipped stages
- classification reason
- parallel tracks, when used
- stage transition summaries
- decisions
- artifacts
- next-step context

## Forge Git Hooks

Forge installs hook assets for workflow guardrails:
- Pre-commit checks should encourage TDD when source files change.
- Pre-push checks should validate tests before publishing.
- Hooks may be bypassed only when the user explicitly approves or an emergency
  workflow requires it.

In this repo, hooks must not override Zwapit's Scope Discipline or Agent
Ownership rules.

## Forge Documentation Index

Detailed Forge command instructions live in generated workflow files:
- `.claude/commands/status.md`
- `.claude/commands/plan.md`
- `.claude/commands/dev.md`
- `.claude/commands/validate.md`
- `.claude/commands/ship.md`
- `.claude/commands/review.md`
- `.claude/commands/premerge.md`
- `.claude/commands/verify.md`

Planning documents created by `/plan` should use one folder per work item:
- `docs/work/YYYY-MM-DD-<slug>/research.md`
- `docs/work/YYYY-MM-DD-<slug>/design.md`
- `docs/work/YYYY-MM-DD-<slug>/tasks.md`
- `docs/work/YYYY-MM-DD-<slug>/decisions.md`
- `docs/work/YYYY-MM-DD-<slug>/evaluator-report.md`
- `docs/work/YYYY-MM-DD-<slug>/evidence.md`

Legacy `docs/plans/` and `docs/research/` paths are read-only fallback references
for older work. New work must not create scattered plan/research files there.

Forge setup and validation docs:
- `docs/forge/TOOLCHAIN.md`
- `docs/forge/VALIDATION.md`

## Forge Context Convention

Each Forge stage transition should carry enough structured context for the next
stage to resume without re-reading the full design doc.

Use these fields when available:
- Summary: what was accomplished.
- Decisions: choices that affect downstream work.
- Artifacts: files, commands, or URLs produced.
- Next: what the next stage should focus on.

The convention is advisory unless the user explicitly asks to enforce it.

## Beads Issue Tracker

This project uses `bd` through Forge for issue tracking. Run `bd prime` for full
workflow context and command details.

Quick reference:

```bash
forge ready
forge show <id>
forge claim <id>
forge close <id>
```

Rules:
- Use `forge` as the routine command surface for Beads-backed issue tracking and
  sync workflows.
- Use `bd` directly only for operations Forge does not wrap yet, such as
  `bd init`, `bd comments`, `bd dep`, and `bd dolt *`.
- GitHub issues may be used for external or public tracking.
- Do not use markdown TODO lists as the source of truth for issue state.

## Forge Session Completion

When the user explicitly asks to complete, ship, or publish Forge workflow work,
finish with:

1. File issues for remaining work when needed.
2. Run relevant quality gates.
3. Update issue status.
4. Sync Beads when configured.
5. Push only when the user requested shipping, publishing, or pushing.
6. Verify the final Git and workflow state.
7. Provide a concise handoff.
