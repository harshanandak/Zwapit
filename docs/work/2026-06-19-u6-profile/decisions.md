# U6 — Profile tab · decisions log

## Classification
**Standard** — new screen + additive route promotion; no auth/payment/schema/route-removal.
Workflow: plan → dev → validate → ship → review → premerge.

## Pre-committed decisions (from /plan orientation)
1. **Additive**: build `/app/profile` (gold §9) and promote it; `/app/me` **stays** as the
   account / phone-verification step (the phone gate routes to `/app/me?next=…`). No route removal.
2. **"Sales" → "Orders"** in the Selling hub (→ `/app/sell/orders`): the seller-orders surface is
   "Orders" throughout this product, and the acceptance scope-drift sweep forbids the word "Sales"
   across all routes (same call as U5's "View orders").
3. **Display-only affordances** for not-yet-built destinations (Saved, Notifications, Payouts,
   Compare Plus, Invite friends, Help, Protected-payment policy, Sign out, edit, channel toggles) —
   `<button type="button">`, so route-coverage stays green without inventing routes. Real `<a>` only
   to existing routes (My Requests→/app/requests, Purchases→/app/tickets, My Listings/Orders/List a
   ticket→/app/sell[/orders]).
4. **Reuse `requestQuota`** (U3) for the quota recap; add a small tested `referralProgress` helper
   for the tier-card referral fill.
5. **Minimal new CSS**: only `.chan-row` + `.ghostlink` (`.profhead`/`.tier-card`/`.metal`/`.quota`/
   `.tiles`/`.divider`/`.btn-gold` already exist). Gold entrance added for `/app/profile`.
6. Out of scope: Plans (§10), real editing/sign-out/channel persistence, policy pages, real referral
   /tier logic. Telegram/WhatsApp channels are "Soon" (compliance note).

## Decisions (filled during /dev)
_(none yet)_
