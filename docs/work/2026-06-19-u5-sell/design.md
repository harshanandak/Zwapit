# U5 — Sell flow → one v5 upload-first screen (v5)

- **Slug:** u5-sell
- **Date:** 2026-06-19
- **Status:** IMPLEMENTED — design approved by the user, built, and in review (PR #22, Critical change)
- **Branch / worktree:** `feat/u5-sell` · `.worktrees/u5-sell`
- **Classification:** **Critical** (breaking: removes contract-listed routes + new screen architecture).
  Workflow: plan → dev → validate → ship → review → premerge → verify.

## Why this is Critical (and needs sign-off)

The locked v5 spec frames Selling as **one upload-first screen** (`alerts-requests-screen-spec.md`
§8, steel). The live app is a **5-route wizard** — `/app/sell` + `/upload` + `/confirm` + `/price`
+ `/promise` (+ `/orders`) — that `docs/IMPLEMENTATION_CONTRACT.md`, the acceptance script, and the
seller smoke (incl. a tested Promise click-path) all assert. Consolidating means **removing four
contract-listed routes** and rewriting the contract + verify + seller-smoke. Routing is on the
"shared files need explicit approval" list. Hence: design first, approve, then build.

## Decision: Approach A — consolidate (chosen for UX + app quality)

One v5 `/app/sell` screen replaces the wizard. Rationale: lower friction (one fluid action vs 5
page-loads), app coherence (one consistently-styled flow, no lingering legacy screens), and spec
fidelity (the locked design only frames this one screen; design.md §3.5/§8 repeat "upload-first").
`/app/sell/orders` is kept (the seller-orders surface §8's "View sales" points to).

## Success criteria

1. `/app/sell` renders the v5 §8 upload-first screen (steel) in spec order: topbar "List a ticket"
   + `.sell-steps` (Upload → Details → Price → Review) → `.dropzone` ("Upload your ticket" +
   PDF/PNG/JPG `.fmt`) → demand band (reuse `.buyerwait`, bronze: "52 people looking · High
   interest" + "We never share buyer details or budgets.") → item confirm `.catres` (detected
   catalog summary) → price `.formrow`s ("Your price" `.stepper`, "Original price (optional)" +
   "Verify to show a discount badge.", read-only "Discount %") + urgent toggle ("Mark as urgent")
   → optional `.drop-sched` ("Auto price-drop", display-only preview) → eligibility `.tiles`/`.tile`
   ("Can list" / "Can't list") → "Your orders" `.order-metal` ("View sales" → `/app/sell/orders`)
   → `.stickybar` "Publish listing".
2. **The Publish action preserves the wizard's full function in one place:** phone-verification
   gate (reuse `gateProtectedActionLink` / the AuthActionGate pattern), inline **seller-promise
   acceptance** gating Publish, `submitSellerListingDraft(draft)` on accept, navigate to
   `/app/sell/orders`, and persist `SELLER_PUBLISHED_STORAGE_KEY` so the Orders "now live" banner
   still shows. The detected draft is seeded inline (mock); the price `.stepper` edits it in place.
3. **Routes retired:** `/app/sell/upload`, `/confirm`, `/price`, `/promise` deleted; removed from
   the contract, acceptance `routes[]`, `routeContentChecks`, and seller smoke. `/app/sell` and
   `/app/sell/orders` remain. The Sell FAB (BottomNav) and inbound links still target `/app/sell`.
4. The Promise click-path test moves to the consolidated screen's Publish path and is rewritten in
   the seller smoke: unchecked promise → `preventDefault` + warning ("Accept the seller promise to
   continue."), no navigation; checked → owns submit, navigates to `/app/sell/orders`, persists the
   published banner state.
5. Discount-integrity holds (no "% off" without a verified original price) — pinned by the existing
   acceptance "% off" guard, which already covers seller-entered original price (§8.6).
6. a11y from the start: steppers, toggles, the promise checkbox, and "Publish" are real
   `<button>`/`<input>` controls; the only `<a>` are real links ("View sales" → orders, the phone
   gate's account link). Steel entrance choreography on `/app/sell`, mirroring Home/Search.
7. All gates green: astro check, build, bun test, acceptance, **buyer (7) + seller smoke
   (rewritten)**, route-coverage (route count drops by 4), audit. Test names `should…when…`.

## Out of scope (backend / later waves)
- Real upload / OCR / ticket parsing — the detected draft stays mocked (`seller-detected-draft`).
- Real auto price-drop scheduling — `.drop-sched` is a display-only toggle + static preview note.
- Real "urgent / Ending soon" surfacing logic — visual toggle only.
- Profile **Selling hub** (§9, gold) and Plans (§10) — that's the Profile slice (U7), not U5.
- Razorpay / real payout — unchanged; payout-readiness still mocked via `seller_payment_accounts`.

## Approach / consolidation mapping (wizard → one screen)
| Wizard step (retired) | Folds into §8 section |
|---|---|
| `/upload` (dropzone, "Upload your ticket") | `.dropzone` + `.fmt` formats |
| `/confirm` (detected details) | `.catres` item-confirm block (editable summary) |
| `/price` (set price, payout) | price `.formrow`s + `.stepper` (+ payout note) |
| `/promise` (seller promise → submit → orders) | inline promise checkbox in the `.stickybar` Publish path |
| `/app/sell` (overview) | becomes the consolidated screen |
| `/app/sell/orders` | **kept** as-is (seller orders + published banner) |

Reuse every existing helper: `submitSellerListingDraft`, `gateProtectedActionLink`,
`AuthActionGate` (or its gate logic), the `SELLER_DRAFT_STORAGE_KEY` / `SELLER_PUBLISHED_STORAGE_KEY`
session carriers, `calculateCheckoutTotal` (payout), `SellerListingDraft`. No new flow/state logic.

## New CSS (additive only)
`.sell-steps` / `.sstep` (the step progress indicator) and `.drop-sched` (auto price-drop block) do
not exist yet — add them to the additive premium block, styled to the v5 system (steel, `.gl`).
Everything else exists: `.dropzone` `.stepper` `.formrow` `.fmt` `.formats` `.catres` `.tiles`
`.tile` `.stickybar` `.order-metal` `.buyerwait` `.seller-tick` `.avatar` (verified in global.css).

## Edge cases (decided)
- **Phone-verification gate:** Publish reuses the existing guarded path — an unverified/signed-out
  seller is routed to `/app/me?next=/app/sell` exactly as the wizard did (no new auth surface).
- **Promise unaccepted:** Publish click `preventDefault`s and shows the inline warning; no submit,
  no navigation (preserves the tested behavior, now on one screen).
- **Discount integrity:** "Discount %" stays read-only/empty unless a verified original price exists
  (no mock has one) → the screen shows "Seller price" semantics, never a fabricated "% off".
- **Retired routes:** deleted (not redirected) — the only inbound links were from within the wizard
  itself; the FAB and contract point at `/app/sell`. (Redirect-stubs are the fallback if we later
  want to preserve external bookmarks; not needed for v1.)

## Ambiguity policy
7-dimension rubric per the /dev decision gate. ≥80% confidence → proceed + document; <80% → stop and
ask. The screen is locked to §8; the main judgment calls (promise placement, route removal) are
resolved here and in this sign-off.

## OWASP / security
Static SSR of a mocked draft + a client Publish that reuses the **existing** phone-gated
`submitSellerListingDraft` mutation path. No new auth/payment/input/network surface. A01/A07 — the
phone-verification gate is preserved on Publish. A03 — Astro auto-escapes; the only input is the
local price stepper (numeric, mock). A10 — no new external calls. Net: no new risk introduced; the
material risk is *regression* in the seller flow, mitigated by moving (not dropping) the click-path
test and keeping `/app/sell/orders` + the published-banner contract intact.

## TDD scenarios
1. Publish with promise **unchecked** → `preventDefault`, warning shown, no navigation.
2. Publish with promise **checked** → `submitSellerListingDraft` called, navigates to
   `/app/sell/orders`, `SELLER_PUBLISHED_STORAGE_KEY` persisted.
3. Phone-unverified seller → Publish routes to `/app/me?next=/app/sell`.
4. `/app/sell` acceptance: renders List-a-ticket, Upload your ticket, people looking, Your price,
   Can list / Can't list, Publish listing (RED before the screen exists → GREEN after).
5. Route-coverage: the 4 sub-routes are gone; no dangling link references them.
6. (helper) any new pure helper (e.g. a payout/discount label) gets `should…when…` table tests.
