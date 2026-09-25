# Decisions: 29c3c5c2

## D1: One slice, three screens
Search, Set an alert, Alerts ship together. Any one alone leaves job broken. Use existing catalog/getOfficialCatalog, watcher/createAlert, watcher/getAlertPayoff, alertPayoffView.

## D2: Collapse key is sacred
catalogItemId|city|date|format only. Theatre does NOT shard monitor_targets. theatresJson is payload. Verified in convex/watcher/parse.ts.

## D3: Theatre scarcity is client filter
Single-theatre free, multi-theatre paid/entitled in one request (aggregated email). Prevents request-count wall while preserving incentive.

## D4: Price not in Search
maxPricePerUnit caps community only; official fires at any price. Search price filter removed.

## D5: ZeptoMail over Resend/Cloudflare
INR 150/10k, first 10k free, REST simple, bounces/webhooks adequate. Replaces stubbed email sender; webpush stays stubbed.

## D6: Phone verifies email
Typed email activates on phone verification with format check + bounce suppression + per-request toggle. No email OTP to keep flow cheap.

## D7: One free discounted request
Availability always free; Discount/Price-drop behind paid trial but every new user gets one free request at join to test.

## D8: Referral strength
Login (phone-verified) = 1 simple extra request; listing = 3 extra with one all-filters. Capability instantCommunityAlerts granted either way.

## D9: Allocation untouched
FIFO + reservation unchanged; tier only affects notification breadth and future limits, not queue position.

## D10: Monetization via fees
Primary revenue success fee; request caps generous (Standard ~5). Single-theatre scarcity drives paid, not hard count.
