# Evidence: First Convex Persistence Slice Plan

Issue: `zwapit-dk0`
Date: 2026-06-01

## Commands And Checks

### Repo State

Command: `git status --short --branch`

Result:

- repo started clean on `master...origin/master`
- after Forge team setup, `.beads/team-map.jsonl` was created

### Forge Team Verification

Command: `forge team verify`

Result:

- first run requested `forge team add`
- after `forge team add`, verification passed
- GitHub CLI authenticated as `harshanandak`
- identity mapped in `team-map.jsonl`
- assignees consistent

### Beads Issue

Command:

- `forge create --title "Plan first Convex persistence slice" ... --silent`
- `forge update zwapit-dk0 --status in_progress ...`
- `bash scripts/beads-context.sh stage-transition zwapit-dk0 none plan`

Result:

- created issue `zwapit-dk0`
- status set to `in_progress`
- stage transition recorded: `none -> plan`

### Branch

Command: `git switch -c codex/plan-convex-persistence-slice`

Result:

- created and switched to `codex/plan-convex-persistence-slice`

### Context And Source Checks

Commands used:

- read `AGENTS.md` and `CLAUDE.md` key lines
- searched current source for Convex, mock flow contracts, UI routes, and hard
  exclusion terms
- inspected current mock fixtures, state transitions, validation, source rules,
  and accepted first visible slice docs

Key findings:

- no executable `convex/` directory exists yet
- no Convex dependency exists in `package.json`
- current routes use `createMockFixture()` and `connectMock*` helpers
- current state transition and validation helpers already define the behavior
  Convex mutations must preserve
- accepted first visible slice moved Convex persistence to a future follow-up

### Current Convex Docs

Context7 library: `/websites/convex_dev`

Sources checked:

- `https://docs.convex.dev/quickstart/react`
- `https://docs.convex.dev/api/modules/react`
- `https://docs.convex.dev/api/modules/server`
- `https://docs.convex.dev/api/modules/values`

Findings used:

- React apps use `ConvexReactClient`, `ConvexProvider`, and `VITE_CONVEX_URL`.
- `useQuery` can return `undefined` while loading.
- schema uses `convex/schema.ts`, `defineSchema`, and `defineTable`.
- functions should use validators from `convex/values`.
- public queries are read-only; mutations are transactional; internal mutations
  are not exposed directly to clients.

## Evaluator Review

Evaluator pass was recorded in:

- `docs/work/2026-06-01-convex-persistence-slice/evaluator-report.md`

Initial gaps found:

- fallback/loading behavior
- seed/mock checkout idempotency
- public/internal mutation boundary
- Claude-to-Codex handoff artifact
- shared-file ownership

Fix status:

- all gaps fixed in `design.md` and `tasks.md`

## Artifacts

- `docs/work/2026-06-01-convex-persistence-slice/research.md`
- `docs/work/2026-06-01-convex-persistence-slice/design.md`
- `docs/work/2026-06-01-convex-persistence-slice/tasks.md`
- `docs/work/2026-06-01-convex-persistence-slice/evaluator-report.md`
- `docs/work/2026-06-01-convex-persistence-slice/evidence.md`
