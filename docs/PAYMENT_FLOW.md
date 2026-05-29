# Payment Flow

Source: ChatGPT shared conversation, extracted 2026-05-28.
Status: Baseline planning decision, not yet implemented.

## Decision

Do not add real payment provider logic in the first visible slice.

Use mock payment first so the product flow is visible before payment complexity
is introduced.

## Payment Provider Model

Later payments must evaluate a compliant payment-provider flow, such as Razorpay
Route or another RBI-authorized payment aggregator / split-settlement provider.

Cashfree and PayU are future evaluation candidates if Razorpay Route does not
fit the required flow. No provider fit is confirmed in these docs.

Rules:
- Payment provider is the money source of truth.
- Convex is the workflow/source-rule/order-state source of truth.
- Do not build an internal wallet.
- Do not hold gross buyer money in a platform-owned account.

## Auth And Payment Sequence

1. Mock user.
2. Convex data flow.
3. Phone auth.
4. Seller payout setup.
5. Payments.

Seller payout setup must be complete before a listing becomes purchasable.

## Buyer Checkout Requirements

Checkout must show:
- item price
- platform fee: INR 10 + GST for the mock flow
- GST on platform fee
- total payable
- transfer mode
- refund conditions
- transfer deadline
- protection deadline

Once auth is introduced, buyer phone verification happens before payment.

## Later Razorpay / Provider Scope

Add provider payments only after the core order flow works.

Later payment work must include:
- provider order creation
- checkout
- callback verification
- webhook endpoint
- webhook signature verification
- payment event dedupe/idempotency
- order paid transition
- listing lock
- transfer task creation
- settlement hold
- release job
- refund path

## Payout Timing

Payout does not happen simply because payment succeeded.

Payout timing depends on:
- category completion moment, such as event/show/trip completion
- successful transfer/fulfilment
- dispute/protection window
- category payout policy
- unresolved issue/manual-review state

## Safety Rules

- Do not expose payment, refund, payout, or admin mutations directly to clients.
- Use internal functions for sensitive state transitions.
- Add audit logs for payment, transfer, refund, issue, and payout actions.
- Refund and payout decisions must be state-machine driven.
