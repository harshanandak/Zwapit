# Trust And Safety

Source: ChatGPT shared conversation, extracted 2026-05-28.
Status: Baseline planning decision, not yet implemented.

## Verification Ladder

Use this sequence:
- mock user for first slice
- phone verification for buy/sell actions
- seller payout setup before purchasable listings
- stronger checks/manual review for higher-risk categories later

Full KYC is not part of the first visible slice.

## Category Risk Rules

Rule engine outcomes:
- AUTO_APPROVE
- AUTO_BLOCK
- AUTO_WAITLIST
- NEEDS_MANUAL_REVIEW

Manual review is exception-only. The system should auto-approve, auto-block, or
auto-waitlist whenever rules are confident.

Internal source status outcomes:
- ALLOW
- AMBER
- DEMAND_ONLY
- BLOCKED

Examples:
- BookMyShow movie/event with official transfer evidence: usually auto-approve.
- District/Zomato movie/event: verify source eligibility and resale support before approval.
- Bus travel: require eligibility/passenger restriction confirmation before approval.
- Non-transferable tickets: Cannot List or Waitlist Only.
- Identity-bound passes: blocked or manual review.
- Offline tickets: not v1; usually Waitlist Only.
- High-value watchers: manual review or blocked.
- Screenshot-only tickets: warning/manual review/source rule.
- Unsupported sources with demand: Waitlist Only / demand discovery.

## Evidence Model

Disputes must use structured evidence.

Evidence sources:
- buyer uploaded evidence
- seller transfer evidence
- provider/payment evidence
- admin review notes
- timestamps and audit logs

Outcomes:
- refund
- reject issue
- manual review
- seller payout block

Seller-responsible failures:
- seller cannot prove ownership/control
- seller listed the same item elsewhere
- duplicate QR/code/hash
- fake item
- wrong item
- hidden or mismatched buyer eligibility restriction
- non-transferable item represented as transferable
- seller impersonation or account mismatch

Usually excluded from seller responsibility:
- bad event/trip/show experience
- buyer changed plans after valid transfer
- issue outside stated protection/refund conditions

Watcher disputes need concrete examples before implementation.

## Deadline Model

Deadlines must be visible to users.

Transfer deadline pattern:
- `min(24 hours from payment, event_start_time - safety_buffer)` where event timing exists.

Protection deadline:
- completion or event/trip/show end plus category dispute window.

Missed deadlines lead to timeout, refund path, payout block, or manual review.

## Custody Boundary

The platform should not receive tickets, passes, or watchers first in v1.

Preferred methods:
- official transfer
- official reissue
- seller-to-buyer handoff
- code reveal
- customer-managed handoff
