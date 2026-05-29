# Source And Category Rules

Source: ChatGPT shared conversation and user decisions, extracted 2026-05-28.
Status: Planning artifact. Rules must be verified against current source terms before production use.

## Purpose

Zwapit should use a system-first review model.

The system should automatically approve, block, or waitlist as many items as
possible. Manual review is only for cases where the rule engine cannot make a
confident decision.

## Initial Categories And Sources

Initial concrete targets:
- `bookmyshow_movie`
- `bookmyshow_event`
- `district_movie`
- `district_event`
- `bus_travel`
- `watchers`

Future sources:
- other platform
- manual upload

Normalized source enum:
- `bookmyshow`
- `district_zomato`
- `bus_operator`
- `other_platform`
- `manual_upload`

Normalized category enum:
- `movie_ticket`
- `event_ticket`
- `bus_travel`
- `watchers`

## Decision Outputs

Every listing check should return one of:
- AUTO_APPROVE
- AUTO_BLOCK
- AUTO_WAITLIST
- NEEDS_MANUAL_REVIEW

Manual review can then return:
- APPROVED
- BLOCKED
- WAITLIST_ONLY

## Rule Inputs

Rules should consider:
- category
- source
- source event/type
- transfer method
- proof/evidence
- duplicate QR/code/hash
- buyer eligibility restrictions
- seller ownership promise
- seller promise not to list elsewhere
- event/trip/show timing
- transfer deadline
- face value and listing price
- payout setup status, once payments exist

Transfer mode enum:
- `OFFICIAL_TRANSFER`
- `OFFICIAL_REISSUE`
- `CUSTOMER_MANAGED_HANDOFF`
- `CODE_REVEAL`
- `IDENTITY_BOUND`

## Rule-To-UX Mapping

| Rule | UX | System enforcement |
|---|---|---|
| Phone verification required | OTP before buying/listing | Auth gate |
| Seller owns item | Seller promise screen | Required confirmation |
| Seller must not list elsewhere | Seller promise screen | Duplicate QR/hash checks |
| Buyer payment protected | Listing, checkout, My Tickets timeline | Payment/provider hold later |
| Seller paid after completion | Seller Orders payout tracker | Scheduled release later |
| Transfer deadline | Timeline and notifications | Auto-refund/manual review later |
| Buyer dispute window | Countdown in My Tickets | Dispute deadline |
| Fake/duplicate/wrong item | Buyer protection card | Issue/refund workflow |
| Bad event experience | Protection details say not refundable | Issue reason limits |
| Bus gender/eligibility matching | Eligibility card before checkout | Buyer confirmation + rule check |
| Trains | Cannot List | Listing blocked |
| Flights | Cannot List or Waitlist Only | Listing blocked/waitlisted |
| Offline tickets | Waitlist Only | No payment |
| High-value watchers | Manual review or blocked | Rule engine |
| Screenshot-only ticket | Warning/manual review | Source rule |
| Unsupported valuable source | Waitlist Only | Demand discovery |
| Seller payout account needed | Payout setup screen | Listing/payout gate later |
| Watcher dispute | Evidence required | Dispute evidence rules |
| Buyer must match restrictions | Eligibility confirmation | Purchase gate |
| No impersonation | Buyer/seller confirmation | Blocked category/rule |

## BookMyShow Movie/Event Starting Rule

Use AUTO_APPROVE only when:
- source is BookMyShow
- ticket is transferable through official transfer or QR transfer flow, represented as `OFFICIAL_TRANSFER`
- required ticket details are present: title, venue/origin-destination, date/time, quantity, face value, listing price, source, transfer method, and transfer deadline
- seller confirms ownership and no duplicate listing
- duplicate QR/code/hash check passes

Use NEEDS_MANUAL_REVIEW when:
- transfer evidence is unclear
- ticket is screenshot-only
- event/category rules are ambiguous
- price/risk rule is triggered

Use AUTO_WAITLIST when:
- source is valuable but transfer support is unavailable or unclear

Use AUTO_BLOCK when:
- source rule says transfer/resale is not allowed
- identity restriction cannot be satisfied
- duplicate/fake evidence is detected

## District Movie/Event Starting Rule

District/Zomato items require source eligibility checks.

Use AUTO_APPROVE only when:
- the item is eligible under the source's sell/resale mechanism
- transfer/resale support is clearly available
- source restrictions and price caps are satisfied
- required ticket details are present: title, venue, date/time, quantity, face value, listing price, source, transfer method, and transfer deadline

Use AUTO_WAITLIST or AUTO_BLOCK when:
- ticket was not purchased through the eligible source flow
- paid resale is unsupported
- source terms prohibit the listing

Use NEEDS_MANUAL_REVIEW when:
- eligibility is unclear
- price cap or event-specific rule cannot be verified

## Bus Travel Starting Rule

Use AUTO_APPROVE only when:
- ticket/booking is transferable or passenger changes are allowed by source/operator
- route, date/time, boarding point, and passenger restrictions are present
- passenger restriction fields are present: passenger name rule, gender rule if any, age rule if any, ID-name-match rule, boarding point, seat/class, operator/platform, and change/transfer policy evidence
- buyer confirms eligibility restrictions before checkout

Use NEEDS_MANUAL_REVIEW when:
- transferability is unclear
- passenger restriction is ambiguous
- source/operator policy is unknown

Use AUTO_BLOCK when:
- passenger identity cannot be changed and mismatch would prevent travel
- source/operator forbids transfer

## Watchers Starting Rule

This category needs concrete examples before implementation.

Default:
- high-value watchers -> NEEDS_MANUAL_REVIEW or AUTO_BLOCK
- unsupported watcher sources -> AUTO_WAITLIST

Do not implement high-value watcher marketplace in the first slice.

## Rule Versioning

Each source rule must store:
- rule id
- source enum
- category enum
- version
- status
- effective from
- last verified at
- verification source URL or note
- created by system/admin

Each listing must store the rule id and rule version used for the listing
decision.
