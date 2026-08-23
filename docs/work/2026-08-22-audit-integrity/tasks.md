# Audit integrity + hygiene — task list

Branch: feat/audit-integrity-hygiene (off master d6723a4).
Per-task: targeted lanes; full `bun test` + both tsc + local CodeRabbit before push; shepherd gate after.

T1 — Want audits in createAlert (gh#41) [watcher.ts] RED→GREEN
T2 — CI cleanup-on-timeout (1428a544) [preview+production yml]
T3 — Hazard-6 reword (#40) [AGENTS.md]
T4 — Manual-sync labels (e3a43b84) [.clinerules/.cursorrules/.github/copilot-instructions.md]
T5 — POLL_NOW relative (2427bbc4b) [watcher.test.ts]
T6 — Chase selection most-recent opened (ff3e0a5a) [parse.ts]

Order: T1 → T6 → T5 → T2 → T3+T4 (docs last, one commit). Lane findings fold into T1 design before its GREEN.
