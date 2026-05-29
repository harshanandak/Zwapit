# Rule Engine

Source: ChatGPT shared conversation, extracted 2026-05-28.
Status: Baseline planning decision, not yet implemented.

## Source Rule Contract

Each source/category rule must define:
- source/category classification
- rule status: ALLOW, AMBER, DEMAND_ONLY, or BLOCKED
- transfer mode
- transferability status
- buyer protection level
- manual review flag
- required eligibility fields
- price cap or price review rule
- payout policy
- blocked category behavior

Initial source/category targets:
- BookMyShow movie
- BookMyShow event
- District movie
- District event
- bus travel
- watchers

The rule engine should maximize automatic decisions and reserve manual review
for uncertain/risky cases only.

System decision outputs:
- AUTO_APPROVE
- AUTO_BLOCK
- AUTO_WAITLIST
- NEEDS_MANUAL_REVIEW

## Internal Rule Statuses

- ALLOW: safe enough for supported paid listing.
- AMBER: possible but requires warning, eligibility checks, or manual review.
- DEMAND_ONLY: do not allow paid resale; collect demand/waitlist signal.
- BLOCKED: cannot list.

## Transfer Modes

- OFFICIAL_TRANSFER
- OFFICIAL_REISSUE
- CUSTOMER_MANAGED_HANDOFF
- CODE_REVEAL
- IDENTITY_BOUND

## User-Facing Rule Labels

Internal statuses should be hidden behind simple labels:

- Official Transfer
- Protected Handoff
- Verify & Redeem
- Waitlist Only
- Cannot List

Do not show internal terms such as AMBER, settlement hold, or entitlement to users.

## Listing States

- draft
- under_review
- live
- sold
- paused
- expired
- blocked
- waitlist_only

## Order / Transfer States

- checkout_pending
- payment_captured
- transfer_pending
- fulfilment_in_progress
- transfer_submitted
- buyer_confirmed
- dispute_window_open
- issue_reported
- buyer_rejected
- refund_processing
- refunded
- payout_eligible
- payout_waiting
- payout_released
- payout_sent
- seller_payout_blocked
- completed
- transfer_timeout

## First Vertical-Slice State Machine

Start with:
- live listing
- mock buyer purchase
- transfer_pending
- transfer_submitted
- buyer_confirmed
- dispute_window_open
- completed

Do not implement all exception paths immediately.

## Later Failure And Exception States

Add later:
- payment_captured
- fulfilment_in_progress
- transfer_timeout
- issue_reported
- buyer_rejected
- refund_processing
- refunded
- payout_eligible
- payout_released
- seller_payout_blocked

## Transfer Deadlines

Transfer deadlines should be dynamic.

Default pattern:
- `min(24 hours from payment, event_start_time - safety_buffer)` when event timing exists.

If no event timing exists, use the category rule's transfer SLA.

Missed deadlines should lead toward:
- transfer_timeout
- buyer refund path
- seller payout block
- manual review, where needed

## Category And Safety Rules

Examples of rule outcomes:
- BookMyShow movie: usually AUTO_APPROVE only when official transfer/QR-transfer evidence is available; otherwise NEEDS_MANUAL_REVIEW or AUTO_WAITLIST.
- BookMyShow event: usually AUTO_APPROVE only when transfer is available and recipient acceptance is supported; otherwise NEEDS_MANUAL_REVIEW.
- District/Zomato movie or event: source eligibility and terms must be checked; unsupported resale becomes AUTO_WAITLIST or AUTO_BLOCK.
- Bus travel: eligibility, passenger restrictions, route/time, and transferability must be confirmed before AUTO_APPROVE.
- Non-transferable tickets: Cannot List or Waitlist Only.
- Identity-bound passes: blocked or manual review.
- Offline tickets not v1: Waitlist Only.
- High-value watchers: manual review or blocked.
- Screenshot-only tickets: warning/manual review/source rule.
- Unsupported sources with demand: Waitlist Only / demand discovery.
- Seller payout account missing: payout setup gate.

## Dispute And Evidence Rules

Issue handling must use objective reasons and evidence.

Rules must distinguish:
- accepted refund reasons
- excluded refund reasons
- buyer evidence
- seller evidence
- platform/admin evidence
- outcome: refund, reject, manual review, or payout block

Free-form chat is not the first dispute mechanism.

Seller-responsible failures should be refundable or payout-blocking:
- seller cannot prove ownership/control
- seller lists the same item elsewhere
- duplicate QR/code/hash is detected
- item is fake
- item is the wrong item
- item is not transferable as represented
- buyer eligibility restrictions were hidden or mismatched
- seller impersonation or account mismatch

Usually excluded from refund responsibility:
- buyer dislikes the event/trip/show experience
- buyer changes plans after a valid transfer
- issue is outside the stated protection/refund window

Watcher-specific evidence rules need concrete examples before implementation.
