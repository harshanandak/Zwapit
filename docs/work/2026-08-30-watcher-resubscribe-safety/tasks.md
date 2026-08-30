# Watcher resubscribe safety tasks

## Plan

- [x] Cross-review the design with DeepSeek V4 Pro, Muse Spark 1.2 Contributor, and
  GLM 5.3; synthesize disagreements with GPT-5.6 Sol.
- [x] Revise and repeat review until the integrated plan scores at least 9/10.

## TDD

- [x] RED: add same-tuple astral-Unicode collision regression.
- [x] RED: add current-hash and pre-hash detached legacy-key exact rearm regressions.
- [x] RED: add sent/failed per-channel requeue plus pending/sending and ordinary-fan-out idempotency regressions for both closed-to-live and still-live reattachment.
- [x] RED: add fresh and sanitize-only/current-hash legacy-rerun seed key regressions.
- [x] GREEN: implement shared lossless public-key generation and exact legacy lookup.
- [x] GREEN: implement explicit, audited terminal notification requeue.
- [x] REFACTOR: unify both live-reattach branches behind one effective-status enqueue and remove obsolete collision setup.

## Validate and ship

- [x] Run targeted watcher tests and both TypeScript checks.
- [x] Run Astro check, route check, build, full `bun test`, and Cloudflare dry run.
- [x] Run local CodeRabbit review and resolve valid findings.
- [ ] Push, open PR, inspect every CI/review surface, resolve all threads, and merge.
- [ ] Verify master CI/deploy and close the Forge issue with evidence.
