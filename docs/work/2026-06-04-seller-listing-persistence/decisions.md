# Decisions

## D1 - Next Slice Selection

Decision: Plan persisted upload-first seller listing submission as the next PR.

Reason: Verified build order places upload-first seller flow at step 6, and current seller routes still end in mock/static flow while Convex listing APIs are read-only.

## D2 - Backend Contract Before UI Wiring

Decision: Codex owns backend submission contract first; Claude owns seller UI wiring after Codex handoff.

Reason: The slice touches auth-derived ownership, listing state, rule validation, and Convex mutation safety before UI can safely connect.

## D3 - Mock Upload Payload Only

Decision: Keep upload as a mock signal and structured first-slice payload; do not add real file reading, storage, OCR, or AI parsing.

Reason: Real upload/OCR is explicitly outside current v1 scope and not needed to prove persisted listing submission.

## D4 - Internal App User Id Ownership

Decision: `listings.sellerId` must be derived from the current app user id returned by the identity boundary.

Reason: Provider ids must remain separate in `auth_identities`; app data owner ids must not use Clerk/provider ids.
