# Product Spec

Source: ChatGPT shared conversation, extracted 2026-05-28.
Status: Baseline planning decision, not yet implemented.

## Product Definition

Zwapit is a mobile-first marketplace for buying and selling transferable
tickets, passes, watchers, bookings, and selected customer-managed handoffs.

The v1 proof is:
- A seller can easily list a transferable ticket/pass.
- A buyer can understand protection and buy safely.
- The platform can protect payment until completion without taking custody of the item first.

## Core Principles

- One account can buy and sell.
- Login is delayed until a buy/sell action.
- Seller flow is upload-first and form-later.
- Buyer flow is listing detail -> protection -> phone OTP -> pay.
- Buyer purchases are shown as My Tickets.
- Seller-side received purchases are shown as Orders inside Sell.
- Buyer and seller tracking are timeline-based.
- Disputes are structured reason plus evidence, not free chat first.
- Pricing is fully visible before payment.
- Trust details show transfer mode and payout rule upfront.

## First Visible Slice

The first visible slice uses mock data and mock payment.

It must show:
- Home marketplace surface.
- Sell upload flow.
- Mock Sell screen.
- Listing detail.
- Checkout preview.
- Mock My Tickets screen.
- Mock seller Orders screen inside Sell.
- Purchase/order timeline.
- Transfer timeline.
- Seller listing/sale status.

## Auth And Verification

- First slice may use `mockCurrentUserId = "user_demo_1"`.
- Sequence: mock user -> Convex data flow -> phone auth -> seller payout setup -> payments.
- Phone verification is required later for buy/sell actions.
- Full KYC is not part of the first slice.

## Seller Readiness

Sellers can start the upload/listing preparation flow before phone verification.

Seller sequence:
- tap Sell
- upload ticket/pass
- confirm extracted details
- set price and payout estimate
- accept seller promise/warranty
- verify phone
- complete payout setup
- publish when required rule checks allow it

A listing must not become purchasable until phone verification, payout setup, and
required rule checks are complete.

## Custody Boundary

The platform should not receive tickets or passes first.

Preferred patterns:
- seller-to-buyer transfer
- official issuer transfer
- official reissue
- customer-managed handoff

If a category requires platform custody, it is not v1 unless explicitly approved.

## Out Of Scope For First Slice

- Real Razorpay payments.
- Razorpay Route settlement.
- Neon/Postgres.
- Separate Node backend.
- React Native.
- Cloudflare deployment.
- Finished admin dashboard.
- Real OCR.
- AI ticket parser.
- Real KYC.
- Watcher redemption/transfer logic.
- Bus/operator-specific full rules.
- Full legal policy pages.
- Chat.
- Advanced search.
- Wallet.
- Complex seller analytics.
