# Data Model

Source: ChatGPT shared conversation, extracted 2026-05-28.
Status: Baseline planning decision, not yet implemented.

## V1 Convex Table Concepts

This section lists broader v1 concepts, not the first backend slice. Use
`docs/development-plan.md` for first-slice implementation boundaries.

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
- payments
- transfer_tasks
- disputes
- issues
- refunds
- settlement_holds
- notifications
- audit_logs
- demand_discovery

Names may be adapted to local Convex naming conventions during implementation,
but the concepts above must be preserved.

Later/demand-discovery tables, not first-slice requirements:
- buyer_preferences
- saved_searches
- watchlists

## First Convex Slice

Minimum first backend slice:
- users
- auth_identities
- user_verifications
- seller_profiles
- buyer_profiles
- seller_payment_accounts
- source_rules
- entitlements
- listings
- orders
- transfer_tasks
- issues
- audit_logs

Later/demand-discovery tables may be added after the core marketplace flow:
- buyer_preferences
- saved_searches
- watchlists
- notifications
- demand_discovery
- payments
- settlement_holds

## Identity Boundary

Always store:
- `users.id` as the internal app user id.
- `auth_identities.provider` such as `clerk` or `better_auth`.
- `auth_identities.provider_subject_id` as the provider user id.

Never store provider ids such as Clerk ids as the main id on:
- orders
- listings
- payments
- transfer tasks

Use internal ids:
- `orders.buyer_id = internal_user_id`
- `orders.seller_id = internal_user_id`
- `listings.seller_id = internal_user_id`

## Required Relationships

- One account can buy and sell.
- Users may have buyer and seller profile data.
- Seller payout account gates purchasable listings.
- Listings connect to seller identity, source rules, and category/rule classification.
- First-slice orders store buyer id, seller id, listing id, mock payment summary, transfer task id, and state.
- Transfer tasks connect to orders.
- Issues connect to orders and carry dispute semantics in the first slice.
- Settlement holds connect to orders/payments later, not in the first backend slice.
- Notifications connect to users/orders/deadlines later, not in the first backend slice.
- Audit logs record sensitive state changes.

## Required Index Coverage

Indexes must support:
- Home marketplace live listings.
- User orders.
- Seller listings.
- Seller Orders.
- Listing rule status.
- Orders by state.
- Transfer tasks by deadline.
- Disputes by status/manual review.
- Settlement holds by release time later.
- Demand discovery by source/category later.

## Data Ownership Rules

- Payment provider stores money state.
- Convex stores workflow, source rules, order state, and audit trail.
- The platform does not maintain an internal wallet ledger in v1.
