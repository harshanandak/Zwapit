# Source Rule Engine Decisions

Date: 2026-06-08
Issue: zwapit-pkm

## D1: Keep This PR Backend/Test Only

Decision: Codex owns the first implementation pass because the slice is source-rule correctness, persisted-rule selection, and tests.

Reason: Zwapit ownership rules assign backend correctness, schema validation, edge cases, tests, refactoring, and code review to Codex. There is no planned UI state or mobile screen change in this slice.

## D2: Do Not Add Admin Or Category Expansion

Decision: The PR hardens existing rule contracts and currently modeled enum values only.

Reason: Build order puts source rule engine before listing marketplace and explicitly later than admin, demand discovery, and category expansion.

## D3: Preserve Historical Rule Binding

Decision: Listings must continue storing the source rule id/version used at listing decision time, and checkout/order reads should load that stored rule key.

Reason: Source rules can change over time; existing listings need stable auditability.

## D4: Beads Runtime Recovery

Decision: The worktree Beads Dolt database was rebuilt from tracked `.beads/issues.jsonl` after the Dolt server reported database `zwapit` was missing.

Evidence: `bd doctor` initially failed with Error 1049 database not found. A `zwapit` Dolt database directory was created and `.beads/issues.jsonl` was imported. `bd doctor --fix --yes` then reported 0 errors.
