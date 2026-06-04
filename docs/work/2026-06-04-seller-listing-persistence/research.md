# Persisted Upload-First Seller Listing Submission Research

Date: 2026-06-04
Issue: zwapit-noq
Branch: feat/seller-listing-persistence

## Verified Baseline

- Build order places upload-first seller flow before source-rule expansion, listing marketplace expansion, buyer checkout expansion, order timeline expansion, payments, admin, demand discovery, and category expansion. Verified in `AGENTS.md:62`.
- Zwapit uses Astro, React, Tailwind, Capacitor, and Convex for v1. Verified in `AGENTS.md:50`.
- Current seller upload is navigation-only and explicitly mock-only. `src/pages/app/sell/upload.astro:30` links to `/app/sell/confirm`; `src/pages/app/sell/upload.astro:38` says real file reading is later.
- Current seller confirm reads the fixture, not persisted draft data. `src/pages/app/sell/confirm.astro:5` imports `createMockFixture`; `src/pages/app/sell/confirm.astro:7` derives `listing` from that fixture.
- Current seller promise is the effective publish point, but it still links to seller orders and labels publish as instant mock flow. Verified in `src/pages/app/sell/promise.astro:52` and `src/pages/app/sell/promise.astro:60`.
- Phone-gated seller submission logic exists at the validation/client gate level. Verified in `src/lib/validation/sellerValidation.ts:41` and `src/pages/app/sell/promise.astro:72`.
- Convex listing reads exist for Home, detail, and checkout. Verified in `convex/listings.ts:15`, `convex/listings.ts:26`, and `convex/listings.ts:46`.
- Convex does not yet expose a seller-created listing mutation in `convex/listings.ts`; that file currently contains read queries only through `convex/listings.ts:75`.
- The existing `listings` table already stores the fields needed for a persisted first listing: seller id, source rule id/version, category/source, price summary, transfer deadlines, state, rule decision, and duplicate fingerprint. Verified in `convex/schema.ts:201`.
- Client Convex access already uses a fallback adapter pattern: when Convex is not configured, the app returns local mock flow data. Verified in `src/lib/convex/dataAdapter.ts:1`.
- Client function references are intentionally name-built rather than importing generated Convex API. Verified in `src/lib/convex/functionRefs.ts:1`.
- Auth identity boundary exposes `requirePhoneVerifiedAppUser`, which returns the current internal app user id and blocks signed-out or unverified users. Verified in `convex/identity.ts:131`.

## Current Gap

The product now gates seller progression, but there is no persisted seller listing submission. The next slice should make the upload-first seller path create a Convex-backed listing owned by the current internal app user id, while preserving the current mock/demo path when Convex or Clerk is not configured.

## Planning Implications

- This is a Standard Forge feature: normal feature work, no payment provider, no new platform architecture, and no migration that requires destructive data handling.
- Codex should implement backend/state correctness first because the slice crosses Convex mutations, auth identity, source-rule validation, and tests.
- Claude should implement UI wiring after the backend contract is stable, because Claude owns mobile-first UI, wording, component structure, and frontend connection to Convex after schema exists.
- Shared files must be serial: `src/lib/types.ts`, `src/lib/convex/functionRefs.ts`, `src/lib/convex/dataAdapter.ts`, and any schema-related frontend types.

## Open Technical Questions Resolved For This Plan

- Real file upload and OCR remain out of scope. The upload step may keep a mock file signal and pass structured mock metadata forward.
- Listing creation should not use provider ids. The mutation must derive seller id from `requirePhoneVerifiedAppUser`.
- Seller payout setup remains mocked. A persisted listing may use the existing mock seller payment readiness contract, but this slice must not add real payout setup.
- Rule evaluation should reuse the existing source-rule and validation contracts before any marketplace/category expansion.
