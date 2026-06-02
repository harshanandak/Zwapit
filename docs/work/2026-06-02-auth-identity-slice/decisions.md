# Auth And Identity Slice Decisions

## Decision 1
**Date**: 2026-06-02
**Task**: Task 2 - Convex Identity Sync
**Gap**: The plan scoped Clerk behind the adapter but did not provide a Clerk issuer domain for Convex `auth.config.ts`. An active auth config referencing `CLERK_JWT_ISSUER_DOMAIN` makes `bunx convex codegen` fail against the existing dev deployment when the env var is unset.
**Score**: 3/14
**Route**: PROCEED
**Choice made**: Do not commit an active `convex/auth.config.ts` in this slice. Keep Clerk provider identity support in the adapter, schema, and `identity:*` Convex functions, and record the proof boundary in evidence. A later Clerk environment setup slice can add the auth config once the issuer domain exists.
**Status**: RESOLVED
