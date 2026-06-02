# Auth And Identity Slice Design

Issue: `zwapit-skf`

## Scope

Build the first auth and identity slice after Convex persistence:

- Clerk behind the existing auth adapter.
- Convex app user sync.
- Provider identity stored separately in `auth_identities`.
- Internal app user ids used everywhere in app data.
- Login gates for buy/sell actions.
- Phone verification requirement shape for later enforcement.

## Exclusions

Do not add Razorpay, real payments, payout setup, full KYC, admin expansion, demand discovery, category expansion, or UI flow redesign.

## Approach

Extend the existing adapter instead of introducing a parallel auth path:

- Keep `src/lib/auth/authAdapter.ts` as the frontend/server-facing contract.
- Add a Clerk-backed adapter path that normalizes provider identity into an internal app user id.
- Keep the current mock adapter path available for tests and local demo mode when Clerk is not configured.
- Add Convex functions that sync a provider subject to `users`, `auth_identities`, and `user_verifications`.
- Add role-specific identity guards for persisted order/listing mutations so actors are derived from authenticated app user id, not client-supplied ids.
- Add UI auth states only at buy/sell action boundaries, preserving existing navigation and copy.

## Alternatives Considered

### Direct Clerk Integration Without Adapter

- Rejected because UI, Convex identity mapping, and future provider replacement would all depend directly on Clerk-specific ids and runtime APIs.
- Chosen approach keeps Clerk behind `src/lib/auth/authAdapter.ts`, so app data continues to use internal app user ids.

### Inline Provider Identity In `users`

- Rejected because storing provider subjects directly on `users` would mix app user state with auth-provider state.
- Chosen approach keeps provider subjects in `auth_identities`, while `users`, `orders`, `listings`, and `user_verifications` reference internal app user ids.

### Client-Supplied Actor IDs

- Rejected because a browser client could claim a buyer or seller role for protected state transitions.
- Chosen approach resolves actors from Convex auth identity, maps that identity through `auth_identities`, and compares the mapped app user id to stored order ownership.

### Auth-First UI Flow

- Rejected for this slice because the accepted visible mock flow delays login until buy/sell actions.
- Chosen approach gates only buy/sell action CTAs and preserves existing navigation.

## OWASP Security Analysis

### A01:2021 - Broken Access Control

- Risk: provider subjects or client-supplied actor ids could be used to access another user's order.
- Mitigation: provider ids are stored only in `auth_identities`; protected Convex mutations derive the actor from authenticated identity and compare that app user id against stored order buyer/seller ids.

### A04:2021 - Insecure Design

- Risk: mixing demo identity with real auth could leave role-based mock mutations reachable in authenticated paths.
- Mitigation: mock mode remains explicit no-Clerk demo compatibility; Clerk-configured paths use current-user guarded mutations and explicit auth state gates.

### A07:2021 - Identification And Authentication Failures

- Risk: a user with an unverified phone claim could reach buy/sell actions if phone status is inferred from phone number presence.
- Mitigation: phone verification is represented through `user_verifications`; Convex sync treats only provider verified-phone claims as verified, and buy/sell gates require the phone-verification action state.

## Data Contract

Existing tables already provide the first contract:

- `users.appUserId`: internal app id.
- `auth_identities.appUserId`: internal app id foreign key.
- `auth_identities.provider`: provider name, initially `clerk`.
- `auth_identities.providerUserId`: Clerk subject/user id.
- `user_verifications.appUserId`: internal app id foreign key.
- `user_verifications.phoneVerified`: boolean requirement flag.
- `orders.buyerId`, `orders.sellerId`, `listings.sellerId`, and `audit_logs.actorId`: app ids only.

If implementation finds schema gaps, Codex owns the schema decision gate before Claude touches UI.

## Auth Boundary

Adapter result shape should represent:

- authenticated: signed-in user with internal `appUserId`
- signed out: no user, can render login gate
- phone verification required: signed-in user exists, but action requires phone verification shape
- mock demo: current `user_demo_1` behavior for non-Clerk local/test paths

Do not expose provider subject as an app user id.

## Convex Boundary

Codex must plan internal/server-owned identity mapping:

- Public client calls may ask "who am I?" and trigger sync.
- Sensitive state transitions must resolve actor from Convex auth/session identity and mapped app user id.
- Client input may include visible entity keys such as listing/order key, but not authoritative actor ids.
- Existing mock-visible mutations may remain only as explicit demo/test compatibility paths or be wrapped by guarded paths.

## UI Boundary

Claude may work only after Codex writes the backend contract handoff. Claude owns:

- signed-out buy action state
- signed-out sell action state
- signed-in loading/error states
- phone-verification-needed display shape

Claude must not add checkout/payment/payout/KYC/admin screens.

## Validation Contract

Codex validates before ship:

- type check
- Convex type check/codegen
- unit tests
- first visible slice acceptance guard
- buyer/seller smoke scripts
- auth identity tests
- scope drift search for excluded terms and forbidden integrations
