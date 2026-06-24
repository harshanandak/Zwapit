# District (district.in) — Internal API & URL Structure

*Companion to `bms-oss-reuse-execution.md` §6.6 ("District = separate pass"). Resolves it.*
Date: 2026-06-22. Method: live probes from sandbox (datacenter IP) of district.in HTML, sitemaps, Next.js `__NEXT_DATA__`, and the client JS bundle (`cdn.district.in/movies-web/_next/static/chunks/pages/_app-*.js`), plus DNS. All endpoints below were OBSERVED in page source / bundle, not guessed. buildId at test = `UhMZkH46asyyAXHKzn4OZ`.

---

## TL;DR — the discriminator answer

District's clean JSON gateway (`api.edition.in/gw/consumer/movies/...`) is **token-gated (HTTP 401 "Access token not found")** — NOT anonymously reachable by Parallel-by-URL. BUT the **movie-in-city detail page server-side-renders the full showtime + per-show availability into `__NEXT_DATA__`**, `cache-control: no-cache, no-store` (fresh per request), no client auth required. **That SSR HTML is the Parallel-reachable path — the direct analogue of the BMS buytickets HTML (#1), but with cleaner embedded JSON.** This mirrors BMS, except District's equivalent of BMS's anonymous `byvenue` clean-JSON does NOT exist publicly.

## (1) WEB URL structure (from sitemaps, all verified 200)

- City movie listing: `https://www.district.in/movies/<city>-movie-tickets` (e.g. `mumbai-movie-tickets`). 526 cities.
- Movie detail (generic, no city): `/movies/<slug>-movie-tickets-MV<digits>` — **`MV` = movie code**. 2624 entries.
- **Movie-in-city (= BMS buytickets, the showtimes page):** `/movies/<slug>-movie-tickets-in-<city>-MV<digits>`. Constructable by inserting `-in-<city>` before `MV` in the generic slug. VERIFIED: SSRs the showtime grid.
  - **Date param `?fromdate=<YYYY-MM-DD>` (ISO format; compact `YYYYMMDD` returns 0).** No date in the path. Default (no param) SSRs the FIRST date in the `showDates` strip. `pageProps.data.serverState` carries `showDates:["2026-07-30","2026-07-31",...]` (the bookable dates) — read that, then fetch one URL per date of interest. VERIFIED: `?fromdate=2026-08-02` returned a different 156-session set all dated 2026-08-02. Other client-side filter params (seen in `[slug]` chunk): `cinemaIds`, `frmtid` (format), `poi_id`, `fromsessions`. This is the District analogue of BMS's *dated* buytickets URL.
- Cinema detail (sessions-by-venue): `/movies/<slug>-in-<city>-CD<digits>` — **`CD` = cinema/venue code**. 2515 entries. Also SSRs sessions.
- Sitemaps: `robots.txt` → `https://www.district.in/movies/search-sitemap/sitemap-movies.xml` (nested index → `movie-detail-generic.xml`, `sitemap-movies-city.xml`, `sitemap-cinema-detail-pages.xml`, `sitemap-provider-cinemas.xml`, language/genre/upcoming). These enumerate every MV/CD code + city for catalog seeding.

## (2) INTERNAL API — host + endpoints (from `_app.js` bundle)

- **Gateway host: `https://api.edition.in`** (the `edition` base URL in webpack module 81676: `{"edition":"https://api.edition.in"}`). DNS: LIVE, Akamai (184.26.54.x). NOTE: `edition.in`, NOT `district.in`. `www.district.in` is same Akamai range (23.65.124.x).
- Path prefix: **`/gw/consumer/movies/...`** — the gateway. (`robots.txt` disallows `/sgw/*`, the server-side variant.) REST, not GraphQL.
- 51 endpoints enumerated. Showtime/availability/catalog relevant:
  - `/gw/consumer/movies/v3/movie?meta=1&reqData=1` — movie detail + sessions (var `movieSessions`)
  - `/gw/consumer/movies/v3/cinema?meta=1&reqData=1` — **sessions-by-cinema** (var `cinemaSessions`; BMS `byvenue` analogue)
  - `/gw/consumer/movies/v5/movie`, `/v5/cinemaByChain`, `/v5/fetch_languages`
  - `/gw/consumer/movies/v3/cities`, `/v3/cinemas`, `/v3/movies`, `/v3/partner-cities` — catalog seeding
  - seat layout: separate host (var `a`) `…/seat-layout/<frmtid>?encsessionid=<encSessionId>&…` — the deep-link target.
