# UX Spec

Source: ChatGPT shared conversation, extracted 2026-05-28.
Status: Baseline planning decision, not yet implemented.

## Current Navigation Decision

Use bottom tabs:
- Home
- Sell
- My Tickets
- Me

Buyer purchases are shown under My Tickets. Seller-side received purchases are
shown as Orders inside Sell. Do not use "Transactions" in bottom navigation.

This supersedes the earlier draft that used a top Buy/Sell switch plus
mode-specific bottom tabs. Keep that earlier split-tab option as historical
context only unless the user explicitly revives it.

## Mobile-First Design Chart

| Area | UX decision |
|---|---|
| Navigation | Bottom tabs: Home, Sell, My Tickets, Me |
| Login | Delay until buy/sell action |
| Selling | Upload-first, form-later |
| Buying | Listing detail -> protection -> phone OTP -> pay |
| Trust | Show transfer mode and payout rule upfront |
| My Tickets | Buyer-side ticket/order timeline |
| Sell Orders | Seller-side received orders, transfer tasks, and payout status |
| Disputes | Structured reason plus evidence, not free chat first |
| Pricing | Full price before payment |
| Admin | Manual review capability is needed for MVP, but not a finished day-one dashboard |
| Notifications | Push plus WhatsApp/SMS for deadlines later |
| App wrapper | Capacitor; native camera, push, and file picker later |

## Initial Routes

- `/`: marketing page.
- `/app`: mobile app shell.
- `/admin`: admin shell later, not a finished dashboard in the first slice.

## First App Shell

Inside `/app`, build:
- Bottom tab shell.
- Mock cards.
- Timeline component.
- Upload entry.
- Listing detail entry.
- Order status entry.

Do not connect real auth or payments in the first UI shell.

## Core Screens

Build these screens for the first UI pass:
- Home marketplace.
- Sell Upload.
- Detected Details.
- Price and Payout.
- Seller Promise.
- Listing Detail.
- Buyer Checkout Preview.
- Buyer Purchase Timeline.
- Transfer Result.
- Seller Listing Status.
- Sell Listings / Orders surface.
- My Tickets surface.

## Reusable Components

Core components:
- Button
- Input
- PhoneInput
- OTPInput
- Card
- BottomSheet
- Stepper
- Timeline
- StatusBadge
- RiskBadge
- ProtectionBadge
- ListingCard
- PriceBreakdown
- UploadBox
- EvidenceUploader
- CountdownTimer

Marketplace components:
- CategoryPill
- TransferModeBadge
- EligibilityBadge
- SellerTrustBadge
- ListingSummary
- BuyerProtectionBox
- PayoutEstimateBox
- RefundRulesBox

Admin components, for later MVP work:
- RiskScoreBadge
- RuleStatusBadge
- EvidenceViewer
- OrderStateTimeline
- ManualReviewPanel
- SettlementHoldPanel
