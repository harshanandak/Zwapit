# U5 — Sell consolidation · decisions log

## Classification
**Critical** — removes contract-listed routes + new screen architecture. Workflow:
plan → dev → validate → ship → review → premerge → verify.

## Pre-committed decisions (from /plan + advisor + user sign-off 2026-06-19)
1. **Approach A approved by the user**: consolidate the 5-route wizard into ONE v5 §8
   upload-first screen at `/app/sell`; **delete** `/upload /confirm /price /promise`
   (not redirect — only intra-wizard links referenced them); keep `/app/sell` + `/app/sell/orders`.
2. **Preserve all wizard function on the one screen**: phone-verification gate on Publish,
   inline seller-promise checkbox gating Publish, `submitSellerListingDraft`, navigate to
   `/app/sell/orders`, persist `SELLER_PUBLISHED_STORAGE_KEY` for the Orders "now live" banner.
   Reuse all existing helpers/session carriers — no new flow/state logic.
3. **The Promise click-path test moves** to the consolidated screen's Publish path (rewritten in
   the seller smoke), preserving: unchecked → preventDefault + warning + no nav; checked → submit
   + navigate + persisted banner.
4. **New CSS only** for `.sell-steps`/`.sstep` + `.drop-sched` (verified missing); everything else
   exists in global.css. Steel entrance choreography added for `/app/sell`.
5. **Out of scope**: real upload/OCR, real auto price-drop scheduling, urgent surfacing logic,
   Profile Selling hub (§9 = U7), Plans (§10), real payout.
6. Fold U2/U3 review lessons up front (test naming, `Number.NaN`, button controls, single-line
   new verify entry, data-driven checks).

## Decisions (filled during /dev)

### Decision 1 — in-flow Publish (not position:absolute .stickybar)
**Score:** 2/14 (PROCEED) · **Status:** RESOLVED. The §8 spec shows a `.stickybar` (position:absolute)
Publish bar, but `.stickybar` is unused by any live screen and can't be visually QA'd from the
worktree (the preview server runs on the main repo / master). To avoid shipping a bnav-overlap bug,
the Publish lives in an in-flow block at the end of the screen (styled `.btn-primary`). Sticky
positioning is deferred to a follow-up once it can be visually verified. All content/sections are
spec-faithful; only the bar's positioning differs.

### Decision 2 — "View orders" wording (not the spec's "View sales")
**Status:** RESOLVED. The seller-orders surface is "Orders" throughout this product (CLAUDE.md UX
baseline + the seller-smoke FORBIDDEN guardrail forbids "Sales"). The orders peek uses "Your orders"
/ "See orders, transfers, and payouts." to keep terminology consistent and avoid tripping the
guardrail.

### Exit-review (5 lenses) — outcome
- Spec fidelity: faithful; 1 nit (`.sweep` on Publish) — FIXED (dropped; shimmer reserved for Buy).
- a11y/CodeRabbit: 1 MEDIUM + 2 LOW — all FIXED:
  - MEDIUM: `#promise-result` inline `display:block` defeated `hidden` (empty card showed on load,
    because `.catres{display:flex}` also overrides the UA `[hidden]`). Removed the inline display and
    added a scoped `#promise-result[hidden]{display:none}` (id+attr beats `.catres`).
  - LOW: `.toggle` buttons got `aria-label` ("Mark as urgent" / "Auto price-drop") + `aria-pressed`
    (toggled in the handler).
  - LOW: repeated inline `font-size:12px;color:var(--faint)` extracted to a `.val-faint` class.
- Route-removal integrity: CLEAN — zero broken refs; the deleted routes appear only as sample
  string args to pure functions in 3 unit tests (still pass, 170/170). FAB + all links resolve.
- Publish-script correctness: CLEAN — no throw/dead-route/gate-failure path; cannot_list href fixed
  to `/app/sell`; null-guards cover the smoke's partial DOM; click-path smoke passes.
- Duplication/copy: CLEAN — verify `/app/sell` entry is single-line; ui-smoke-seller new code has no
  ≥6-line dup; no forbidden terms (no "sales"); display-only scope confirmed.
