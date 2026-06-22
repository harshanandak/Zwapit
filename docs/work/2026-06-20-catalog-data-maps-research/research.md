<!-- Source: background workflow w0q6fy183 (19 agents), 2026-06-20. Research + recommendation only, not an implementation. -->

# Zwapit Data Sources — Research & Options (June 2026)

Picking concrete, current, ToS-safe data sources so a buyer/seller can pick a canonical movie/event/route (with a thumbnail) and so Zwapit can detect "tickets are live" — without the frontend ever calling BookMyShow/District and without scraping.

---

## 1. TL;DR — Recommended source per domain

| Domain | Chosen source | Monthly cost (2026) | ToS posture | Confidence |
|---|---|---|---|---|
| **Movie metadata + posters** | **TMDB API v3** (server-side in Convex; keyless CDN for poster images) | Free for dev; **commercial license = unverified** (quote-based, resale marketplace is commercial) | HIGH risk until commercial license signed; attribution mandatory | **High** (source) / Med (license cost) |
| **India showtimes (scheduled)** | **MovieGlu** *or* **International Showtimes/Gruvi** — only after a trial validates India depth | **Unverified** (MovieGlu quote-only; Gruvi **€149–€299 per market/month**) | LOW *as consumer of a licensed feed*; **Gruvi pushes IP-indemnity onto Zwapit** | **Low** (India coverage unproven) |
| **"Tickets are live" (booking-open state)** | **Watcher-triggered rendered check** (last resort) — no API exists | Infra only (headless browser/proxy) | **HIGH / ToS-gray** — robots blocks data endpoints; IP-block risk | **High** that nothing better exists |
| **Theatres / venues** | Rides along with the showtimes aggregator (`cinemaDetails` if MovieGlu validates); else **curated** | Bundled with showtimes feed, or free (manual) | LOW | **Low** (depends on aggregator) |
| **Live events (concerts/comedy/sports)** | **Curated/manual `catalog_events` seeding** (facts re-keyed); PredictHQ as optional discovery seed | Free (ops labor); PredictHQ enterprise/unverified | LOW (event facts not copyrightable; permissioned art only) | **High** |
| **Bus routes** | **Curated `catalog_routes` seeding** | Free (ops labor) | None, *if* manually authored / open-GTFS sourced | **High** |
| **Maps route-picker** | **Google Maps Platform** (native Maps SDK via `@capacitor/google-maps` + Routes + Places Autocomplete) | **Native Maps SDK India = unlimited free**; 70k/SKU free then $1.50–$2.10/1k | LOW (first-party licensed; no caching of payloads) | **High** |

Outbound booking link (every domain): **plain public deep-link** to `in.bookmyshow.com/buytickets/...` and `district.in/movies|events/...` — lawful, free, no program. This is a destination, not a data source.

---

## 2. The showtimes verdict (the central honest finding)

**Is there a legitimate, ToS-safe, India venue-level showtimes API in 2026? No — not for the part that matters.**

You must split one question into two, because they have opposite answers:

**(A) Scheduled showtimes** — "which theatre plays which movie at what time today." *Possibly* solvable via a licensed aggregator (MovieGlu, Gruvi), **but India coverage is unverified**. MovieGlu lists India as a selectable eval territory; Gruvi's only India evidence is a **2014 blog post**. Both crawl/license upstream data, so the BMS/District ToS risk sits with the vendor, not Zwapit — *if* their India depth and freshness survive a real trial against PVR/INOX multiplexes. Until that trial passes, treat (A) as unsolved.

**(B) "Tickets are live" (booking-open state)** — "booking just opened on BMS for this exact show." **No public API returns this for India.** Aggregators return *scheduled* showtimes, not the open/closed booking flag. Neither BookMyShow's affiliate program (marketing links only, "deep linking: No", zero data) nor District (no movie data feed at all) exposes availability. So (B) is genuinely unsolved by any vendor.

**Mapped to the adapter preference order:**

