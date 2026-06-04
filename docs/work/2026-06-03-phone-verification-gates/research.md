# Phone Verification And Protected Action Gates Research

Issue: `zwapit-12a`

## Local Instruction Sources

- `AGENTS.md:3` and `CLAUDE.md:3`: do only the explicitly requested task.
- `AGENTS.md:13` and `CLAUDE.md:13`: verify code facts from files.
- `AGENTS.md:86`: auth sequence is mock user -> Convex data flow -> phone auth -> seller payout setup -> payments.
- `AGENTS.md:88`: phone verification is required later for buy/sell actions; full KYC is not part of the first slice.
- `AGENTS.md:253`: Claude owns mobile-first UI, wording, screen flow, component structure, and frontend connection to Convex after schema exists.
- User instruction for this slice: Codex must only plan; Claude implements first; Codex validates after Claude implementation.

## Current Code Findings

- `src/lib/auth/authAdapter.ts:136` has `getAuthActionState`.
- `src/lib/auth/authAdapter.ts:146` returns phone verification required when configured.
- `src/lib/auth/mockAuth.ts:8` has the local mock user phone-verified.
- `convex/schema.ts:121` defines `users`; `convex/schema.ts:138` defines `user_verifications`.
- `convex/identity.ts:19` defines buy/sell as phone-required actions.
- `convex/identity.ts:35` syncs provider identity to app user state.
- `src/components/AuthActionGate.astro:17` renders phone-verification-required button text.
- `src/pages/app/listings/[listingId].astro:19` gates buy CTA state.
- `src/pages/app/sell/index.astro:7` gates sell upload CTA state.
- `src/pages/app/checkout/[listingId].astro:75` still has the mock pay button route, so checkout execution needs its own gate.
- `src/pages/app/me.astro:62` uses phone requirement UI status.

## DRY Check

Existing auth and gate primitives are present. The plan should extend them:

- Extend `src/lib/auth/authAdapter.ts`, do not create a second auth adapter.
- Extend `convex/identity.ts`, do not create a separate provider identity model.
- Reuse `src/components/AuthActionGate.astro`, do not create a parallel CTA gate component unless the existing component cannot represent the needed state.

## Baseline Validation

- `bun run check`: passed; existing CommonJS module hints appeared in Forge dep-guard scripts.
- `bun test`: 62 passed, 1 failed. Failure was `first visible slice has no forbidden scope drift`, caused by plan-worktree Beads metadata changes: `.beads/.gitignore`, `.beads/dolt-config.log`, `.beads/issues.jsonl`, `.beads/metadata.json`, and staged `.beads/issues.jsonl`.

## Scope Drift Search

Search found excluded payment/KYC/admin terms only in instruction docs, prior plan docs, and existing mock checkout copy. No implementation change was made during planning.
