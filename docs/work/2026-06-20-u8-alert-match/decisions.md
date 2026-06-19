# U8 — Alert payoff / Match · decisions log

## Classification
**Standard** — new screen + one contained shared-file edit (navMap routing config) +
route promotion + bell rewire. No auth/payment/schema/route-removal.
Workflow: plan → dev → validate → ship → review → premerge.

## Pre-committed decisions (from /plan)
1. **Route + accent (user choice "go for quality"):** `/app/alerts` (top-level) with a
   `resolveNav` special-case → requests tab + jade `#6FBF9A`, FAB hidden. Chosen over
   `/app/requests/alerts` (bronze; fragile to force jade). Covered by RED-first test.
2. **navMap shared-file edit:** approved via the quality choice. Single special-case in
   section 1 (before the tab loop) + a jade constant; existing cases untouched.
3. **No new component CSS** — all §5 classes exist; entrance via the U7
   `[data-entrance]` hook (add route to `ENTRANCE_ROUTES`).
4. **Mock-first / display-led:** no matching/availability/notification mutations
   (internal-only, audited). CTAs navigate only; EARLIER history is static mock rows.
5. **Official "Open booking":** external deep-link anchor (`target=_blank`
   `rel=noopener noreferrer`) — frontend never calls the platform; verify/coverage
   skip non-`/` hrefs so it does not trip the dangling-link gate.
6. **Community "Buy with Protection":** → real `/app/checkout/listing_bms_event_1`.
7. **The one exclamation:** "Tickets are live!" — verified no automated gate bans `!`.
8. **Discount integrity:** render `.disc` "13% off · was ₹450" on the match card
   (verified-original mock, 450→390 = 13%). The integrity gate scopes to the 5
   fixture-bound marketplace routes, not `/app/alerts`; §5 is the screen that
   illustrates a verified match. Documented to pre-empt a review flag.
9. Decided self: back → `/app/home`; EARLIER rows data-driven (CPD safety).

## Decisions (filled during /dev)

- **Decision gates fired: 0** (plan quality: excellent — all CSS pre-existed, one user
  decision resolved up front).
- **TDD:** navMap special-case landed RED→GREEN (test asserted jade `#6FBF9A`; pre-impl
  it returned the violet default `#8E7BC9` → 1 fail; post-impl 29/0; full suite 173/0).
- **Official CTA gold tint:** no `.btn` gold class exists, so the gold-tinted "Open
  booking" anchor is inline-styled (`--gold-soft`/`--gold`, like U7's one-offs) — minor
  documented deviation, no new CSS.
- **Community foot layout:** price-d + disc + mode chip on a wrapping `.ac-foot`, with
  the rose Buy button full-width below (mobile-safe; the foot CTA slot stays compact for
  the secondary official card only).

### Exit-review (4 parallel lenses) — outcome
- **Spec fidelity:** FULLY FAITHFUL — every §5 element present, microcopy verbatim, only
  "Tickets are live!" bears the one exclamation, official CTA gold (not rose), community
  CTA rose `.btn-primary.sweep`. Deviations (mock catalog name; verified-match disc) are
  documented + reasonable.
- **a11y/correctness:** CLEAN — `.alert-card` markup matches the CSS contract; external
  anchor has `target=_blank rel="noopener noreferrer"`; all CTAs are anchors (no flow-in-
  button); all 6 icons (back/ticket/spark/shield/tag/arrow) exist in the sprite.
- **Route/CTA integrity:** CLEAN — navMap case sits before the tab loop, `#6FBF9A`, does
  not capture other routes; bell rewired; checkout link + external link both pass the
  gate; route promoted in all 3 places; `ENTRANCE_ROUTES` updated; knownForwardRoutes
  stays empty with every link resolving.
- **Copy/discount/dup:** CLEAN — no forbidden terms, single exclamation, disc math
  (450→390 = 13%) correct and gate-exempt for `/app/alerts` (documented), script
  additions are single-line (CPD-safe), the two alert-cards are content-distinct.

### CodeRabbit review (PR #25) — 2 actionable, outcome
- **#3444378167 (Minor) — "Official transfer" -> "Official Transfer":** FIXED. Canonical
  user-facing phrase per CLAUDE.md; chip text capitalised.
- **#3444378156 (Major) — event-level deep-link for "Open booking":** DECLINED (with
  reasoning). Mock-first / display-led slice; the real per-event official deep-link is
  data from the internal availability watcher (internal-only, audited, out of scope per
  CLAUDE.md). Fabricating a specific event URL would create an unverified / dead link
  (violates the verification rule). Kept a real official-site URL + added a code comment
  marking the watcher integration seam; the deep-link lands when that backend is built.
