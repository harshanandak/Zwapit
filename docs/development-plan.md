# Development Plan

Source: ChatGPT shared conversation, extracted 2026-05-28.
Status: Planning artifact only. This file does not authorize agents to continue
work without an explicit user request.

## Correct Starting Approach

1. Write the product contract.
2. Scaffold the app.
3. Build the mobile UI shell.
4. Build mock flows with fake data.
5. Add Convex schema and functions.
6. Replace fake data screen by screen.
7. Add Razorpay or another provider only after the core order flow works.

## Final Execution Order

1. Mobile UI prototype.
2. Astro + React + Capacitor shell.
3. Convex backend.
4. Auth.
5. Upload-first seller flow.
6. Source rule engine.
7. Listing marketplace.
8. Buyer checkout.
9. Order timeline.
10. Transfer workflow.
11. Dispute/refund workflow.
12. Internal settlement hold/release workflow.
13. Admin dashboard.
14. Demand discovery.
15. Category expansion.

## Day-One / First Visible Target

Build only the foundation and first visible mock slice:
- Repo docs and agent instructions.
- Astro + React + Tailwind app shell.
- Capacitor app wrapper setup.
- Convex added, but not full backend logic yet.
- Bottom tabs: Home, Sell, My Tickets, Me.
- Mock Home marketplace.
- Mock Sell screen.
- Mock My Tickets screen.
- Mock seller Orders/listing status screen inside Sell.
- First listing detail screen.
- First checkout preview.
- First purchase/order timeline.
- First transfer timeline.

Do not add real auth, real payments, Razorpay, full KYC, finished admin
dashboard, issue resolution, payout release, deployment, real OCR, AI parser, or
full legal policy pages in the first visible slice.

## Recommended Agent Order

1. Create docs and agent instructions.
2. Claude builds the app shell and first UI screens.
3. Codex reviews project structure and adds backend plan.
4. Codex creates Convex schema.
5. Claude connects first UI screens to Convex.
6. Codex reviews state transitions and adds tests/checks.

Do not start two implementation agents at once until the repo structure is
stable.

After the first commit, parallelize only with separate branches or worktrees:
- Claude agent A: Home/My Tickets UI.
- Claude agent B: Sell/seller Orders UI.
- Codex agent A: Convex listing/order backend.
- Codex agent B: state-machine/test review.

## Reviewable Commit Plan

This is the reviewable project sequence, not a command to implement all of it
now:

1. Product docs and agent instructions.
2. Project scaffold.
3. Mobile app shell with Home/Sell/My Tickets/Me.
4. Mock screens and friendly copy.
5. Convex schema and first functions.
6. Connect listings and orders to Convex.
7. First vertical slice working.
8. Auth and phone verification.
9. Source rule engine.
10. Payment provider integration.
11. Dispute/refund and payout release.
12. Admin/manual-review workflow.

## First Backend Prompt Shape

Read `AGENTS.md` and the current app shell.

Create the Convex data model for the first vertical slice.

Tables:
- users
- auth_identities
- user_verifications
- buyer_profiles
- seller_profiles
- seller_payment_accounts
- source_rules
- entitlements
- listings
- orders
- transfer_tasks
- issues
- audit_logs

Plan later, but do not implement in the first backend slice:
- payments
- settlement_holds
- notifications
- demand_discovery

Requirements:
- Use internal app user ids everywhere.
- Store auth provider identities separately.
- Support one account with buy and sell roles.
- Orders must store buyer id and seller id.
- Listings must support draft, under_review, live, sold, paused, expired, blocked, waitlist_only.
- Orders must support payment, transfer, dispute, refund, payout, timeout, and completion states from `docs/RULE_ENGINE.md`.
- Include indexes needed for Home marketplace, buyer My Tickets, seller listings, seller Orders, transfer deadlines, and manual review.
- Use internal functions for sensitive state transitions.
- Add audit logs for payment, transfer, refund, issue, and payout actions.
- Do not add real payment provider logic yet.
