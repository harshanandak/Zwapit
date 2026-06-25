<!-- Source: background workflow wf_207f7791-a84 — research + adversarial verification + synthesis ALL complete (final pass run wdojyoan0, 2026-06-20). Corrected verdicts from the verification pass are used (ORS downgraded to conditional fallback; Geoapify downgraded to flagged fallback; LocationIQ sole geocode primary). This file supersedes the earlier hand-synthesized draft. Research + recommendation only, not an implementation. Companion to research.md. -->

# Zwapit FREE-ONLY Stack Addendum (Maps, Catalog & Geo)

**For:** Product owner — zero paid subscriptions right now.
**Hard bar:** "Free" = (a) no recurring subscription fee **and** (b) free tier/license **permits commercial use by a for-profit marketplace**. Card-required, self-host-required, rate-limited, share-alike, and mandatory-attribution options are *acceptable but flagged*.
**Date of verification:** June 2026. Sourced from the research + adversarial verification pass; where a corrected verdict overrode the original finding, the corrected verdict is used.

---

## 1. TL;DR free-only stack

| Domain | Free pick | Free-tier limit | Commercial use? | Catch (card / self-host / rate / attribution) | Confidence |
|---|---|---|---|---|---|
| **Movie metadata** | TMDB (already decided) | Not re-scoped in this pass | **UNVERIFIED here** | TMDB terms not re-checked in this free pass — see `research.md` §3.1/§5 (commercial license = quote-based/unverified; attribution mandatory). Confirm before relying | Low (terms unverified) |
| **Movie posters** | TMDB images (already decided) | Keyless CDN | **UNVERIFIED here** | Same TMDB gap; `research.md` §5 covers poster/image rights. Confirm redistribution rights | Low (terms unverified) |
| **Theatres / venues** | OpenStreetMap `amenity=cinema` (Geofabrik India extract) + Wikidata enrichment | Geofabrik bulk = unlimited; Overpass public ≈10k req/day fair-use | **Yes** (ODbL §3.1 "explicitly include commercial use") | No card. Attribution "© OpenStreetMap contributors". **Self-host Overpass** or use bulk extract for production. Share-alike only on a redistributed derived DB | High |
| **Showtimes (scheduled)** | **None free + legal** → curated / manually seeded | n/a | n/a | No free, legal, commercial-OK India showtime feed exists. Must be curated + watcher-driven | High (gap confirmed) |
| **"Tickets are live"** | Watcher-triggered rendered check (already decided) | n/a — internal | n/a | Not a third-party source; operational cost is watcher freshness/accuracy | High |
| **Events** | Wikidata (CC0) primary + data.gov.in (GODL-India) | Wikidata SPARQL 60s timeout / ~5 parallel; dumps unlimited | **Yes** (Wikidata CC0); **Yes, conditional** (GODL commercial OK) | No card. Wikidata = zero obligations. GODL = **mandatory attribution** (provider+source+license+DOI/URL); check each dataset's license tag. Curated baseline still primary | High |
| **Bus routes** | OSM/Geofabrik (boarding points) + **Delhi OTD static GTFS** (Delhi pilot) + Mobility Database to enumerate city GTFS | Geofabrik unlimited; OTD static = file download | **Yes** (OSM ODbL); **Yes, conditional** (OTD reproduce-free + attribution) | No card. **Intercity / state-RTC bus = NO free feed → curated.** OSM attribution + share-alike; OTD mandatory source attribution; per-feed license check for Mobility DB feeds | High (city) / Honest gap (intercity) |
| **Map render** | MapLibre GL JS (renderer) + OpenFreeMap (tiles) | OpenFreeMap: **no view/request cap**, no key, no account | **Yes** (BSD-3 renderer; MIT/BSD/CC-BY/ODbL tile stack — no NC clause anywhere) | No card, no self-host for public instance. **Mandatory attribution** ("OpenFreeMap © OpenMapTiles · Data from OpenStreetMap", auto-rendered). **No SLA / single maintainer** — keep PMTiles self-host escape hatch | High |
| **Geocode / autocomplete** | **LocationIQ Free** (sole clean primary) | 5,000 req/day **AND** 2 req/s **AND** 60 req/min | **Yes, conditional** | No card. **Mandatory visible backlink** `Search by LocationIQ.com`. **Secret key → proxy via Convex.** Debounce keystrokes (per-minute cap is the real limit). Free cache 48h but store-resolved-coords-forever allowed | High |
| **Routing / directions** | ORS hosted (launch) → **self-host OSRM/Valhalla** (scale) | ORS ~2,000 directions/day, 40/min | ORS **conditional** (no written grant); OSRM **yes** (BSD-2), Valhalla **yes** (MIT) | ORS: no card, but hard 2k/day + no commercial grant → email HeiGIT before scaling. OSRM/Valhalla: **self-host required**, you run the server | Medium (ORS) / High (self-host) |

