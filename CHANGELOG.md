# Changelog

## [Unreleased]

### Added
- First Convex persistence slice for the accepted mock-visible flow, including Convex schema/functions, seeded demo data, adapter-backed checkout/order timeline persistence, and browser reload validation (PR #5, zwapit-dk0).

### Changed
- Documented `PUBLIC_CONVEX_URL` as the browser Convex URL, with `VITE_CONVEX_URL` retained as a compatibility fallback (PR #5, zwapit-dk0).

### Fixed
- Pinned `ws` to `8.20.1` via package overrides to clear the dependency audit advisory from Convex/Wrangler transitive dependencies (PR #5, zwapit-dk0).
