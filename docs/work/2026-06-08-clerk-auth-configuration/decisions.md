# Clerk Auth Configuration Decisions

## Decision 1

**Date**: 2026-06-08
**Task**: Task 2 - Add Environment-Gated Convex Auth Config
**Gap**: The design expected `convex/auth.config.ts` could read `CLERK_JWT_ISSUER_DOMAIN` and still let `bunx convex codegen` pass when that env was absent. Fresh codegen proved Convex requires the env as soon as the auth config reads it.
**Score**: 6/14
**Route**: PROCEED
**Choice made**: Use the official Convex auth config shape with `process.env.CLERK_JWT_ISSUER_DOMAIN`, keep a pure helper unit-tested for absent/present issuer behavior, and document the Convex issuer env as mandatory before `convex dev`, `convex codegen`, or deploy.
**Status**: RESOLVED
