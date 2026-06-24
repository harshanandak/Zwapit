# Decision: free / $0-subscription data stack for v1

**Date:** 2026-06-20 · **Decides:** which sources from `research.md` we actually use now.
**Constraint (user):** no paid subscriptions right now — free alternatives only.

The research's Phase 1 is already the near-$0 path; this pins it and explicitly drops
every paid option until there's budget/revenue.

## v1 stack — all $0/month

| Domain | Free source we use now | Cost |
|---|---|---|
| Movie metadata + posters | **TMDB API v3** free dev tier (server-side in Convex) + keyless CDN posters (`image.tmdb.org/t/p/w342/…`). Free fallback if TMDB's commercial license is ever a blocker: **Wikidata/Wikimedia** (CC0 data) + **OMDb** (free 1k/day). | $0 |
| Live events | **Curated/manual `catalog_events`** (re-keyed facts; permissioned/own art). | $0 |
| Bus routes | **Curated/manual `catalog_routes`** (manual or open-GTFS). | $0 |
| Scheduled showtimes (per-venue) | **None in v1** — every option is paid. Catalogue/release context comes from TMDB + curated. | $0 |
| "Tickets are live" | **Watcher-triggered rendered check** (Phase 2) — infra only, no API/subscription. | $0 software |
| Booking handoff | **Public deep-link OUT** to BMS/District. Not a data source. | $0 |
| Maps route-picker | **Google Maps native SDK** (India native rendering = unlimited free) — only if/when a map picker is actually needed; otherwise defer. | $0 at our scale |

## Explicitly dropped for now (revisit only with budget/revenue)
- **MovieGlu / Gruvi** scheduled-showtimes aggregators (Gruvi €149–€299 per market/month).
- **SerpApi** paid tiers, **PredictHQ** (enterprise/quote), **redBus Seat Seller / B2B**,
  **Mapbox paid** + any paid map services.
- Per-venue scheduled showtimes is a *paid upgrade*, not a v1 feature.

## TMDB commercial-license caveat (not a current cost)
TMDB is free for dev now. A **commercial** license (resale marketplace) is quote-based and
unverified — but that's a **pre-public-launch legal item**, not a subscription to buy today.
If the eventual quote is unacceptable, the free fallback (Wikidata CC0 + OMDb) keeps v1 at
$0. So: build against TMDB on the free tier; start the license conversation before public
launch; do not pay anything now.

## How this lines up with what's already shipped
- **PR #28 already seeds a curated `catalog_items` table** (Oppenheimer movie, Alan Walker
  event, Bengaluru→Goa route). That curated seed **is** the free events/bus path today, and a
  **manual stand-in for movies** until TMDB is wired — so the free decision is already
  partially live at $0.
- Community resale (where Zwapit transacts) is unaffected by any of this.

## v1 next step (when ready, its own slice)
The only free *API* worth adding is **TMDB** for richer movie metadata + posters
(server-side in Convex, keyless CDN thumbnails), replacing the manual movie rows. Events and
bus stay curated. Everything else above is deferred. Net new monthly cost: **$0**.
