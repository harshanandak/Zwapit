# First Visible Slice Research

Source date: 2026-05-29

## Goal

Plan the first implementable Zwapit slice without starting real auth, real
payments, production admin, or production source integrations.

The first slice proves:
- a mobile app shell can guide buyers and sellers without mode confusion
- a buyer can browse a BookMyShow event listing and create a mock paid order
- a seller can prepare a listing and see seller-side Orders inside Sell
- source/category rules can make system-first review decisions
- the timeline can show buyer/seller action, deadline, and consequence

## Source Material

- `docs/IMPLEMENTATION_CONTRACT.md`
- `docs/SOURCE_RULES.md`
- `docs/development-plan.md`
- `docs/decisions.md`
- `docs/UX_SPEC.md`
- `docs/DATA_MODEL.md`
- `docs/RULE_ENGINE.md`
- `docs/TRUST_SAFETY.md`
- `docs/reference/chatgpt-shared-conversation.md`

## Confirmed Decisions

- Bottom navigation: Home, Sell, My Tickets, Me.
- Buyer purchases live under My Tickets.
- Seller-side received purchases live under Orders inside Sell.
- Do not use Transactions in bottom navigation.
- Avoid Sales as the primary seller-side label.
- Mock fee: INR 10 + GST.
- Auth direction: Clerk first, behind a replaceable auth adapter/wrapper.
- First source/category targets:
  - BookMyShow movie
  - BookMyShow event
  - District movie
  - District event
  - bus travel
  - watchers
- First implemented fixture should use the BookMyShow event flow from
  `docs/IMPLEMENTATION_CONTRACT.md`.

## Architecture Research Summary

The app should start with Astro + React + Tailwind + Capacitor. Convex is the v1
backend, but the first visible slice should use local/mock data before real
schema wiring.

The implementation contract defines route/view IDs, fixture objects, first
backend slice tables, field contracts, state transitions, validations, UI states,
and acceptance criteria.

## Product And UX Research Summary

The shared conversation emphasizes progressive disclosure:
- users should not see internal rule complexity
- source/category rules become simple labels such as Official Transfer,
  Protected Handoff, Verify & Redeem, Waitlist Only, and Cannot List
- order timelines should answer what happened, who must act, the deadline, and
  the refund/payout consequence

Mode confusion is avoided by using clear navigation and labels:
- My Tickets for buyer-side purchases
- Orders inside Sell for seller-side received purchases

## Rule Engine Research Summary

The rule engine should be system-first:
- AUTO_APPROVE
- AUTO_BLOCK
- AUTO_WAITLIST
- NEEDS_MANUAL_REVIEW

Manual review is exception-only. The first implementation should encode the rule
model and fixture decisions, but not production source integrations.

## Backend Research Summary

First backend slice concepts:
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

Not first backend slice:
- payments
- settlement_holds
- notifications
- demand_discovery
- saved_searches
- watchlists

## Scope Boundaries

Do not implement in this slice:
- real Clerk auth
- real payments
- Razorpay
- real payout setup
- production admin workflow
- production source verification
- demand discovery
- high-value watcher marketplace
- real OCR or AI parser

## Plan Inputs

Use `docs/IMPLEMENTATION_CONTRACT.md` as the implementation source of truth for:
- routes
- fixtures
- fields
- transitions
- validations
- acceptance criteria

Use `docs/SOURCE_RULES.md` as the source/category rule source of truth.
