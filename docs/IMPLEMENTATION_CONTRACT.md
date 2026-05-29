# Implementation Contract

Source: Current Zwapit planning decisions, 2026-05-28.
Status: First-slice implementation contract.

## First-Slice Route And View IDs

Use real routes for top-level app surfaces and detail flows.

- `/` -> marketing placeholder.
- `/app` -> redirect or render `/app/home`.
- `/app/home` -> Home marketplace.
- `/app/sell` -> Sell overview and upload entry.
- `/app/sell/upload` -> upload mock ticket/pass.
- `/app/sell/confirm` -> detected details confirmation.
- `/app/sell/price` -> price and payout estimate.
- `/app/sell/promise` -> seller promise.
- `/app/sell/orders` -> seller-side Orders.
- `/app/tickets` -> buyer-side My Tickets.
- `/app/listings/:listingId` -> listing detail.
- `/app/checkout/:listingId` -> checkout preview.
- `/app/orders/:orderId` -> shared order/transfer timeline.
- `/app/me` -> profile placeholder.
- `/admin` -> admin shell placeholder only.

Bottom nav:
- Home -> `/app/home`
- Sell -> `/app/sell`
- My Tickets -> `/app/tickets`
- Me -> `/app/me`

Seller Orders are inside Sell, not bottom navigation.

## First Mock Fixture

Use one primary fixture first. Add more after the shell works.

Mock user:
- `mockCurrentUserId`: `user_demo_1`
- role: buyer and seller capable
- phone status: mock verified placeholder

Mock listing:
- id: `listing_bms_event_1`
- category: `event_ticket`
- source: `bookmyshow`
- source category key: `bookmyshow_event`
- title: `Arijit Singh Live - Silver Pass`
- venue: `Bengaluru Arena`
- event start: fixed future date in local timezone during implementation
- quantity: 1
- face value: INR 2400
- listing price: INR 2400
- platform fee: INR 10 + GST
- transfer mode: `OFFICIAL_TRANSFER`
- rule decision: `AUTO_APPROVE`
- listing state: `live`
- transfer deadline: event start minus safety buffer, or same-day 6:00 PM for mock
- protection deadline: event end plus issue window

Mock order:
- id: `order_demo_1`
- buyer id: `user_demo_1`
- seller id: `seller_demo_1`
- listing id: `listing_bms_event_1`
- state: `checkout_pending` before mock pay, then `transfer_pending`
- mock payment summary: item price, platform fee, GST, total payable, status `mock_paid`

Mock transfer task:
- id: `transfer_demo_1`
- order id: `order_demo_1`
- actor required: seller
- state: `transfer_pending`
- deadline: same value as listing transfer deadline

Mock issue:
- id: `issue_demo_1`
- order id: `order_demo_1`
- reason: `ticket_not_transferred`
- state: `draft`

## First Backend Slice Tables

First backend slice:
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

First-slice `seller_payment_accounts` is mocked only. It is used to demonstrate
the future payout gate and must not connect to a real provider.

Not first backend slice:
- payments
- settlement_holds
- notifications
- demand_discovery
- saved_searches
- watchlists

## First-Slice Field Contract

`source_rules`:
- source
- category
- source_category_key
- version
- decision: AUTO_APPROVE, AUTO_BLOCK, AUTO_WAITLIST, NEEDS_MANUAL_REVIEW
- internal_status: ALLOW, AMBER, DEMAND_ONLY, BLOCKED
- transfer_mode
- required_fields
- eligibility_fields
- price_rule
- payout_policy
- manual_review_reason_codes
- effective_from
- last_verified_at
- verification_source_url_or_note
- created_by

`listings`:
- seller_id
- source_rule_id
- source_rule_version
- category
- source
- title
- venue_or_route
- event_or_trip_start_at
- quantity
- face_value
- listing_price
- platform_fee
- gst_on_fee
- total_payable
- transfer_mode
- transfer_deadline_at
- protection_deadline_at
- state
- rule_decision
- duplicate_fingerprint