1. **Official partner/affiliate feed → does not exist** for BMS or District in 2026. Affiliate programs are CPS link-tracking, not data. A negotiated organiser/distributor feed is **avoid** for v1: it is a bespoke BD relationship that doesn't exist, and the natural counterparties are unlikely to onboard an early-stage resale-adjacent marketplace. [CORRECTION 2026-06-20 — the earlier claim here that "in Sept 2024 BookMyShow filed a police complaint and Zomato Live sent legal notices against resale platforms" is **contested/unverified**: primary checking found the Mumbai Coldplay complaint was filed *against BookMyShow* and was *closed by Mumbai Police*, and the Zomato-notices claim has no supporting source. Do not cite either as precedent. See `availability-watcher-crawlers.md` §2.]
2. **Documented public JSON endpoint → does not exist.** BMS robots.txt disallows `/getJSData/ /getHTML* /data/ /partners/`; the BMS terms page returns HTTP 403 to non-browser requests. District's robots.txt allows catalog sitemaps but blocks `/order /checkout /bookings /*?`; Zomato/Eternal ToS explicitly bars automated access/crawling.
3. **Watcher-triggered rendered check → the only thing that actually yields per-venue availability for India — and it is the unsanctioned, last-resort path.** Use it only: low request rate, robots-respecting, no auth/captcha bypass, no personal data, triggered by a real user request, and ripped out the instant any authorized feed appears. The most popular public BMS notifier was shut down by an IP block — this is fragile and adversarial.

**Bottom line:** a showtimes-aggregator integration can populate the *catalogue* and *scheduled times* (pending trial validation), but it does **not** solve "tickets are live." Do not let it create that illusion. Availability detection falls entirely to the watcher path, and `bookingUrl` is always a deep-link OUT — never a data feed.

---

## 3. Per-domain detail

### 3.1 Movie metadata + posters

| Candidate | Discriminator (real India showtimes within ToS?) | Pricing | ToS | Verdict |
|---|---|---|---|---|
| **TMDB API v3** | N/A — metadata/poster only (by design, not a failure) | Free non-commercial; **commercial = unverified quote** | HIGH until licensed; mandatory attribution | **Investigate → use as v1 source** |
| Wikidata + Wikimedia Commons | N/A — metadata only | Free, no key | Data CC0; **images per-file licensed** | Fallback (ID bridge + poster fallback) |
| OMDb | N/A | Free 1k/day; patron for poster API | Medium; weak India coverage | Fallback (emergency only) |
| JustWatch | N/A — *streaming* availability, wrong layer | Negotiated, no self-serve | HIGH friction, partner-only | Avoid |

**Recommendation:** Build the adapter against **TMDB** now. Use `region=IN` for theatrical release context and `/discover?with_original_language=hi|ta|te|kn|ml` for regional canonical items. The `now_playing`/`search` list gives id + `poster_path`; a **second call** `/movie/{id}?append_to_response=release_dates` fills runtime, `spoken_languages`, and the IN certification (`release_dates[].iso_3166_1=='IN'`). Render thumbnails **directly from the keyless CDN** `image.tmdb.org/t/p/w342/{poster_path}` in the Capacitor client — no proxy. Keep the API key **server-side in Convex** (verified 401 without key). Cache TMDB→IMDb/Wikidata ids on each `catalog_movies` row, with Wikidata (CC0) as a license-clean fallback while the TMDB commercial license is pending.

**Open caveats:** `region=IN` reflects release-date region, **not** country of origin — pair with `with_original_language`. No SLA (cache in Convex). Live `now_playing?region=IN` quality is **unverified** (no key in this research) — smoke-test before committing. **Commercial license is a launch blocker**: email TMDB `api-for-business` (include "India") early; do not rely on stale "ads are fine" blogs.

### 3.2 India showtimes (scheduled)

| Candidate | Discriminator | Pricing | ToS | Verdict (corrected) |
|---|---|---|---|---|
| **MovieGlu** | API shape passes (per-venue `cinemaShowTimes`); **India data UNVERIFIED** | Quote-only; eval = **75 reqs, 1 country** | LOW as consumer | recommend → **investigate** |
| **International Showtimes/Gruvi** | Shape passes; **India evidence is a 2014 blog** | **€149–€299 per market / month**; 7-day trial | **AS-IS, disclaims all warranties; indemnity pushed to Zwapit** | recommend → **investigate** |
| SerpApi (Google Showtimes) | Schema is theatre-level; **India fill-rate unverified, historically patchy** | **Free 250/mo; $25/$75/$150/$275 mo tiers** (verified) | MEDIUM — paying to scrape Google; "Legal Shield" is US-only | Fallback (spot-checks) |
| Gracenote/TMS | No India product (US/CA only) | Free dev tier (US/CA) | Moot | Avoid |
| BMS/District direct or unofficial | Full data but only via reverse-engineered endpoints | N/A | HIGH (ruled out) | Avoid |
| RapidAPI/scraper vendors | Scraped from BMS/District | Varies/unverified | HIGH (prohibited path) | Avoid |

