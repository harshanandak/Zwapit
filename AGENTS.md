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
4. **Payment, refund, payout, matching, monitor, availability, notification, and admin effects are `internalMutation`/`internalAction`, and each writes to `audit_logs`.** Two client-facing exceptions exist on this surface, both in `convex/watcher.ts`: `createAlert` (`mutation`) and `getAlertPayoff` (`query`). They are deliberate and predate this rule — do not "fix" them into internal functions, because `src/lib/ui/createAlert.ts` calls `createAlert` and converting it breaks alert creation outright. Describe them accurately: `createAlert` is not a wrapper, it writes `monitor_targets` and `wants` directly after `requireAuthenticatedAppUser`. Its audit trail is complete as of PR #47: creating a monitor target calls `appendWatcherAuditLog` (`convex/watcher.ts`), and the wants insert (`want_created`), the wants re-arm patch (`want_rearmed`) and the subscriberCount patch (`monitor_target_subscriber_count_changed`) each write an audited row with the buyer's actorRole. Do not remove that trail. Adding a third client-facing exception is a deliberate edit to this list, not a judgement call at the call site.
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
- **Watcher** / **monitor target** (`monitor_targets`) — one shared poll of one official show. Many requests for the same show collapse to one watcher; the collapse key is exact and byte-identical across callers: `catalogItemId|city|date|format` (`computeCollapseKey` in `convex/watcher/parse.ts` — a missing format leaves an empty trailing segment). It is movie-and-city level, not show level: do not add venue or showtime, which would split the existing contract and need inputs the alert mutation does not accept.
- **Catalog item** (`catalog_items`) — the canonical thing being requested. Requests reference these, never free text, so matching is exact.
- **Source rule** (`source_rules`) — the per-source/per-category policy the rule engine evaluates.
- **Success fee** — INR 10 + GST (1.8), charged on a completed community resale. The only v1 revenue.

## Ways to hurt yourself in this repo

Each entry is earned from something that actually went wrong here. The tag is the evidence. Mined 2026-08-15 over 44 commits, 40 CI runs, and the live toolchain.

1. **Running `bun run lint`, `bun run typecheck`, or `bun run test`.** None of the three exists. `package.json` defines only `dev`, `build`, `check`, `check:routes`, and the `cap:` / `android:` / `ios:` / `cf:` families. Use `bunx tsc --noEmit` and bare `bun test`. `[config: 9 dead invocations across .claude/rules/workflow.md and .claude/commands/validate.md]`

2. **Claiming tests pass without running them.** PR CI does run `bun test` (`ci.yml` `tests` job, gating the CodeRabbit check), so a green PR is real — but it is 58s of feedback you get *after* pushing. Run `bun test` locally first; use the targeted lane while iterating. `[verified 2026-08-14: ci.yml:87-108 on pull_request; 315 pass / 0 fail locally]`

3. **Believing "it works locally" about anything route- or deploy-shaped.** The single largest fix cluster in this repo is deploy: production credential handling, Cloudflare route rewriting, and a checkout flow that resolved locally and 404'd in production. `[git: 3 of 5 fix commits are deploy/Cloudflare — 8f72355, e1e5f76, e728fd7]` Verify with `bun run cf:dry-run` before believing a routing change.

4. **Changing `convex/schema.ts` casually.** It appears in 5 of the 9 fix-type commits and has 8 commits of its own — the most-corrected backend file. Convex validates on write, so a widened field old rows lack breaks reads elsewhere. Widen → backfill → narrow, and run `bunx tsc --project convex/tsconfig.json --noEmit` (CI does; lefthook does not). `[git: convex/schema.ts in 5 of 9 fix commits]`

5. **Touching the read-model seam without re-checking both sides.** `src/lib/convex/dataAdapter.ts` (11 commits) and `src/lib/convex/functionRefs.ts` (7) are the most-churned source files in the repo — that is where the UI meets Convex, and where drift lands. `[git: 11 and 7 commits, top of source churn]`

6. **Loosening the watcher collapse key.** `convex/watcher.ts` and `convex/__tests__/watcher.test.ts` each appear in 3 fix commits. The collapse key inputs are exactly `catalogItemId|city|date|format` (`computeCollapseKey`, `convex/watcher/parse.ts`) — showtime was never one, so don't "fix" that. The real ways to merge distinct shows: dropping the `format` segment entirely (the empty trailing segment IS meaningful for events), normalizing city/date differently between `createAlert` and later callers, or letting a page-level booking marker fire without `eventShowMatchesTargetDate` narrowing it to this target's occurrence.