---

## 2. Recommended FREE maps route-picker stack (India, Capacitor)

**The single best zero-subscription, commercial-OK, no-card combination:**

```
Renderer:  MapLibre GL JS            (BSD-3, npm dep, no key, no card)
Tiles:     OpenFreeMap public        (OSM vector tiles, no cap, no key, no card)
Geocode:   LocationIQ Free           (autocomplete API, 5k/day, key proxied via Convex)
Routing:   Openrouteservice hosted   (~2k directions/day) — launch only
           → self-host OSRM/Valhalla (when quota or commercial certainty matters)
```

This is the **only fully no-card, commercial-use-permitted hosted combination.** MapLibre + OpenFreeMap is genuinely zero-config and uncapped; LocationIQ gives a dedicated type-ahead with a concrete, self-serviceable commercial grant (one backlink). Routing is the soft spot: there is **no clean no-card hosted "recommend"** — ORS is a *conditional fallback within 2k/day*, and the unambiguous commercial path is self-hosting OSRM (BSD-2) or Valhalla (MIT) on an India OSM extract via Docker.

**Self-host effort (only if/when you outgrow free hosted tiers):**
- *Routing (OSRM/Valhalla):* Docker container + periodic Geofabrik India `.osm.pbf` rebuild. Moderate one-time setup; ongoing = a small VM + monthly extract refresh.
- *Tiles fallback (PMTiles on R2/S3):* single static file + HTTP Range host + `pmtiles://` protocol in MapLibre. Style/URL swap, not a rewrite — same MapLibre renderer.
- *Geocode fallback (Photon, Apache-2.0):* purpose-built autocomplete, unlimited, commercial-OK self-hosted. Heavier (Elasticsearch-backed) than a single tile file.

**Trade-off vs Google Maps (card-on-file but ₹0):**
Google Maps Platform **passes** the "no subscription + commercial use OK" bar and the **native Maps SDK (India) SKU is genuinely unlimited / $0 forever** for in-app map display. But it **fails the "no card anywhere" bar**: every Maps key requires a Google Cloud **billing account with a payment method**, even at $0 spend. Data APIs (geocoding, autocomplete, routes, web Dynamic Maps) are free only **under 70,000 calls/SKU/month in India**, then billed per-1,000 with **no automatic hard stop** unless you manually set daily quota caps.
→ If the founder's bar is "no recurring subscription," Google is viable (set per-SKU daily caps day one). If the bar is **"no credit card anywhere,"** the OSM stack above is the no-card answer and Google is out.

---

## 3. What "free" costs you (the honest catches)