**Verification corrections folded in:** Both recommended aggregators were **downgraded to investigate**. MovieGlu's per-venue shape is real (`cinema_id`, `version_type`, `times[]`, IMDB ids) but **returns NO booking/deep-link URL** — Zwapit's deep-link-OUT still needs its own URL — and India depth is unproven (its own copy says "125 / 90 / 60 countries" inconsistently). Gruvi's findings claim of "LOW risk / rep+warranty" is **contradicted by its actual ToS** (AS-IS, indemnification pushes crawl-provenance IP risk *toward* Zwapit), and the recurring **per-market** cost was omitted in the original finding.

**Recommendation:** Pull **both** trial keys (MovieGlu 1-country India eval; Gruvi 7-day) and validate India theatre depth + freshness against real Mumbai/Bengaluru multiplexes **before any commitment**. Match on TMDB id (Gruvi native; MovieGlu needs a mapping layer). Treat coverage as vendor-claimed until proven. Aggregator feeds refresh "several times a day" — fine for catalogue, **too slow** for last-minute alerts.

### 3.3 Theatres / venues

No dedicated public India venue API exists independently. Venue records come bundled with the showtimes aggregator (MovieGlu `cinemaDetails` → name/address; Gruvi cinema objects) **if** that aggregator's India coverage validates. If it does not, **curate venues manually** alongside `catalog_venues`. Do not invent a standalone venue source.

### 3.4 Live events

| Candidate | Discriminator | Pricing | ToS | Verdict (corrected) |
|---|---|---|---|---|
| **Curated `catalog_events` seeding** | Passes (re-keyed event facts; venue+date+showtime) | Free (ops labor) | LOW; **art = permissioned only** | **recommend** |
| PredictHQ | Discovery only — **no ticketing field, no thumbnail** | Enterprise/quote; no usable free tier | Low (in-app display + attribution; **AI-training clause**) | investigate → **fallback** (seed only) |
| BookMyShow events | No ToS-safe data read path; scraping = HIGH | Affiliate free (₹4.50–₹10/sale) | HIGH for data; LOW as outbound link | investigate → **fallback** (destination + affiliate) |
| Paytm Insider | Real data, **no public/affiliate read API**; reverse-engineered = HIGH | None public | HIGH | investigate → **avoid** |
| District by Zomato | Real data, **no developer events API**; ToS bars crawling | None public | HIGH (ToS, not just robots) | investigate (only as BD target) |
| Ticketmaster / Eventbrite / SeatGeek / Skiddle | **No India inventory** (or own-org only) | Various | Moot | Avoid |

**Verification corrections folded in:** Paytm Insider → **avoid** (business absorbed into Zomato/District Aug 2024; only "API" hits are reverse-engineered Postman collections). District event affiliate/feed → **none found**; the only Zomato affiliate is food/dining CPA. PredictHQ → **fallback**: its schema has **no ticketing status, no booking URL, and no image/poster field**, plus an AI-training restriction relevant to a matching-heavy product — it seeds *event existence*, nothing more. BMS events → **fallback** as outbound destination + ₹10 CPA channel, never a data source.

**Recommendation:** v1 baseline = **curated/manual `catalog_events`** (canonical name/venue/city/date/showtime/format, source-tagged). Event *facts* are not copyrightable, so re-keying announced listings is low-risk and works precisely because concerts/comedy/sports are discrete, announced-in-advance, low-volume (this approach would *fail* for movies — thousands of theatres × daily showtimes). Posters/art are copyrighted: use **permissioned promoter press-kit assets or manual upload**, never pulled off booking pages "under affiliate terms." Optionally seed discovery from PredictHQ (real India venue+date coverage — Bengaluru ~166, Mumbai ~187 events/90 days). Availability + booking still flows through the deep-link-OUT + watcher path.

### 3.5 Bus routes

| Candidate | Discriminator | Pricing | ToS | Verdict (corrected) |
|---|---|---|---|---|
| **Curated `catalog_routes` seeding** | Passes (route/operator/boarding rows; static) | Free (ops labor) | None — **if manual or open-GTFS sourced** | **recommend** |
| redBus Seat Seller | Passes route/date/seat granularity — **only as a registered redBus agent transacting through redBus** | Unverified; no self-serve portal | LOW *only via transact path*; **anti-scrape clause bars passive deep-link-out use** | investigate → **fallback** |
| AbhiBus/consolidators | Same as redBus (resell layer) | Unverified | Same | Fallback |
| redBus Affiliate | CPS link only, no catalog | ~₹150/sale | Not Seat Seller | Avoid |
| GTFS + gov data | Intra-city only; no intercity catalog | Free | Mixed (some scraped) | Avoid |

