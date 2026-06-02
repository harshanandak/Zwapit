# Evaluator Report: First Convex Persistence Slice

Issue: `zwapit-dk0`
Date: 2026-06-01

## Review Method

The plan was reviewed against:

- repo AGENTS/CLAUDE scope and ownership rules
- accepted first visible mock slice artifacts
- current source contracts under `src/lib/**` and `src/pages/app/**`
- current Convex docs queried through Context7
- user requirement that Claude implements first and Codex validates after

## First Pass Findings

Score: 83/100

Findings:

- The initial plan risked underspecifying the fallback/loading behavior for
  `useQuery` returning `undefined`.
- The initial plan needed an explicit idempotency requirement for seed and mock
  checkout.
- The initial plan needed a stronger statement that public mutations must not
  expose payment/refund/payout/admin operations.
- The initial task list needed a clearer Claude-to-Codex handoff artifact.
- Shared-file ownership needed to acknowledge package/config/schema edits are
  not parallel-safe.

## Fixes Applied

- Added UI preservation and fallback/loading policy to `design.md`.
- Added seed and mock checkout idempotency requirements to `design.md` and
  `tasks.md`.
- Added explicit public/internal function boundary and hard-exclusion mutation
  rule to `design.md`.
- Added Task 6 as the required Claude handoff evidence task.
- Added global task constraints that package/config/schema/shared-type edits are
  owned by the active implementer only until handoff.

## Final Review

Score: 94/100

Blocking gaps: none.

Residual risks:

- Convex setup may require local environment configuration during `/dev`.
- Astro pages may need small React islands for Convex hooks; validation must
  ensure these do not change mobile UI behavior.
- If Claude implements backend functions first, Codex validation must be strict
  about state machine and audit-log correctness because repo ownership assigns
  backend correctness to Codex.

## Decision

Plan is ready for commit and push.

`/dev` remains blocked until the user explicitly starts implementation from this
plan.
