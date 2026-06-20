# Convex Search read-model · decisions log

## Classification
Backend data + read-model. Done **solo + convex-reviewer** (Codex rate-limited until
2026-07-18; user: "don't wait for Codex, continue").

## Key decisions (incl. advisor flags)
1. **Full search (official + community)** over community-only — front-loads the foundational
   `catalog_items` infra that Requests needs. (Advisor confirmed; the specific catalog rows
   differ from Requests' eventual want-referenced rows, but the table + helper + pattern are
   the reusable asset.)
2. **`seedCatalogItems` called as a bare statement** (`await seedCatalogItems(ctx);`, no `if`)
   — adding `if (await …) created = true` would add a branch → handler back to 16 → re-trip
   S3776. `created` accuracy for catalog is moot (the adapter fires the mutation, ignores the
   return). (Advisor flag #1.)
3. **`loadOfficialCatalog` shape-guard** — fall back to the Oppenheimer mock on empty/throw
   AND when rows lack a string `title` (same footgun class as last slice's `id` guard). The
   mock fallback emits "Oppenheimer" so the CI mock-path needle stays green. (Advisor flag #2.)
4. **Needle change** — dropped the env-dependent `"2 found"` (Convex=8, mock=2); kept both
   halves asserted: Oppenheimer (official) + Arijit (community) + "Notify me" + "Seller price"
   in verify + smoke. (Advisor flag #3.)
5. **`getOfficialCatalog` read-only** — "Notify me" arming is internal-only/audited, not exposed.
6. **catalog.ts is a new module** (`catalog:getOfficialCatalog`) — cleaner than overloading
   listings.ts.
7. **Deploy to dev only** (`npx convex dev --once` → savory-cow-440); production untouched.
8. `.env.local` copied into the worktree (gitignored, never committed) to deploy/test.

## convex-reviewer outcome
Clean — no HIGH/MED. Confirmed: catalog seed idempotent + schema-matched + deterministic
timestamp + bare-call (no S3776 regrowth); `getOfficialCatalog` read-only with a stable
string `id`/`title`; `loadOfficialCatalog` fallback covers !client/empty/throw/shape-drift
and emits "Oppenheimer" for the CI mock path; demo listing untouched (2,400 / 2,411.80).
- LOW (declined): add a `returns` validator to `getOfficialCatalog` — the sibling read
  queries `getHomeListings`/`getCheckoutView` omit it, so this matches the codebase
  precedent; adding it only here would be inconsistent, and adding it everywhere is out of
  scope.
- LOW (noted, no change): `.collect()` is fine at curated-catalog scale (switch to
  `by_kind_active` if it grows); empty catalog → Oppenheimer mock is intended.

## CodeRabbit review (PR #28) — outcome
- **Sequential awaits → Promise.all** (search.astro): FIXED — the two independent reads now
  run in parallel.
- **Duplicated `OfficialCatalogItem`** (catalog.ts + dataAdapter.ts): kept duplicated +
  added cross-sync comments in both (CodeRabbit's sanctioned fallback). A shared type is
  "shared types" (needs approval per CLAUDE.md) and the convex↔src import is awkward.
- **Rename `catalogDocToMock`**: DECLINED — matches the established `listingDocToMock` /
  `sourceRuleDocToMock` convention; renaming only this one would be inconsistent.
- **Per-row title guard**: DECLINED — keeps consistency with the merged `loadCommunityListings`
  `docs[0]` guard; the catalog is curated/tiny so partial-row drift is a non-issue (changing
  both is out of scope).