**Verification corrections folded in:** redBus Seat Seller is real and passes the discriminator at route/date/seat granularity — **but only if Zwapit becomes a registered redBus agent and money routes through redBus**, which **contradicts Zwapit's core model** (watch official platforms, deep-link out, never touch the official money). It is a product decision, not a drop-in. Its ToS also explicitly bars "deep-link / monitor / scrape" for competitive use — refuting any passive watcher-deep-link-out use of that inventory. "ToS = None" for curated seeding holds **only** under manual authoring or open-GTFS sourcing — seeding from Google Place content or scraping redBus/AbhiBus overclaims.

**Recommendation:** Curate `catalog_routes` for v1 (the only ToS-safe path that fully delivers the route catalogue; no open intercity bus catalog API exists for India). A B2B bus API is an *availability upgrade*, server-side only, and a future product decision — not v1.

### 3.6 Maps route-picker

| Candidate | Pricing (India, 2026) | ToS | Verdict |
|---|---|---|---|
| **Google Maps Platform** | **Native Maps SDK India = unlimited free**; Dynamic Maps 70k free then $2.10/1k; Routes 70k free then $1.50/1k; Autocomplete 70k free then $0.85/1k (verified India sheet, eff. 2024-08-01) | LOW (first-party; **no caching Routes/Places payloads**; attribution required) | **recommend** |
| Mapbox | Free 50k web loads / 25k mobile MAU / 100k Directions; then ~$5/1k loads, Directions $2/1k (**re-verify on live page**) | LOW-med; no caching payloads | Fallback |
| MapLibre + OSM | Library free; **services are the trap** — public Nominatim/OSRM/GraphHopper-free **forbid commercial use** | Medium; ODbL share-alike; self-host or paid host required | Investigate (later cost-optimization only) |

**Recommendation:** **Google Maps Platform** via the official `@capacitor/google-maps` plugin (native SDK on device, Maps JS API on web) behind one thin React wrapper. Best India road/POI/bus-stop/language coverage; India free caps are large (70k/SKU) and native rendering is **unlimited free**, so a small app pays effectively $0. Call Routes + Autocomplete **from Convex** (key stays server-side). Caveats: Google ToS forbids caching Routes/Places responses — store **your own** canonical route record, not Google's payload; for a bus picker, driving geometry is sufficient (Google India transit/bus-line data is uneven); test the Android transparent-webview overlay gotcha against the Astro+React stack.

---

## 4. How it plugs into the existing model

**Catalog tables → sources:**

| Table | Primary source | Thumbnail | Notes |
|---|---|---|---|
| `catalog_movies` | TMDB (server-side) | TMDB CDN `w342` (keyless) | Cache TMDB→IMDb/Wikidata ids; Wikidata fallback |
| `catalog_venues` | Aggregator `cinemaDetails` *if India validates*, else curated | n/a | No standalone India venue API |
| `catalog_events` | **Curated/manual** (PredictHQ optional discovery seed) | Permissioned promoter art / manual upload | PredictHQ has no image field |
| `catalog_routes` | **Curated/manual** | n/a (no bus thumbnails) | redBus B2B = later availability upgrade only |

**Adapter contract `{ isLive, bookingUrl, showtimes?, priceRange?, snapshotHash }` — what each adapter can and cannot fill:**

| Field | Can fill from | Cannot fill — honest gap |
|---|---|---|
| `isLive` | **Watcher-triggered rendered check only** (diff the official booking page) | No API returns India booking-open state. Aggregators give *scheduled* times, not live/closed. |
| `bookingUrl` | **Constructed public deep-link** (`in.bookmyshow.com/buytickets/<slug>-<ET-id>-MT/`, `district.in/movies\|events/...`); may carry affiliate tag | Not a feed; MovieGlu/Gruvi do **not** hand you the BMS/District URL. |
| `showtimes?` | Aggregator (MovieGlu/Gruvi) **if India trial validates**; else empty | Unverified India depth; refresh only several×/day. |
| `priceRange?` | Aggregator `priceRange` where present | Mostly **unverified**; not reliable for India. |
| `snapshotHash` | **Watcher diff** of the rendered booking page | Aggregator freshness too coarse to detect "just went live." |

