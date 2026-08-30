# Watcher resubscribe safety evidence

## Baseline

`bun test convex/__tests__/watcher.test.ts`: 52 pass, 0 fail before changes.

## RED

- `bun test convex/__tests__/parse.test.ts`: failed because `buildAlertWantKey` did
  not exist.
- `bun test convex/__tests__/seed.test.ts`: fresh key was sanitize-only and rerunning
  after an old-format key produced two wants.
- `bun test convex/__tests__/watcher.test.ts`: 51 pass, 5 fail. The same-buyer,
  same-catalog/date `Delhi😀` and `Delhi😁` requests returned the identical key;
  current-hash and pre-hash detached wants returned replacement keys; sent/failed
  rows stayed terminal in both closed-to-live and still-live reattachment.

Evidence rung: 4 (executed reproduction).

## GREEN

- `bun test convex/__tests__/watcher.test.ts convex/__tests__/seed.test.ts convex/__tests__/parse.test.ts`:
  113 pass, 0 fail, 406 assertions.
- `bunx tsc --noEmit`: pass.
- `bunx tsc --project convex/tsconfig.json --noEmit`: pass.
- `git diff --check`: pass; only working-tree line-ending notices.

Evidence rung: 4 (targeted implementation executed). Full validation and merged-main
verification remain pending.

## Dev review

DeepSeek V4 Pro, Muse Spark 1.2 Contributor, and GLM 5.3 independently returned PASS
against the implemented diff. No reviewer reported a High or Medium finding. Small
coverage notes for lone surrogates, normalized legacy fields, preserved-key payoff,
and another-occurrence fallback were added before final validation.

## Full validation

- `bunx tsc --noEmit`: pass.
- `bunx tsc --project convex/tsconfig.json --noEmit`: pass.
- `bun run check`: pass, 0 errors and 12 pre-existing hints.
- `bun run check:routes`: pass for 18 contract routes.
- `bun run build`: pass, 26 pages generated.
- `bun test`: 395 pass, 0 fail, 1,198 assertions across 36 files.
- `bun run cf:dry-run`: pass with Wrangler 4.123.0; 133 assets read, no upload.
- Local CodeRabbit light review scoped to `convex`: 6 files reviewed, no findings.
- `git diff --check`: pass; only line-ending notices from the Windows checkout.

Evidence rung: 4. PR CI, review threads, merge, and post-merge master verification
remain pending.