`orders`:
- buyer_id
- seller_id
- listing_id
- state
- mock_payment_status
- mock_payment_summary
- transfer_task_id
- issue_window_ends_at
- created_at

`transfer_tasks`:
- order_id
- required_actor
- state
- deadline_at
- submitted_at
- evidence_summary

`issues`:
- order_id
- reason_code
- state
- required_evidence
- evidence_items
- decision

Use the table name `issues` in the first backend slice. It carries dispute
semantics, but do not create a separate `disputes` table yet.

`seller_payment_accounts`:
- seller_id
- status: `mock_ready`, `missing`, `needs_setup`
- provider: `mock`
- can_receive_payouts
- created_at

`audit_logs`:
- actor_type
- actor_id
- action
- entity_type
- entity_id
- from_state
- to_state
- reason_code
- correlation_id
- created_at

## First-Slice State Transitions

Seller listing:
- draft -> under_review, action `submit_for_rule_check`
- draft -> live, action `auto_approve_listing`
- draft -> waitlist_only, action `auto_waitlist_listing`
- draft -> blocked, action `auto_block_listing`
- under_review -> live, action `manual_approve_listing`
- under_review -> blocked, action `manual_block_listing`

Order:
- checkout_pending -> transfer_pending, action `mock_pay`
- transfer_pending -> transfer_submitted, action `seller_mark_transferred`
- transfer_submitted -> buyer_confirmed, action `buyer_confirm_received`
- buyer_confirmed -> dispute_window_open, action `open_protection_window`
- dispute_window_open -> completed, action `complete_after_window`
- transfer_pending -> transfer_timeout, action `transfer_deadline_missed`
- any active order -> issue_reported, action `buyer_report_issue`

## Validation Rules

Seller upload/confirm blocks progression when:
- title missing
- source missing
- category missing
- date/time missing
- price missing or <= 0
- quantity missing or <= 0
- transfer method missing
- seller promise unchecked
- rule decision is AUTO_BLOCK

Buyer checkout blocks progression when:
- listing is not live
- transfer deadline has passed
- buyer has not acknowledged eligibility restrictions
- total payable is not visible
- rule decision is AUTO_BLOCK or AUTO_WAITLIST
- mocked seller payout account is not `mock_ready`

Seller transfer submission blocks when:
- order is not transfer_pending
- transfer deadline has passed
- required evidence/confirmation is missing

Buyer confirmation blocks when:
- order is not transfer_submitted

## Issue Reason Codes

First slice issue reasons:
- `ticket_not_transferred`
- `wrong_ticket`
- `qr_or_code_already_used`
- `details_do_not_match`
- `eligibility_problem`
- `cannot_access_ticket`

Evidence for first slice may be mocked as text plus optional file placeholder.

## UI States Required

Home:
- live listing
- empty
- waitlist-only item
- blocked item hidden

Sell:
- upload empty
- detected details
- rule auto-approved
- under review
- blocked
- waitlist only

My Tickets:
- no tickets
- waiting for seller transfer
- confirm receipt needed
- protection active
- issue reported
- completed

Seller Orders:
- no orders
- transfer required
- waiting for buyer
- payout waiting
- completed

Checkout:
- ready
- blocked
- deadline passed
- mock paid

## Acceptance Criteria

First visible slice is complete when:
- routes listed above render without broken navigation
- bottom nav shows Home, Sell, My Tickets, Me
- Home shows the BookMyShow event mock listing
- listing detail shows transfer mode, protection, price, INR 10 + GST fee, total, transfer deadline, and protection deadline
- Sell flow can move through upload, confirm, price, promise, and auto-approved result
- Checkout can create a mock paid order
- checkout creates the order as `checkout_pending` and then `mock_pay` transitions it to `transfer_pending`
- My Tickets shows buyer timeline
- Sell Orders shows seller transfer task
- timeline can advance through mock state transitions
- Report issue captures reason code and evidence placeholder
- auth adapter/wrapper contract is documented even though real Clerk auth is not implemented yet
- no real payment, real auth, real payout, or production admin workflow is implemented in the first slice
