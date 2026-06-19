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
_(none yet)_
