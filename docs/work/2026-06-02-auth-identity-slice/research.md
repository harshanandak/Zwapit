# Auth And Identity Slice Research

Issue: `zwapit-skf`
Date: 2026-06-02
Stage: Forge `/plan`

## Objective

Plan the next Zwapit slice after merged Convex persistence and verified Convex dev deployment: introduce real auth shape through Clerk behind the existing auth adapter, sync authenticated users into Convex app users, keep provider identity separate in `auth_identities`, preserve internal app user ids in app data, and add login gates for buy/sell actions without changing the current UI flow.

## Source Rules Read

- `AGENTS.md` and `CLAUDE.md`: auth follows the sequence mock user -> Convex data flow -> phone auth -> seller payout setup -> payments.
- `AGENTS.md` and `CLAUDE.md`: Clerk is first for v1 auth speed, behind an adapter/wrapper.
- `AGENTS.md` and `CLAUDE.md`: provider ids must not become primary ids on orders, listings, or payments.
- `AGENTS.md` and `CLAUDE.md`: phone verification is required later for buy/sell actions, but full KYC is not in this slice.
- Current hard exclusions: Razorpay, real payments, payout setup, full KYC, admin expansion, demand discovery, and category expansion.

## Current Code Facts

- `src/lib/auth/authAdapter.ts:10` exposes `getCurrentUser()`.
- `src/lib/auth/authAdapter.ts:14` exposes `requireUser()`.
- `src/lib/auth/authAdapter.ts:18` exposes `requirePhoneVerified()`.
- `src/lib/auth/authAdapter.ts:28` exposes `syncUserToConvex()`.
- `src/lib/auth/mockAuth.ts:3` defines `mockCurrentUserId = "user_demo_1"`.
- `src/lib/auth/mockAuth.ts:12` keeps mock provider identity separate from app user id.
- `convex/schema.ts:121` defines `users`.
- `convex/schema.ts:129` defines `auth_identities`.
- `convex/schema.ts:137` defines `user_verifications`.
- `convex/schema.ts:241` defines orders with `buyerId` / `sellerId` indexes using app ids.
- `convex/orders.ts:1` says current order functions are public mock-visible flow functions.
- `convex/orders.ts:4` says there is currently no real auth.
- `convex/orders.ts:286` and `convex/orders.ts:296` guard visible buyer actions by actor role shape, not real identity.
- `src/pages/app/listings/[listingId].astro:83` links directly to checkout.

## External Docs Consulted

- Convex auth with Clerk: https://docs.convex.dev/auth/clerk
- Clerk Astro SDK overview: https://clerk.com/docs/reference/astro/overview
- Clerk React overview: https://clerk.com/docs/references/react/overview

Only planning assumptions were taken from these docs. Implementation must re-check exact package/API names during `/dev`.

## Risks

- Provider subject leakage: Clerk user ids must stay in `auth_identities.providerUserId`, not `orders.buyerId`, `listings.sellerId`, `audit_logs.actorId`, or public URLs.
- Mixed mock/real identity: adapter must support mock fallback only where explicitly allowed for local demo/test flows.
- Public mutation drift: buyer/seller mutations must derive actor app user id server-side from authenticated identity before state transitions.
- UI flow drift: auth gates must appear at buy/sell action boundaries without adding a new landing/auth-first flow.
- Phone verification overreach: this slice should store and expose requirement shape, not build SMS OTP/KYC.

## Test Scenarios

1. Signed-in Clerk identity sync creates or reuses one internal app user and one provider identity.
2. Repeated sync is idempotent by `(provider, providerUserId)`.
3. Buyer/seller mutations reject missing auth and reject actor mismatch.
4. Existing mock-visible flow remains usable when auth is not configured.
5. UI buy/sell actions route to auth gate when signed out and preserve the original target intent.
6. Phone verification requirement returns a structured `PHONE_VERIFICATION_REQUIRED` state without real OTP/KYC.

