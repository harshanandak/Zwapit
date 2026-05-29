# Decisions

Source: ChatGPT shared conversation, extracted 2026-05-28.
Status: Baseline planning decision, not yet implemented.

## D001 - Contract-First Vertical Slice

Decision: Define screens, routes, data objects, state machines, source rules, and
payment boundaries before building the full UI or full backend.

Consequence: Build one complete visible flow first: upload -> detected details ->
price/payout -> seller promise -> listing detail -> protection -> mock payment ->
transfer timeline -> buyer confirmation -> protection window -> completion.

## D002 - Stack

Decision: Use Astro, React, Tailwind, Capacitor, and Convex for v1.

Consequence: Do not start with React Native, Neon/Postgres, a separate Node
backend, or a financial ledger.

## D003 - Current UX Navigation

Decision: Use bottom tabs Home, Sell, My Tickets, Me.

Consequence: Buyer-side purchases live under My Tickets. Seller-side received
purchases live under Orders inside Sell. Do not use Transactions in bottom
navigation. Earlier Buy/Sell split tab drafts are superseded unless the user
explicitly revives them.

## D004 - Auth And Payment Sequencing

Decision: Use the sequence mock user -> Convex data flow -> phone auth -> seller
payout setup -> payments.

Consequence: The first visible slice can use `mockCurrentUserId = "user_demo_1"`.
Phone auth and payout setup are later gates before real buy/sell/payment.

## D005 - Payments Later

Decision: Add Razorpay Route or another compliant split-settlement provider only
after the mock order flow works.

Consequence: First slice uses mock payment and validates product flow before
webhooks, callback verification, settlement hold, release jobs, and refunds.

## D006 - No Platform Custody

Decision: The platform should not receive tickets/passes first in v1.

Consequence: Prefer seller-to-buyer transfer, official issuer transfer, official
reissue, code reveal, or customer-managed handoff.

## D007 - Rule Engine Is Core MVP

Decision: Source/category rules are core product safety, not an optional later
polish item.

Consequence: The rule engine must classify sources and categories and return a
system-first decision: AUTO_APPROVE, AUTO_BLOCK, AUTO_WAITLIST, or
NEEDS_MANUAL_REVIEW. Manual review is exception-only.

Initial concrete source/category targets:
- BookMyShow movie
- BookMyShow event
- District movie
- District event
- bus travel
- watchers

## D008 - Admin Scope

Decision: Do not build a finished admin dashboard in the first day-one slice,
but manual review is an MVP requirement.

Consequence: Admin shell/review concepts should be planned early; full dashboard
implementation waits until the core marketplace flow and rule engine exist.

## D009 - Do Not Over-Engineer First

Decision: The first milestone is structure, navigation, experience, first mock
flow, and state model.

Consequence: Do not add chat, advanced search, wallet, complex analytics,
operator dashboard, offline courier workflow, high-value watcher marketplace,
real OCR, AI parser, real KYC, deployment, or full legal pages in the first slice.

## D010 - Auth Provider

Decision: Use Clerk first for v1 speed, but isolate it behind a small auth
adapter/wrapper.

Consequence: App data must use internal user ids. Clerk ids stay in
`auth_identities`. The auth wrapper must expose `getCurrentUser`,
`requireUser`, `requirePhoneVerified`, and `syncUserToConvex` so the provider can
be replaced later.

## D011 - Buyer And Seller Navigation Language

Decision: Use My Tickets for buyer-side purchases and Orders for seller-side
received purchases inside Sell.

Consequence: Do not use Transactions as a bottom-nav label. Avoid Sales as the
primary seller-side label unless the user explicitly asks to restore it.

## D012 - Mock Checkout Fee

Decision: Use INR 10 + GST as the standard mock platform fee.

Consequence: Checkout summaries, fixtures, and acceptance criteria must show the
fee as INR 10 plus GST and include it in total payable.