The model already separates **demand (Want/alert)** from **supply (official alert vs community resale)**. These sources feed the *official availability alert* leg: catalog from TMDB/curated, scheduled times from a (validated) aggregator, live-state from the watcher, payoff = deep-link OUT to BMS/District. Community resale is where Zwapit transacts — unaffected by these external sources.

---

## 5. Thumbnails & image rights

- **Movie posters (TMDB):** Render small thumbnails from the public keyless CDN. **Two separate risks:** (1) the **API ToS** (commercial license needed — see §3.1); (2) **poster copyright** — posters are studio-owned IP and TMDB "does not extend any rights regarding the underlying media content" (API Terms §4). Small thumbnails for the listed item are industry-standard and low-risk, but **not a granted right** — one line for legal to acknowledge. **Mandatory attribution:** TMDB logo (less prominent than your brand) + verbatim: *"This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB."*
- **Wikidata/Commons fallback:** Data is CC0; **images are per-file licensed** (often CC-BY-SA, sometimes non-free) — read each file's license and attribute per image. Do not assume CC0 for poster pixels.
- **Event art:** Posters/event artwork are **copyrighted in India**; affiliate marketing terms do **not** grant image redistribution. Use **promoter/press-kit assets provided with a license, or permissioned manual upload** — never pull art off booking pages "under affiliate terms."
- **Bus routes:** No thumbnails (use a generic route/operator graphic).
- **Maps:** Google attribution/logo required when rendering Google tiles.

---

## 6. Phased plan (recommendation, not implementation)

**Phase 1 — Prove the demand loop, cheapest & safest first.** Wire **TMDB** for movie metadata/posters (server-side in Convex, CDN thumbnails) + **curated `catalog_events` and `catalog_routes`** + **Google Maps** route-picker. This alone lets a buyer/seller pick a canonical movie/event/route *with a thumbnail* and post a Want — the core demand-first loop — using only ToS-clean, near-zero-cost sources. `bookingUrl` = constructed public deep-link. No availability API needed yet.

**Phase 2 — Availability detection (the hard part).** Stand up the **watcher-triggered rendered check** as the *only* "tickets are live" mechanism — low-rate, robots-respecting, real-user-triggered, internal-only, audited — emitting `{ isLive, bookingUrl, snapshotHash }`. This is what actually powers the alert payoff.

**Phase 3 — Validate paid showtimes aggregators (parallel, gated on trials).** Pull MovieGlu + Gruvi trial keys; test India depth/freshness against real multiplexes. Adopt **only if** coverage proves out; otherwise stay curated. Begin the **TMDB commercial license** conversation now (it's a launch blocker, not a Phase-3 nicety).

**Later (not v1):** redBus Seat Seller / B2B bus availability (only if Zwapit decides to transact bus money), PredictHQ for event-discovery scale, Mapbox/MapLibre cost-optimization once volume justifies it.

---

## 7. Open questions to verify before build

1. **TMDB commercial license** — price, terms, India availability (quote-based, **unverified**). Email `api-for-business` early; it gates public launch.
2. **MovieGlu India depth** — run `cinemaShowTimes` on the eval key (75 reqs) against 3–5 known PVR/INOX multiplexes for today; confirm non-empty, correct, fresh. **Unverified.**
3. **Gruvi India coverage** — current India market is unproven (only 2014 evidence); test on the 7-day trial. Confirm the **€149–€299 per-market/month** cost and review the **AS-IS + indemnification** ToS with legal.
4. **TMDB `now_playing?region=IN` quality** — never run live (no key); smoke-test regional-film freshness with a real key.
5. **BMS Terms automated-access clause** — the `/termsandconditions` page 403s bots; have legal pull the verbatim clause via a browser before relying on the watcher in production. IT Act s43 is an unsettled gray area; **do not import US CFAA/hiQ reasoning.**
6. **Mapbox 2026 free-tier numbers** — re-confirm on the live pricing page (50k loads / 25k MAU / 100k Directions came from docs + aggregators).
7. **Google India price sheet** — re-check the live India sheet at build (Google has changed pricing repeatedly); confirm caching restrictions are respected in the Convex `catalog_routes` design.
8. **Capacitor `@capacitor/google-maps` overlay** — test the Android native-map-beneath-webview transparency gotcha against the Astro+React DOM.
9. **District/Zomato BD** — only a bespoke partner feed is ToS-clean, and the counterparty has a 2024 litigation record against resale-adjacent products; treat as **avoid for v1**, pursue only as a long-horizon BD conversation.