7. **Hiding a real diff inside `convex/_generated/` churn.** It is committed on purpose (typecheck needs it) and regenerates constantly — `api.d.ts` has 8 commits. Assume nothing about whether it is currently dirty: run `git status` and stage it deliberately or not at all. Treat a generated diff as a real change to review, never as background noise you can skip. `[git: 8 commits]`

8. **Running `bd`/`forge` and leaving a Dolt server behind.** Invoking `bd ready` here moved the Dolt endpoint (port 52703 → 56174) and warned that other tools would see stale data. This is why `.beads/dolt-server.{port,pid,lock,log}` keep reappearing untracked. Pin `dolt.port` in `.beads/config.yaml` before running two Beads-backed tools at once. `[observed 2026-08-15: live port reassignment + stale-data warning]`

9. **Reaching for `scripts/verify-first-visible-slice.mjs` and friends as if they were wired up.** `scripts/` holds 19 files with no `package.json` entry, including the most-churned file in the entire repo (21 commits), plus `ui-smoke-buyer.mjs` (9), `e2e-buyer.mjs`, `e2e-seller.mjs`, and `validate.sh`. They run only as `bun scripts/<name>.mjs`. `[git: 21 commits on an unwired script; 19 orphans total]`

10. **Overwriting the agent instructions.** It has already happened once — a commit exists purely to put them back. If a tool offers to regenerate `AGENTS.md` or `CLAUDE.md`, diff it first. `[git: 82e991f "fix: restore zwapit agent instructions"]`

11. **Bumping dependencies as a side effect.** `package.json` (11 commits) and `bun.lock` (10) are the joint-most-churned files and appear in 6 of 9 fix commits — including a security bump that needed its own fix. CI installs with `--frozen-lockfile`, so a stale lockfile fails everything. `[git: package.json/bun.lock in 6 of 9 fix commits]`

## Hit every surface

Before you call a change done, **walk this list out loud** — name each row and say whether it applies and what you did about it. Saying "N/A" for a row is fine; skipping a row is not.

Rows marked `[git]` exist because a past commit missed exactly that surface; the rest are `[imported]` and should be reviewed with the borrowed defaults below.

| Surface | What to check |
|---|---|
| **Convex schema** (`convex/schema.ts`) `[git: 5 of 9 fix commits]` | New/changed field validated? Existing rows still valid? Index needed for the new query? Ran `bunx tsc --project convex/tsconfig.json --noEmit`? |
| **Read-model seam** `[git: dataAdapter.ts 11, functionRefs.ts 7]` | Both sides of `src/lib/convex/` still agree with the Convex function signatures? |
| **Public vs internal** | Every new function classified. Money, matching, monitoring, notification → `internalMutation`/`internalAction`. |
| **Audit log** | Every payment, transfer, refund, issue, payout, and matching action writes `audit_logs`. |
| **Forward states** | Which of the listing/order/want states can this produce? |
| **Reverse states** | And how does each one come back — cancel, expire, refund, timeout, buyer_rejected, payout_blocked? A forward path with no reverse is an incident waiting. State the reverse path explicitly. |
| **Wire / contracts** | Convex arg + return validators changed? `convex/_generated/api.d.ts` regenerated? Any component reading the old shape? |
| **Screens** | Home, Search, Requests, Listings, Profile — which of the five tabs (`src/lib/ui/navMap.ts`) render this? Selling is a FAB, not a tab — check `/app/sell` separately if it applies. |
| **Copy** | Forbidden vocabulary checked; price shown in full *before* payment; transfer mode and payout rule shown upfront. |
| **Rule engine** | Does this listing/order path route through `src/lib/rules/sourceRules.ts`? Blocked and DEMAND_ONLY sources still behave? |
| **Tests** | 34 test files, 315 tests. Which did you add or change? Did you run the full `bun test` locally, before PR CI runs it for you? |
| **Native** | Capacitor build affected (new plugin, new permission, purchase surface)? Usually "no" — say so. |
| **Cloudflare / routing** `[git: 3 of 5 fix commits]` | Worker route or env var affected? `wrangler.jsonc` touched? Ran `bun run cf:dry-run`? A route that resolves locally has 404'd in production here before. |
| **Dependencies** `[git: package.json + bun.lock in 6 of 9 fix commits]` | If you changed `package.json`, is `bun.lock` regenerated? CI installs `--frozen-lockfile`. |

Per-adapter decisions — including explicit *not supported*:

| Adapter | Status |
|---|---|
| Convex | The v1 backend. All state. |
| Clerk | v1 auth, behind `src/lib/auth/authAdapter.ts` so it can be replaced. **Live wherever `PUBLIC_CLERK_PUBLISHABLE_KEY` is set** — including production (`.github/workflows/cloudflare-worker-production.yml`). Mock user `user_demo_1` is only the no-key local fallback: `createCurrentAuthState()` returns signed-out, not mock, as soon as the key is configured. |
| Razorpay Route (or another RBI-authorized aggregator) | Planned, **not built**. Do not add provider logic unasked. |
| BookMyShow, District | Read-only watching and catalog ingestion. **Booking is not supported and never will be** — deep-link out. |
| TMDB | Movie catalog source. IMDB has no usable public API — do not try. |
| Email, Web Push | **Stubbed, not delivering.** The senders exist and are dependency-injected, but `convex/watcher/senders.ts` no-ops both: email has no recipient plumbing (`NotificationMessage` carries no `to`), and web push has no subscription wiring or package. Nothing reaches a user on either channel today. |
| Telegram | Planned next. |
| WhatsApp, SMS | **Not supported.** Blocked on TRAI/DLT + opt-in compliance. |
| React Native | **Not supported in v1.** Capacitor is the wrapper. |
| Separate Node backend, Neon/Postgres | **Not supported in v1** unless Harsha asks by name. |

## Dev runbook

Exact spellings and **real measured timings** (2026-08-15, this machine, warm). `package.json` defines `dev`, `build`, `check`, `check:routes`, and the `cap:` / `android:` / `ios:` / `cf:` families — and **nothing else**.

```bash
bun install

bunx tsc --noEmit                                  #  4s  ← what lefthook runs pre-commit AND pre-push
bun run check                                      # 12s  astro check
bunx tsc --project convex/tsconfig.json --noEmit   #  4s  Convex types — CI runs this, lefthook does NOT
bun run check:routes                               # <1s  route coverage
bun run build                                      # 23s  astro check && astro build
bun test                                           # 71s  315 tests — the slow one
bun test convex/__tests__/watcher.test.ts          #  1s  ← targeted lane, use this while iterating
bun run dev                                        #      astro dev
```

**There is no `lint`, `test`, or `typecheck` script.** `bun run lint`, `bun run test`, and `bun run typecheck` all fail.

Cheapest useful gate while iterating: `bunx tsc --noEmit` + the one targeted test file (~5s). Run the full `bun test` once before you say tests pass — PR CI runs it too, but 58s locally beats a red check after the push.

Deploy checks:

```bash
bun run cf:dry-run     # verify a Worker deploy without deploying — use before claiming a route works
bun run cf:preview     # wrangler versions upload
```

Local CodeRabbit review before push (WSL CLI, catches bot findings without burning a CI cycle):

```bash
wsl -d Ubuntu -e bash -lc "cd /mnt/c/Users/harsha_befach/Downloads/Zwapit && coderabbit review --dir convex --base master --light"
# scope --dir to what changed (convex|src|docs); authenticated already (org harshanandak).
```

Unwired helpers (no `package.json` entry — invoke directly): `bun scripts/verify-first-visible-slice.mjs`, `bun scripts/ui-smoke-buyer.mjs`, `bun scripts/e2e-buyer.mjs`, `bun scripts/e2e-seller.mjs`, `bash scripts/validate.sh`.

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
- *"The app asked me to pay for a subscription."* → Subscriptions are not sold inside the native app. Resale checkout is, and that is a different thing.
- *"I never agreed to WhatsApp messages."* → That channel is off until compliance is built.

## Borrowed defaults

`[imported — no local incident]` for all of these. They come from the product docs and the old CLAUDE.md, not from anything that has gone wrong here yet. Capped at seven — to add one, retire one or produce evidence. Review and promote or cut.

1. Sellers see a "people looking" count only — never buyer identity, budgets, or priority numbers.
2. Prefer a read-model over `listings` + `wants` + `want_matches` to a new table. Eighteen tables exist; the whole UI was wired without adding one.
3. Tiers, hold tokens and alert-speed subscriptions are not sold inside the native app — those are digital goods and Apple/Google want their in-app-purchase cut. Web/PWA only, later. Community-resale checkout is a different thing and stays in the app; it is the product.
4. WhatsApp and SMS stay off until TRAI/DLT registration and opt-in compliance exist.
5. Manual review is exception-only; the rule engine should decide as much as it can.
6. Two agents never work the same file-ownership area at once; concurrent git work goes in separate worktrees.
7. Shared files (`package.json`, routing config, shared types, schema-related frontend types, global constants) need explicit approval before parallel edits.