- **Auth (the gate):** all `/gw/` endpoints return **401 `{"message":"Access token not found"}`** unauthenticated. Bundle shows HMAC `Authorization` header (`header_key:"Authorization", type:"hmac"`) + request headers `x-app-type` (`ed_web`/`ed_mweb`), `api_source:"district"`, `x-city-id`, `x-pcity-id`, `x-user-lat`/`x-user-long`, `x-gps-lat`. The token is minted server-side (the SSR server holds it); the public client only gets the rendered result.
- Other hosts seen in bundle: `jumbo.edition.in` / `jumbo.zomato.com` (analytics), `link.district.in` (deeplinks), `assetscdn1.paytm.com` (Paytm lineage, confirms ex-Insider stack), `cdn.district.in/movies-web` (asset/CDN prefix).

## (3) SSR payload shape (the reusable signal) — `__NEXT_DATA__.props.pageProps.data.serverState`

Route is catch-all `/[slug]`, `gssp:true` (getServerSideProps). On the **movie-in-city** page (e.g. `cocktail-2-movie-tickets-in-mumbai-MV213788`, ~2.1 MB; Spider-Man Mumbai = 152 sessions) the hydration state holds per-session objects:
- `encSessionId`, `mcd`, `entityDataCode`, `scrnFmt` ("2D"), `audi` (screen), `price`, `total`/`avail` (show-level seat counts), and per seat-class `{code,label,sAvail,sTotal,price,statusColor}`.
- **Availability decode (= BMS `AVAIL_STATUS_MAP`):** `seatStatus` ∈ **`Available | Filling Fast | Almost Full | Sold Out`** (+ `statusColor` G/Y/D, `seatClass` greenCol/yellowCol/greyCol). Maps to BMS 3/2/1/0. All four observed live.
- Cinema-detail (CD) page SSRs sessions-by-venue too (no-cache), but no movie titles in the slice tested — venue-centric.

## (4) Parallel approach — cleanest reuse

- **Point Parallel Extract at the movie-in-city HTML URL** `/movies/<slug>-movie-tickets-in-<city>-MV<code>`; parse `__NEXT_DATA__` → `pageProps.data.serverState` for sessions + `seatStatus`. This is the same architecture as BMS #1 (rendered/SSR page via Parallel), and is the EXACT mirror to reuse. No JS execution needed — data is in the initial HTML.
- **Freshness is BETTER than BMS:** `cache-control: max-age=0, no-cache, no-store` + per-request gssp → live snapshot each fetch (BMS's #1 had a ~1-day stale-cache risk). Still verify Parallel's own caching layer with a forced-fresh fetch before reliance.
- **Detection rule:** target movie's MV code present with ≥1 non-"Sold Out" session for the date ⇒ "tickets are live". Collapse key analogue: `MV<code> + CD<code> + date`.
- **Catalog seeding:** sitemaps (MV/CD/city) for the canonical catalog; the `/gw/` `v3/cities|cinemas|movies` endpoints are token-gated so seed from sitemaps + SSR pages, not the raw API.
- **Do NOT** attempt the `/gw/` API directly (401, HMAC-signed, app-impersonation = worse legal posture and unreachable by Parallel-by-URL). **Do NOT** rely on `api.district.in`/`api.insider.in`/`gw.district.in` — all NXDOMAIN.

## OSS / reverse-engineering (item 3) — none usable
GitHub search (2026-06-22): no District/`edition.in` API repos exist (`district.in movies api`, `district.in showtimes`, `api.edition.in` movies → 0 relevant). Legacy Paytm Insider: only two stale 2020 toy repos (`vishal1337/Events`, `rohegde7/Insider-Events`) on the now-dead Insider API; the documented Insider API (`only-much-louder/insider-api-doc`) is archived + API-key-gated (per BMS doc §6.6). One manual-QA repo `GauravUdhwani/Manual-Testing-Project` ("District By Zomato") has no API value. **Conclusion: no OSS informs the current District endpoints — the live SSR-payload discovery above is the only viable path.**

## Open risks
- Auth durability: SSR works because District's server injects authed data into anonymous HTML. If they move showtimes to client-side fetch (post-hydration, like a SPA), the SSR signal disappears and only JS-render or the token-gated API remain. Watch the page size / `serverState` presence as a canary.
- ToS/legal posture unchanged from BMS (§8.4): third-party fetch of a booking page on Zwapit's behalf; re-check district.in `robots.txt` (it `Allow: /` for movies, but disallows `/order`, `/checkout`, `/sgw/*`).
- Sandbox is a datacenter IP and got 200s here; one success ≠ durable. Parallel reachability of the SSR HTML is highly likely (it's public HTML) but unverified with the actual Parallel key (not in repo).
- City coverage: confirmed `mumbai`; the city token in the URL must match District's slug set (sitemap-movies-city has the full 526-city list).