1. **Rate limits are per-second/per-minute, not daily.** LocationIQ's binding ceiling is **60 req/min**, not 5,000/day — one user typing "Pune" fires ~4 calls. **Debounce (~300ms pause, min 3 chars) is mandatory, not optional.** ORS routing is a hard **2,000/day**.
2. **Self-host = free software, you run the box.** OSRM/Valhalla/Photon/Overpass have no license or quota cost, but you pay server ops + India-OSM-extract maintenance. The public Overpass endpoint (~10k/day fair-use) explicitly forbids being an app backend — production must self-host or use the Geofabrik bulk extract.
3. **ODbL share-alike is narrower than it sounds.** It binds only a **publicly redistributed derived database** — your rendered map and your in-app catalog (used internally) are exempt "produced works." Keep OSM data as a separate/collective layer beside your proprietary tables and you never have to ODbL-publish your catalog. **Attribution is the always-on obligation**, not share-alike.
4. **Attribution surfaces you owe (plan UI space):** OSM "© OpenStreetMap contributors"; OpenFreeMap/OpenMapTiles credit; LocationIQ backlink (`Search by LocationIQ.com`); GODL-India provider+source+license+DOI for any government dataset. MapLibre auto-renders the map ones — **do not strip them for a cleaner UI.**
5. **Secret keys must be Convex-proxied.** LocationIQ and ORS use secret keys — never ship them in the Capacitor client; route the call through Convex.
6. **India coverage gap vs paid.** All viable free options are OSM-backed: strong for cities, named roads, metros, highways and intercity route lines; **patchy on rural last-mile and house-number-level addressing.** Adequate for a bus from/to picker and city pins, *not* precise local addressing. Spot-test real Indian city/locality names before committing — no India-specific accuracy data was found for any provider.
7. **OpenFreeMap has no SLA** (single maintainer, donation-funded, explicit "as-is"). Mitigation: it publishes weekly full-planet downloads, so the PMTiles/VersaTiles self-host fallback is a config swap, not a rewrite — keep it documented as an escape hatch.

---

## 4. Maps → `catalog_*` + adapter

**Filling the canonical tables:**

- **`catalog_movies`** — TMDB (metadata + posters; *terms unverified in this pass — see `research.md` §3.1/§5*). Free geo sources carry no movie titles.
- **`catalog_venues`** — Seed from **OSM `amenity=cinema`** (name, address tags, lat/lon) via Geofabrik India extract; enrich chain/brand with **Wikidata (CC0, no attribution)**. Merge + dedupe into your *curated* `venues` table — treat OSM as a seed, not an authority. Geocode user-entered venues via **LocationIQ** (proxied), storing resolved coords (LocationIQ permits storing resolved data forever even on Free).
- **`catalog_events`** — **Curated/manual baseline** (no free dated inventory feed exists). Seed *existence* from **Wikidata (CC0)** for major/recurring Indian festivals + **data.gov.in GODL** fairs/festivals lists (with attribution). Govt tourism calendars (Utsav/state boards) = human curation reference only (no API, no-scraping).
- **`catalog_routes`** — **Boarding points** from OSM `highway=bus_stop` / `amenity=bus_station`; **Delhi region** from Delhi OTD static GTFS; use Mobility Database to enumerate which city GTFS feeds exist (per-feed license check). **Intercity/state-RTC = curated** (no free feed). Route geometry/distance/time for the picker via ORS hosted (launch) or self-host OSRM/Valhalla (scale).

**Adapter contract `{ isLive, bookingUrl, showtimes?, priceRange?, snapshotHash }`:**

- `isLive` — comes from the **watcher-triggered rendered check** (already decided), *not* any geo/free source. None of the free picks supply liveness.
- `bookingUrl` — deep-link OUT to the official platform; constructed from curated catalog + watcher result, not from a geo provider.
- `showtimes?` — **curated/seeded only.** No free, legal, commercial-OK India showtime API exists (Google Showtimes discontinued; BMS/District have no API; International Showtimes / MovieGlu / SerpApi / Boxoffice are paid/trial). Leave optional and fill from curation + watcher.
- `priceRange?` — from the watcher's rendered check or curated data; no free source provides this.
- `snapshotHash` — internal hash of the rendered watcher snapshot; unrelated to the free geo stack.

> Net: free geo sources fill **venue/route geography and event existence**. They do **not** fill liveness, showtimes, or price — those stay watcher-driven and curated.

---

## 5. Free phased plan ($0, no card where possible)

