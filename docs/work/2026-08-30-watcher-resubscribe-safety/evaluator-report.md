# Plan evaluator report

## Round 1

| Reviewer | Route | Score |
|---|---|---:|
| Muse Spark 1.2 Contributor | OpenCode Go | 6/10 |
| DeepSeek V4 Pro | OpenCode Go | 7/10 |
| GLM 5.3 | OpenCode Go | 8/10 |

### Consensus corrections accepted

- Specify a provably injective, version-disjoint key format rather than saying
  "lossless encoding" abstractly.
- Cover detached rows with both current-hash keys and pre-hash/no-collapseKey data.
- Route closed-to-live and already-live reattachment through one enqueue decision.
- Requeue every terminal alert-type/channel row, leave active rows untouched, and
  attribute each audit transition to the buyer.
- Move `seed.ts` onto the shared generator while preserving its known old-key rerun.
- Strengthen the existing false-positive notification test and isolate the astral
  collision with the same buyer/catalog/date.

### Suggestions not adopted

- No silent deletion or merge of already-duplicated wants. There is no verified live
  duplicate data and destructive repair needs a separate migration/reverse path.
- No new schema index. Legacy rows without `collapseKey` still require compatibility
  reconstruction, and the indexed buyer scan runs only after fast paths miss.
- No sender invocation assertion for this outbox-state bug. Sender behavior already
  has dedicated tests; this slice proves the fresh pending delivery and its audit.

Status: revised plan awaiting round 2 score.

## Round 2

| Reviewer | Route | Score |
|---|---|---:|
| Muse Spark 1.2 Contributor | OpenCode Go | 9/10 |
| GLM 5.3 | OpenCode Go | 9/10 |
| DeepSeek V4 Pro | OpenCode Go | incomplete (completion-contract label missing) |

### Final tightenings accepted

- Pin the implementation to `codePointAt` iteration and explicitly skip legacy rows
  without watcher fields.
- Make seed compatibility exact-occurrence based, covering every prior key format
  instead of enumerating only the known sanitize-only key.
- Test terminal redelivery when another subscriber keeps the target live as well as
  the closed-to-live restoration path.

Gate: reached. Two independent reviewers score the integrated design 9/10 with no
remaining architecture, compatibility, concurrency, audit, or scope blocker.
DeepSeek completed its analysis but the durable receipt rejected the response because
it omitted the exact `Required amendments:` label; its round-1 review remains included.
