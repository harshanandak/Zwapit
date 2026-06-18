# U2 — Search · /dev decisions log

Decision-gate entries fire when the implementation hits a spec gap. None fired during
implementation (the v5 frame + U1 precedent left no ambiguity).

## /dev exit-review outcomes (2026-06-17)

Adversarial 5-lens review of the U2 diff: 9 raw → 6 confirmed (2 minor, 4 nit), 0
blockers/majors. Resolutions:

- **Results count on empty community (correctness):** the "Results · N found" count reflects
  ALL displayed results (the display-only official sample + wired community), matching the v5
  frame ("Results · 1 found" above an empty resale section). design.md's edge case was
  corrected — an empty community reads "1 found", not "No matches yet". Code unchanged
  (already v5-faithful); the live mock renders "2 found".
- **Empty-branch coverage + "Create a request" needle (harness/spec):** the
  `community.length === 0` empty state is latent this slice — the mock fixture is always
  `live`, so the page never renders "Nothing on resale yet"/"Create a request". Asserting
  those at the page level would fail the build, so they are intentionally NOT in the
  /app/search mustContain. The empty-state grammar is covered by the `resultsLabel(0)` unit
  test, and the markup mirrors the already-shipped U1 Home/Listings empty pattern. Recorded
  as an intentional divergence from tasks.md's documented needle set.
- **Empty CTA accent border (fidelity):** added `.app-shell .empty .btn-ghost` accent border
  tint in global.css so the ghost CTA matches the v5 "ghost steel button" on Search (and
  Home/Listings on their own accents) — fixed without a per-page inline style.
- **Wired-result assertion hardening (harness):** added "Arijit Singh Live - Silver Pass" +
  "2 found" to the /app/search mustContain (acceptance + buyer smoke) so the wired data path
  is pinned, not just "Seller price".
- **resultsLabel doc-comment (harness):** clarified that the v5 frame shows "1 found" while
  the wired page renders "2 found".
- **Community rowcard duplication (quality, deferred):** the `.rowcard` community-result
  block is duplicated across home/listings/search (a pre-existing U1 convention). Extracting
  a shared `ResaleRowCard.astro` is out of U2's "mirror U1 exactly" scope — tracked as a
  follow-up refactor across all three consumers.
