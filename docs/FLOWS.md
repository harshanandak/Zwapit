# Flows

Source: ChatGPT shared conversation, extracted 2026-05-28.
Status: Baseline planning decision, not yet implemented.

## Core Flows

- Seller upload flow.
- Buyer purchase flow.
- Transfer flow.
- Issue/report flow.
- Payout flow.
- Waitlist flow.
- Blocked listing flow.
- Demand discovery flow.

## First Vertical Slice

1. App uses `mockCurrentUserId = "user_demo_1"`.
2. Seller opens Sell.
3. Seller uploads fake/mock ticket or pass.
4. App shows detected details.
5. Seller confirms or edits extracted details.
6. Seller sees source/category rule result.
7. Seller sets price and sees payout estimate.
8. Seller accepts seller promise/warranty.
9. Mock slice shows where phone verification will happen before real publishing.
10. Mock slice shows where payout setup will gate real purchasable listings.
11. Listing moves to live in the mock flow when placeholder rule checks pass.
12. Buyer opens listing from Home.
13. Buyer sees transfer mode, protection explanation, refund conditions, price, INR 10 + GST platform fee, total, transfer deadline, and protection deadline.
14. Buyer clicks Buy with Protection.
15. Mock payment succeeds.
16. Listing locks for the buyer.
17. Purchase appears in My Tickets.
18. Sale appears in seller Orders inside Sell.
19. Seller marks transferred.
20. Buyer confirms received.
21. Order enters dispute/protection window.
22. Order completes after the protection window if no issue is accepted.

## Auth Sequence

1. Mock user.
2. Convex data flow.
3. Phone auth.
4. Seller payout setup.
5. Payments.

Real phone auth and seller payout setup are not part of the first mock/local
flow. They become required before real publishing and payment.

## Buyer Checkout Flow

1. Listing detail.
2. Protection explanation.
3. Phone OTP, once auth is introduced.
4. Price breakdown.
5. Mock payment first; real provider later.
6. Order timeline.

## Transfer Flow

1. Payment/order captured.
2. Transfer pending.
3. Seller performs seller-to-buyer transfer, official transfer, reissue, code reveal, or customer-managed handoff.
4. Seller submits transfer evidence or marks transfer done.
5. Buyer confirms or rejects.
6. Dispute window opens.
7. Payout becomes eligible after completion plus category dispute window.

The platform should not receive the ticket/pass first.

## Issue And Refund Flow

1. Buyer reports a structured issue reason.
2. Buyer uploads evidence.
3. System compares issue reason against objective refund rules.
4. Seller/admin evidence is reviewed when needed.
5. Outcome is refund, rejection, manual review, or payout block.

Seller-responsible examples:
- seller does not own/control the item
- seller listed the same item elsewhere
- duplicate QR/code/hash
- fake item
- wrong item
- non-transferable item sold as transferable
- buyer eligibility restriction was hidden or mismatched
- seller impersonation or account mismatch

Non-seller-responsible examples:
- buyer disliked the event/trip/show experience
- buyer changed plans after receiving a valid transfer
- issue is outside the stated protection/refund conditions

## Waitlist And Blocked Listing Flow

- Unsupported but valuable sources become Waitlist Only or demand discovery.
- Unsafe or disallowed categories become Cannot List / blocked.
- Manual-review categories become Under Review before purchasable listing.

## System-First Review Flow

The system should make the first decision automatically:

1. Seller uploads/enters item.
2. Source/category rule runs.
3. Duplicate QR/code/hash and required-field checks run where possible.
4. Rule result is one of AUTO_APPROVE, AUTO_BLOCK, AUTO_WAITLIST, or NEEDS_MANUAL_REVIEW.
5. Manual review happens only for NEEDS_MANUAL_REVIEW.
6. Manual review can approve, block, or send to waitlist.