**Evidence not available:** the session-history mine found nothing usable — `.claude/projects/C--Users-harsha-befach-Downloads-Zwapit/` contains zero transcripts, and a scan of 2,650 user messages in the parent project directory produced 20 topic+correction hits, all false positives (compaction summaries, teammate messages, pasted skill text). No user-correction cluster could be derived. CI is likewise silent: 40 runs, 39 success and 1 cancelled Dependabot run, so no failing-check pattern exists to mine.

## Shipping regime (pre-user)

Zwapit has no users yet, so a feature PR is reviewed as a feature, not as a diff.

- The merge artifact is a **demo** (recording or screenshots from the dev runbook) plus the plan's acceptance checklist walked out loud, plus a description that leads with the problem. Line-level correctness is the agent loop's job — implementer, spec review, quality review — inside the PR.
- **Completeness gates the merge, size does not.** Every state and transition, every entry point, every reverse path the plan named gets walked before ship. Half-built is the failure, big is not.
- **Bot review is advisory** except secrets, injection, and a broken build. Feedback never expands the PR — file the follow-up.
- **Main is recoverable:** squash-only, branch deleted on merge, revert or fix forward within the hour, never debug on a red main.

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

Bottom tabs: Home, Search, Requests, Listings, Profile — five, defined in
`src/lib/ui/navMap.ts`. Selling is a FAB to `/app/sell`, not a tab
(`src/components/BottomNav.astro`). Buying: listing detail → protection → phone OTP →
pay. Buyer purchases and seller-side orders both live under Listings, and both sides
are timeline-based.

Superseded and inactive unless Harsha revives them: the four-tab `Home, Sell, My
Tickets, Me` shell, and the older Buy/Sell split-tab drafts.

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

Planning artifacts go in one folder per work item: `docs/work/YYYY-MM-DD-<slug>/` (`research.md`, `design.md`, `tasks.md`, `decisions.md`, `evaluator-report.md`, `evidence.md`). The old file called `docs/plans/` and `docs/research/` "read-only legacy" — neither directory exists; ignore both.

**Known-broken references in the generated Forge files** (fix or ignore; do not follow):
`.claude/rules/workflow.md` and `.claude/commands/validate.md` tell you to run `bun run lint`, `bun run typecheck`, `npm run lint`, `npm run test`, and `npm run typecheck` — none exist. `.claude/rules/workflow.md`, `.claude/commands/plan.md`, and `.claude/commands/research.md` invoke `Skill("parallel-deep-research")`; the real skill is `parallel-research`, and it comes from the harness (a Claude Code plugin), not from this repo — if your harness does not provide it, do the research directly and say so. `.claude/commands/review.md` points at `.claude/rules/greptile-review-process.md`, and `.claude/commands/sonarcloud.md` at `src/lib/integrations/sonarcloud.ts` — neither file exists. `.claude/settings.json`, `docs/pull_request_template.md`, and `.claude/commands/custom/` are also referenced and absent. The `forge` and `bd` binaries themselves are installed and every subcommand these files use is real (verified 2026-08-15).

Issue tracking is Beads via `forge` (`forge ready` / `forge show <id>` / `forge claim <id>` / `forge close <id>`); use `bd` directly only for what Forge does not wrap (`bd init`, `bd comments`, `bd dep`, `bd dolt *`). Markdown TODO lists are never the source of truth.

## Product docs

`docs/PRODUCT_SPEC.md`, `docs/UX_SPEC.md`, `docs/FLOWS.md`, `docs/DATA_MODEL.md`, `docs/RULE_ENGINE.md`, `docs/SOURCE_RULES.md`, `docs/PAYMENT_FLOW.md`, `docs/TRUST_SAFETY.md`, `docs/COPY_GUIDE.md`, `docs/decisions.md`, `docs/development-plan.md`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **read `convex/_generated/ai/guidelines.md`
first if it is present** for important guidelines on how to correctly use
Convex APIs and patterns. The file contains rules that override what you may
have learned about Convex from training data.

That file is generated, not committed — it does not exist in a fresh checkout.
Run `npx convex ai-files install` to produce it (and the Convex agent skills)
before relying on it. Its absence is not a reason to stop; say you proceeded
without it.

Everything between the `convex-ai` markers above is owned by that command and
is rewritten each time it runs, here and in any `CLAUDE.md` it finds. Put
durable guidance outside the markers, or the next install silently drops it.

<!-- convex-ai-end -->