1. **Phase 0 — map + picker, zero card.** Wire **MapLibre GL JS + OpenFreeMap** tiles into the Capacitor shell. No key, no account, no card, no cap. Add the attribution control (auto-rendered).
2. **Phase 1 — geocode/autocomplete.** Add **LocationIQ Free** behind a **Convex proxy**; debounce keystrokes (min 3 chars, ~300ms). Add the mandatory backlink. Still no card.
3. **Phase 2 — routing.** Add **ORS hosted** behind a thin adapter for the from→to route line, within ~2k/day. No card. Email HeiGIT to confirm/raise the commercial quota before any real volume.
4. **Phase 3 — catalog seeding (one-time, no card).** Bulk-download **Geofabrik India extract** → seed `catalog_venues` (cinemas, bus stops) and `catalog_routes` (boarding points). Pull **Wikidata (CC0)** + **data.gov.in GODL** for `catalog_events` existence. Add **Delhi OTD static GTFS** for a Delhi bus pilot.
5. **Phase 4 — de-risk hosted dependencies.** Stand up the **PMTiles-on-R2/S3** tile fallback and **self-hosted OSRM/Valhalla** + **self-hosted Overpass/Photon** *only when* free hosted tiers are outgrown or commercial certainty is required. This is the point where "free" starts costing server effort.

> Everything in Phases 0–3 is achievable **with no credit card and no self-hosting.** Only Phase 4 introduces server ops.

---

## 6. Open questions to verify before build

- **[UNVERIFIED] TMDB free-tier commercial-use + poster/image redistribution terms** — not re-checked in this free pass; `research.md` §3.1/§5 flags the commercial license as quote-based and attribution as mandatory. Confirm directly before depending on TMDB for `catalog_movies` and posters.
- **[UNVERIFIED] Geoapify production commercial ceiling** — T&C permits commercial production "with some limitations… contact us." If you ever use Geoapify as a geocode fallback, get the production cap in writing first (this is why it is a flagged fallback, not a co-primary).
- **[UNVERIFIED] ORS commercial grant + no-card claim + exact daily quota** — no written commercial grant exists (absence of prohibition only); the "no credit card" claim is plausible but not confirmed from a primary page; daily quota is 2,000/day per official docs (older 2,500/day figures are stale). Email enquiry@openrouteservice.org before scaling.
- **[UNVERIFIED] Per-provider geocode-results storage clauses** — LocationIQ explicitly allows storing resolved coords forever; the equivalent clause for any other provider is **not** verified. Confirm before persisting geocoded coordinates into permanent `catalog_*` tables.
- **[UNVERIFIED] India geocode accuracy** — no India-specific accuracy data found for any OSM-backed provider. Spot-test real Indian city/locality names before committing.
- **[UNVERIFIED] data.gov.in per-dataset license tags** — some records may be ODbL (adds share-alike) or third-party copyright, not GODL. Check each dataset's `license` metadata field before use.
- **[Verify in dashboard] ORS live daily quota** and **LocationIQ/Geoapify burst behaviour** under concurrent launch-scale typing.

---

## Avoid — not actually free for us (free tier forbids commercial use)

These are disqualified specifically because their **free tier prohibits commercial use by a for-profit marketplace** — not because of coverage:

- **MapTiler Cloud (tiles + geocoding)** — Free plan is **non-commercial only**; commercial needs paid Flex ($25/mo+).
- **Stadia Maps (tiles + geocoding)** — Free tier is **dev/eval/non-commercial only**; Stadia defines any for-profit org as commercial → captures Zwapit directly.
- **CARTO basemaps (Positron/Voyager/Dark Matter)** — Free for **non-commercial / grantees only**; commercial basemap service starts ~$6,000/yr.
- **Public Nominatim** (`nominatim.openstreetmap.org`) — **autocomplete explicitly forbidden** AND geocoding-primary apps must self-host. (Self-hosting Nominatim is allowed but poor at autocomplete — use Photon.)
- **GraphHopper hosted free plan** — **non-commercial only** (the self-hosted Apache-2.0 engine is fine, like OSRM/Valhalla).
- **Showtime vendors** — International Showtimes (~€149/mo/market), MovieGlu (quote-only), SerpApi, Boxoffice — all **paid or trial-only**, no free commercial tier.

> **Not on this list: Google Maps.** It *passes* "no subscription + commercial OK," but requires a **billing account + card on file** (bills ₹0 for the native India Maps SDK, real charges above 70k/SKU/month on data APIs). Treated as the "card-on-file but ₹0" trade-off in §2, not as disqualified.
