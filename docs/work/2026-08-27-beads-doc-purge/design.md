# Beads doc/tooling purge — FINAL plan (v2, post 4-model R1 + synthesis)

**Date:** 2026-08-27 · **Kernel:** 965c6d76 · Branch: chore/beads-consumers-migration
**R1 lanes (all completed):** Sol (openai-codex), DeepSeek-v4-pro (opencode-go),
Muse-Spark-contributor (opencode-go), GLM-5.3 (opencode-go).

## Converged strategy

1. Docs: **replace-not-strip** via mapping table — keeps stage exit gates intact.
   Mapping: bd ready/list -> forge issue ready; bd show -> forge issue show/recap;
   bd create/update --status -> forge claim / forge issue update;
   bd update --comment / bd comments add -> forge issue comment;
   bd close -> forge issue close; bd sync -> forge sync;
   bd worktree create -> forge worktree create.
2. Strip Beads-only machinery: bd sync step, bd dep add/cycles/graph/set-state
   (apply-decision flow), beads-context.sh / conflict-detect.sh invocations,
   rollback.md install-block.
3. Canonical source = .claude/commands/*.md; propagate VERBATIM to:
   .kilocode/workflows, .kilocode/rules+skills, .cursor/rules+skills,
   .cline/workflows, .codex/skills, .roo/commands, .github/prompts (+copilot-
   instructions), docs/forge/TOOLCHAIN.md touch-ups.
4. scripts/dep-guard.sh: EXCISE store-contracts + apply-decision + check-ripple +
   resolve_bd_cmd/bd plumbing (~250 lines) — forge comments cannot feed the
   machine-readable ripple analyzer (a comment migration would be a facade).
   KEEP find-consumers + extract-contracts (pure grep/parse). Update
   .claude/commands/plan.md dependency-gate steps accordingly.
5. scripts/lib/sanitize.sh: doc-comment line fix.
6. Verification sweep: zero matches for \bbd\b|Beads|Dolt outside
   AGENTS.md historical/archive notes + ~/zwapit-beads-archive references;
   mirror-parity diffs; bash -n dep-guard.sh; functional run of surviving
   subcommands.

## Out of scope

dep-guard-analyze/render-review/keyword-ripple.js orphans (follow-up issue);
AGENTS.md history wording; ~/zwapit-beads-archive; forge CLI changes.
