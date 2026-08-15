# Zwapit

Zwapit is a mobile-first Indian marketplace where a buyer says what they want *before* supply exists — a request for a specific movie show, event, or bus seat — and Zwapit tells them the moment it becomes available. Two supply sources fill that one demand: **official availability alerts** (Zwapit watches BookMyShow and District, notifies, and deep-links the user OUT to book on the official site, touching none of that money) and **community resale** (a protected-payment match between two users, where Zwapit earns a flat success fee). Closest analogues: Dice's waiting list crossed with StubHub's resale protection, except the request — not the listing — is the primary object.

The stack is Astro + React + Tailwind, wrapped by Capacitor for native, with Convex as the only backend. Deployed to Cloudflare Workers via Wrangler.

## How to use this file

Everything below is a **good default**. Harsha can override any of it in the moment, and an explicit instruction in the current message beats this file. What you may not do is override it *silently* — if you are about to do something this file says not to, say so and why, in the same message.

The one exception is [What we can never compromise on](#what-we-can-never-compromise-on). Those are vetoes. Check your own diff against them before you call anything done, and reject your own work if it violates one.

## What we can never compromise on

1. **Zwapit never touches official-platform money.** Official availability alerts notify and deep-link OUT to BookMyShow/District. Any code that takes payment for official inventory, or resells it, is wrong at the design level — not a bug to patch.
2. **No internal wallet, ever.** The payment provider is the money source of truth. Do not hold gross buyer money in a platform-owned account, and do not create a balance ledger that looks like one.
3. **The platform does not take custody of the item.** Seller-to-buyer transfer, official issuer transfer, official reissue, or customer-managed handoff. A category needing platform custody is out of v1 until Harsha approves it by name.
4. **Payment, refund, payout, matching, monitor, availability, and notification mutations are internal-only.** Never `mutation` — `internalMutation`/`internalAction` only, never reachable from a client. Every one of them writes to `audit_logs`.
5. **The frontend never calls BookMyShow or District directly.** Those calls live in `convex/watcher/` and `convex/catalogCrawl.ts`, behind Convex.
6. **Provider identity is never a primary id.** App data keys on the internal `users` id; Clerk (or any provider) identity lives in `auth_identities` only. A Clerk id on an order, listing, or payment is a defect.
7. **Every state transition is explicit.** No inferred state, no state derived from a timestamp comparison at read time. Listing and order states are the enumerations in [State model](#state-model).
8. **Do only what the current message asked.** A plan file, a task list, or a "Do Not Build Yet" item does not authorize itself. Finish the asked thing, verify it, stop.
9. **Do not state a code, payment, legal, or platform fact you have not just read.** Cite the file path and line. Unverified means you say "unverified".

## A note from Harsha

I care much more about the *request* half of this product than the resale half. The resale flow is how we make ten rupees; the alert is why anyone opens the app. When you are choosing what to polish, polish the moment where someone finds out their show is available.

The other thing: this is real money and real Indian regulatory surface. I would rather you stop and ask than ship a payment path that "should be fine". Nothing here is urgent enough to guess about.

*(Drafted from the rules repeated across the old CLAUDE.md and the decision log — [inferred voice, confirm or rewrite].)*

## Glossary

People and roles:
- **you** — the agent reading this file.
- **we** / **Zwapit** — the product and its codebase.
- **Harsha** — the user; the only person who approves scope, payments work, and custody exceptions.
- **user** — an end user of the app. Never "the customer", never "the merchant".
- **buyer** / **seller** — the two sides of a community resale.

Domain objects (these are the words to use back in reports, too):
- **Request** (schema: `wants`) — a buyer asking for a specific catalog item, with quantity, max price per unit, and expiry. The primary object of the product.
- **Alert** — how a request pays off. Types: Availability, Discount, Price-drop, Last-minute.
- **Listing** (`listings`) — a community resale offer.
- **Match** (`want_matches`) — a request paired to a listing.
- **Watcher** / **monitor target** (`monitor_targets`) — one shared poll of one official show. Many requests for the same show collapse to one watcher; the collapse key is exact: catalog id + venue + date + showtime + format.
- **Catalog item** (`catalog_items`) — the canonical thing being requested. Requests reference these, never free text, so matching is exact.
- **Source rule** (`source_rules`) — the per-source/per-category policy the rule engine evaluates.
- **Success fee** — INR 10 + GST (1.8), charged on a completed community resale. The only v1 revenue.

## Ten ways to hurt yourself in this repo

1. **Exposing an internal mutation.** Adding a matching, payout, or availability function as a public `mutation` because a component needed it. The component is wrong; add a read-model query instead.
2. **Writing a client-visible query that leaks the other side.** Sellers see a "people looking" count — never buyer identity, budgets, or priority numbers. Grep the projection, not just the table.
3. **Using a user-facing forbidden word in copy.** escrow, settlement, dispute, merchant, fulfilment, entitlement, KYC, linked account, AMBER, settlement hold, demand, allotment, reverse listing, queue, "#N in line", monitor target. These are internal vocabulary; see [User-facing language](#user-facing-language) for what to say instead.
4. **Running `bun run lint` or `bun run test`.** Neither script exists in `package.json`. See the [runbook](#dev-runbook).
5. **Breaking the watcher collapse key.** Loosening it (dropping `format`, rounding showtime) silently merges distinct shows and notifies the wrong subscribers. Tightening it fans out one poll into hundreds.
6. **Editing `convex/schema.ts` and a screen in the same change without a migration thought.** Convex validates on write; a widened field that old rows lack fails reads elsewhere. Widen → migrate → narrow.
7. **Committing `convex/_generated/` churn as if it were work.** It is committed on purpose (typecheck needs it) but regenerates constantly; do not bury a real diff in it.
8. **Adding a table.** Eighteen exist. Most "new feature needs a table" instincts here are actually a read-model over `listings` + `wants` + `want_matches` — that is how the whole UI was wired (commits #27–#31).
9. **Selling anything inside the native app.** Tiers, hold tokens, and alert-speed subscriptions inside the Capacitor build break Apple/Google in-app-purchase rules. Web/PWA only, later.
10. **Turning on WhatsApp or SMS notifications.** Blocked on TRAI/DLT registration and WhatsApp opt-in compliance. Email + Web Push are the shipped channels; Telegram is next.

## Hit every surface

Before you call a change done, **walk this list out loud** — name each row and say whether it applies and what you did about it. Saying "N/A" for a row is fine; skipping a row is not.

| Surface | What to check |
|---|---|
| **Convex schema** (`convex/schema.ts`) | New/changed field validated? Existing rows still valid? Index needed for the new query? |
| **Public vs internal** | Every new function classified. Money, matching, monitoring, notification → `internalMutation`/`internalAction`. |
| **Audit log** | Every payment, transfer, refund, issue, payout, and matching action writes `audit_logs`. |
| **Forward states** | Which of the listing/order/want states can this produce? |
| **Reverse states** | And how does each one come back — cancel, expire, refund, timeout, buyer_rejected, payout_blocked? A forward path with no reverse is an incident waiting. State the reverse path explicitly. |
| **Wire / contracts** | Convex arg + return validators changed? `convex/_generated/api.d.ts` regenerated? Any component reading the old shape? |
| **Screens** | Home, Search, Requests, Sell, Profile — which of the five tabs render this? |
| **Copy** | Forbidden vocabulary checked; price shown in full *before* payment; transfer mode and payout rule shown upfront. |
| **Rule engine** | Does this listing/order path route through `src/lib/rules/sourceRules.ts`? Blocked and DEMAND_ONLY sources still behave? |
| **Tests** | 34 test files exist. Which did you add or change? |
| **Native** | Capacitor build affected (new plugin, new permission, purchase surface)? Usually "no" — say so. |
| **Cloudflare** | Worker route or env var affected? `wrangler.jsonc` touched? |

Per-adapter decisions — including explicit *not supported*:

| Adapter | Status |
|---|---|
| Convex | The v1 backend. All state. |
| Clerk | Chosen for v1 auth, behind `src/lib/auth/authAdapter.ts` so it can be replaced. Not yet the live path — mock user `user_demo_1` still exists. |
| Razorpay Route (or another RBI-authorized aggregator) | Planned, **not built**. Do not add provider logic unasked. |
| BookMyShow, District | Read-only watching and catalog ingestion. **Booking is not supported and never will be** — deep-link out. |
| TMDB | Movie catalog source. IMDB has no usable public API — do not try. |
| Email, Web Push | Supported notification channels. |
| Telegram | Planned next. |
| WhatsApp, SMS | **Not supported.** Blocked on TRAI/DLT + opt-in compliance. |
| React Native | **Not supported in v1.** Capacitor is the wrapper. |
| Separate Node backend, Neon/Postgres | **Not supported in v1** unless Harsha asks by name. |

## Dev runbook

Exact spellings. `package.json` defines `dev`, `build`, `check`, `check:routes`, and the `cap:` / `android:` / `ios:` / `cf:` families — and **nothing else**.

```bash
bun install

bun run dev            # astro dev
bun run check          # astro check
bunx tsc --noEmit      # typecheck — this is what lefthook runs pre-commit and pre-push
bun test               # bun's built-in runner; there is NO "test" script
bun run build          # astro check && astro build
bun run check:routes   # route coverage
```

There is no `lint` script and no `typecheck` script. `bun run lint` and `bun run typecheck` both fail — use `bunx tsc --noEmit`.

Never `cd <dir> && <command>`. Use `git -C <dir>` for git and native path flags elsewhere.

Convex smoke checks against a browser need `PUBLIC_CONVEX_URL` in a gitignored local env file or the shell. `VITE_CONVEX_URL` is a compatibility fallback only. `.convex/` holds a local admin key and is gitignored — never commit it.

Native and deploy:

```bash
bun run cap:doctor
bun run android:build:debug
bun run ios:build:sim
bun run cf:dry-run     # verify a Worker deploy without deploying
```

CI runs `ci.yml`, `cloudflare-worker-preview.yml`, `cloudflare-worker-production.yml`, and `native-builds.yml`. Local green is not CI green.

## Test data

- `convex/seed.ts` seeds the demo listing, order, and timeline. The mock buyer is `user_demo_1`.
- Convex function tests use `convex-test` and live in `convex/__tests__/`; UI/logic tests live beside their source in `__tests__/` folders; acceptance tests in `tests/acceptance/`.
- The success fee under test is item price + 10 + 1.8 (`convex/seed.ts:76`). If that arithmetic changes, both the seed and `src/lib/mock/__tests__/fixtures.test.ts` change with it.
- [inferred — confirm] There is no designated staging Convex deployment named in the repo. Until there is, treat any non-local Convex deployment as production and say so before writing to it.

## Taste

- Mobile-first means thumb-first: the primary action sits where a thumb rests, not where the layout is tidy.
- Selling is upload-first, form-later. Ask for the photo, then the details.
- Login is delayed until a buy or sell action, never at the door.
- Timelines answer three questions in order: what happened, what is due next, what happens if the deadline is missed.
- Disputes start with structured reasons and evidence, not a chat box.
- The alert payoff is the product's best moment. It should feel like good news, not a system notification.

## Standards, as the symptoms a user would report

- *"It charged me more than the page said."* → Show item price, platform fee, total payable, refund conditions, transfer deadline, and protection deadline before payment. Always.
- *"I paid and the seller vanished."* → Transfer deadlines are dynamic: `min(24h from payment, event_start_time − safety_buffer)`. A missed deadline moves the order toward timeout/refund, automatically.
- *"I got an alert for the wrong show."* → The watcher collapse key was loosened. It is exact by design.
- *"Someone bought it before me even though I asked first."* → Allotment is FIFO by request creation time, and the matched buyer gets a time-boxed reservation before the listing opens to everyone. Waves, not a visible queue.
- *"It says my request is #4 in line."* → We never show queue positions. Status is Standard / Priority / High Priority.
- *"The app asked me to pay for a subscription."* → Nothing is sold inside the native app.
- *"I never agreed to WhatsApp messages."* → That channel is off until compliance is built.

## Escape hatch

If this file blocks something that clearly needs doing, or contradicts itself, or describes a repo that no longer exists — **stop and say so in one line**, name the section, and propose the amendment. Do not route around it quietly, and do not write a paragraph defending a workaround. A rule that needs an essay to justify breaking is the wrong rule or the wrong change; either way Harsha decides, not you.

---

# Reference

## Build order

1. Product contract and agent instructions. 2. Mobile UI prototype. 3. Astro + React + Capacitor shell. 4. Convex backend. 5. Auth. 6. Upload-first seller flow. 7. Source rule engine. 8. Listing marketplace. 9. Demand-first requests and catalog groundwork. 10. Buyer checkout. 11. Order timeline. 12. Transfer workflow. 13. Dispute/refund workflow. 14. Internal settlement hold/release. 15. Admin dashboard. 16. Demand discovery analytics. 17. Category expansion.

Shipped through the read-model wiring of all five tabs, the official-availability watcher, and BMS movie-catalog ingestion (commits #23–#37). Payments, admin, and category expansion have not started.

## Requests and alerts

Decided 2026-06-12 (demand-first) and 2026-06-16 (alerts as the primary object). Full design: `docs/work/2026-06-12-ui-revamp/design.md`.

- A request references a canonical catalog item, with quantity, max price per unit, and expiry.
- Catalog sources: TMDB for movies; curated/manually seeded live events; curated bus routes (Google Places/Routes may assist with location data). User-submitted catalog entries are allowed but reviewed.
- Post a request and matching live listings exist → show them immediately (instant path).
- New listing goes live → matched against open requests on the same catalog item, by quantity and price-cap fit.
- Allotment is FIFO by request creation time; the matched buyer gets a time-boxed reservation before the listing opens publicly.
- Sellers can sell directly into a request ("Buyer waiting" instant sell).
- Request states: open, matched, reserved, fulfilled, expired, cancelled.
- Matching uses alert waves: priority/best-match first, then all matching requesters, then public browse. No exact queue numbers, no paid holds in v1.
- Tiers and referrals buy *earlier alerts and more requests* — never guaranteed access. Referral rewards unlock on verified-friend actions, not installs.
- A request for a blocked category cannot be posted; DEMAND_ONLY sources are request-only by definition.

## Rule engine

System-first: it should decide as many listings and orders as possible without a human. Manual review is exception-only — when the rules cannot confidently approve, block, or waitlist.

- Decisions: `AUTO_APPROVE`, `AUTO_BLOCK`, `AUTO_WAITLIST`, `NEEDS_MANUAL_REVIEW`.
- Source rule statuses: `ALLOW`, `AMBER`, `DEMAND_ONLY`, `BLOCKED`.
- Transfer modes: `OFFICIAL_TRANSFER`, `OFFICIAL_REISSUE`, `CUSTOMER_MANAGED_HANDOFF`, `CODE_REVEAL`, `IDENTITY_BOUND`.
- A rule carries: category (BookMyShow movie/event, District movie/event, bus travel, watchers, future), source (BookMyShow, District/Zomato, bus operator/platform, other platform, manual upload), source/category classification, transferability status, buyer protection level, manual review flag, required eligibility fields, price cap or price review rule, payout policy, blocked-category behaviour.

## State model

Listing: `draft`, `under_review`, `live`, `sold`, `paused`, `expired`, `blocked`, `waitlist_only`.

Order: `checkout_pending`, `payment_captured`, `transfer_pending`, `fulfilment_in_progress`, `transfer_submitted`, `buyer_confirmed`, `dispute_window_open`, `issue_reported`, `buyer_rejected`, `refund_processing`, `refunded`, `payout_eligible`, `payout_waiting`, `payout_released`, `payout_sent`, `seller_payout_blocked`, `completed`, `transfer_timeout`.

Vertical-slice happy path: live listing → mock purchase → `transfer_pending` → `transfer_submitted` → `buyer_confirmed` → `dispute_window_open` → `completed`.

## Payments and payouts

- No real payment provider logic in the mock slice.
- The later flow needs: provider order creation, checkout, callback verification, webhook verification, idempotency/dedupe, order-paid transition, settlement hold, release job, refund path.
- Fee: INR 10 + GST.
- Seller payout setup must be complete before a listing can become purchasable.
- Payout timing depends on category completion *plus* the dispute window — not on payment success alone.

## Auth and identity

- The mock slice uses `mockCurrentUserId = "user_demo_1"`.
- Sequence: mock user → Convex data flow → phone auth → seller payout setup → payments.
- Clerk first for v1 speed, behind `src/lib/auth/authAdapter.ts`.
- Phone verification gates buy/sell later. Full KYC is not in the first slice.
- Internal app user id everywhere; provider identity in `auth_identities`.

## UX baseline

Bottom tabs: Home, Sell, My Tickets, Me. Buying: listing detail → protection → phone OTP → pay. Buyer purchases show as My Tickets; seller-side purchases as Orders inside Sell. Both sides are timeline-based.

Older Buy/Sell split-tab drafts are inactive unless Harsha revives them.

## User-facing language

Say: Official Transfer, Protected Handoff, Verify & Redeem, Waitlist Only, Cannot List, Protected payment, Payout, Report issue, Upload to Sell, Buy with Protection, Transfer needed, Payout waiting, Request a ticket, Set an alert, Notify me, We'll match you, Tickets are live, Buyer waiting, People looking, Priority.

Never say (to a user): escrow, settlement, dispute, merchant, fulfilment, entitlement, KYC, linked account, AMBER, settlement hold, demand, allotment, reverse listing, queue, "#N in line", monitor target.

## Do not build yet

Unless Harsha asks by name: chat, advanced search, wallet, complex seller analytics, operator dashboard, offline courier workflow, high-value watcher marketplace, full Neon financial ledger, organiser API marketplace, real OCR, AI ticket parser, real KYC, full legal policy pages.

## Parallel agents

Two agents must not work the same file-ownership area at once, and shared files need explicit approval before parallel edits: `package.json`, routing config, shared types, schema-related frontend types, global constants. Concurrent git work goes in separate worktrees, never the shared checkout.

[stale — confirm] The old file split ownership as "Codex owns backend/state/tests, Claude owns UI/wording/flow". Current routing sends all dispatched work to Opus 5 subagents regardless of area, so this split no longer describes reality. The file-contention rule above is the part still worth keeping.

## Forge workflow

The 7-stage TDD workflow (`/plan` → `/dev` → `/validate` → `/ship` → `/review` → `/premerge` → `/verify`), change classification, hard gates, and the `forge` CLI mappings live in **`.claude/rules/workflow.md`** and the **`forge-workflow`** skill. Read those when Harsha names a Forge stage or command, or asks to plan/dev/validate/ship/review/premerge/verify. Do not run Forge stages unasked.

Where Forge guidance conflicts with this file, this file wins — specifically scope discipline, the never-compromise list, build order, and do-not-build-yet.

Planning artifacts go in one folder per work item: `docs/work/YYYY-MM-DD-<slug>/` (`research.md`, `design.md`, `tasks.md`, `decisions.md`, `evaluator-report.md`, `evidence.md`). `docs/plans/` and `docs/research/` are read-only legacy.

Issue tracking is Beads via `forge` (`forge ready` / `forge show <id>` / `forge claim <id>` / `forge close <id>`); use `bd` directly only for what Forge does not wrap (`bd init`, `bd comments`, `bd dep`, `bd dolt *`). Markdown TODO lists are never the source of truth.

## Product docs

`docs/PRODUCT_SPEC.md`, `docs/UX_SPEC.md`, `docs/FLOWS.md`, `docs/DATA_MODEL.md`, `docs/RULE_ENGINE.md`, `docs/SOURCE_RULES.md`, `docs/PAYMENT_FLOW.md`, `docs/TRUST_SAFETY.md`, `docs/COPY_GUIDE.md`, `docs/decisions.md`, `docs/development-plan.md`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
