# District by Zomato — Execution Doc (read availability via Parallel)

*The District counterpart to `bms-oss-reuse-execution.md`. How Zwapit reads "is this movie's booking open, at which theatres, with what availability" on District (district.in) — via Parallel Extract, never a direct server fetch.*

Date: 2026-06-22. Sources: District-mapping workflow (research cached; verify+synth were rate-limited, so synthesized by hand from the 3 cached research domains) + **live Parallel-key probes** + direct district.in probe.

**History (corrected):** District wasn't "Paytm bought." **Zomato/Eternal acquired Paytm's movies + ticketing business — including Paytm Insider and the TicketNew backend — in 2024 (~₹2,048 cr) and rebranded it "District by Zomato."** District is Zomato's entertainment app on the ex-Paytm stack. (Legacy `api.insider.in` is now NXDOMAIN — dead.)

---

## 0. Live Parallel test (2026-06-22) — what actually works

Ran Parallel Extract against District with the live key:

| Target | Result |
|---|---|
| **Movie-in-city SSR page** `district.in/movies/<slug>-movie-tickets-in-<city>-MV<id>` | **HTTP 200, NOT Akamai-blocked.** Returned ~14 KB of **rendered text** with the date strip (JUL 30 / 31 / AUG 1-2), formats (4DX-3D, 3D), time filters, and the words `showTime`/`avail`/`cinema`. ✅ reachable |
| **Cinema SSR page** `…/<cinema-slug>-CD<id>` | **HTTP 200, not blocked**, ~13 KB rendered text with `showTime`/`avail`. ✅ reachable |
| **Guest-token JSON gateway** `district.in/gw/consumer/movies/v3/cinema` (+ `x-guest-token`/`api_source`/`x-app-type` via Parallel's `headers` param) | **HTTP 200 but EMPTY (0 chars)** — for both `cinemaId=57700` and `CD57700`. ❌ Parallel did not return the JSON (header/token not forwarded, or gateway 401'd from Parallel's IP). |
| **Sitemap** `…/sitemap-movies-city.xml` | HTTP 200, ~36 KB, but **`<loc>` tags stripped** — Parallel returns cleaned text, not raw XML. |

**The two decisive facts:**
1. **✅ Akamai did NOT block Parallel on District** — the single biggest risk in the research is cleared. Parallel reaches the District movie/cinema pages.
2. **⚠️ District has NO clean-JSON-via-Parallel path (unlike BMS).** Parallel **renders pages to text and strips `<script id="__NEXT_DATA__">` and XML tags** — so the clean `serverState` JSON the OSS bots read is *gone* from Parallel's output, and the token-gated gateway returns *empty*. You get the showtimes as **rendered text**, not structured JSON.

So: **District is solvable via Parallel, but by parsing rendered HTML text — messier than BMS's `byvenue` JSON.** (Contrast: BMS `byvenue` is a real JSON API, so Parallel returned 102 KB of raw `ShowDetails` JSON; District's equivalent is locked behind a token or inside a stripped script.)

**The one open question that decides how clean District can be:** *can Parallel be told to return RAW HTML (scripts included)?* If yes → recover `__NEXT_DATA__` and District becomes as clean as BMS. If no → parse the rendered text. **Test this before building District** (try a Parallel `output_format: "html"` / raw mode; the `render_js`/`headers` params were accepted but their effect is unconfirmed).

---

## 0.1 Efficiency test (2026-06-22) — RESOLVED: text-parse is the efficient path ✅

Direct Parallel tests settled both open items from §0:

- **The rendered text is FULLY parseable — one call returns everything.** Extracting the movie-in-city page returned **47 theatre references, 38 showtimes, all formats** (PXL / 3D / 4DX-3D / SCREEN X / MX4D) in a clean, regular structure: `* <Theatre Name, Area>` → `Allows cancellation` / `Non-cancellable` → `+ HH:MM AM/PM <format>` per show. (Real sample: *PVR Market City Kurla(W)* → 09:00 AM PXL 3D, 10:30 AM 4DX-3D, …; *INOX Megaplex Inorbit Malad* → 08:55 AM 3D SCREEN X, 10:30 AM 3D MX4D, …; *Cinepolis Lake Shore Thane* → 08:00 AM 4DX-3D …) So **one Parallel Extract per movie+city+date yields every theatre + showtime + format** — exactly as efficient as BMS's `byvenue`, just parsed from regular text instead of JSON.
- **Raw-HTML recovery is NOT available — and NOT needed.** Seven param attempts (`output_format` / `format` / `include_raw_html` / `raw_html` / `return_html` / `output` / `render_js`) **all returned the identical cleaned text** — Parallel has no raw/scripts mode, so the embedded `__NEXT_DATA__` JSON can't be recovered. Moot: the text already carries theatre + showtime + format.
- **Catalog discovery works in one call:** the city listing `district.in/movies/<city>-movie-tickets` returned **80 movies as ready-made `<slug>-movie-tickets-in-<city>-MV<id>` URLs** (the exact watch URLs) + MV codes. Seed the catalog from this.
- **Guest-token gateway is dead via Parallel** (0 chars, reconfirmed) — ignore it.

**One limitation:** per-show seat-status (Available / Filling Fast / Almost Full) is **colour-coded in the UI and lost in the text** (only the status *legend* renders). So the text gives **booking-open + theatre + showtime + format** — everything the core "tickets are live" alert needs — but **not** per-show fill-status, which would need the JSON we can't reach. Fine for v1; only the "Filling Fast / Last-minute" alert tier is affected.

**Concrete District method (final):**
1. **Discover** (1 call/city): extract `…/movies/<city>-movie-tickets` → all bookable movies + MV-coded watch URLs → catalog.
2. **Watch** (1 call/movie+city+date): extract `…/movies/<slug>-movie-tickets-in-<city>-MV<id>` (`?fromdate=YYYY-MM-DD`) → parse `* theatre` / `+ HH:MM <format>` lines → booking open iff theatres present.
3. **Deep-link OUT** to District to book.

Same shape and cost (~$0.001–0.002/call) as BMS — both sources, one pipeline. This supersedes the `[BLOCKER]`/`[VERIFY]` items in §0 and §6.

---

## 1. Direct answer

**Yes — Zwapit can read District booking-open + showtimes via Parallel**, by extracting the **movie-in-city SSR page** (`/movies/<slug>-movie-tickets-in-<city>-MV<id>`) and parsing the rendered showtime content. Akamai doesn't block it, and the page is fresh per request (`cache-control: no-cache, no-store` — *better* than BMS, no cache-bust trick needed). The catch vs BMS: **no clean JSON comes back through Parallel** (the gateway is token-gated; `__NEXT_DATA__` is stripped), so availability must be parsed from rendered text unless a Parallel raw-HTML mode recovers the embedded JSON.

---

## 2. URL structure (confirmed)

District IDs: **`MV<digits>` = movie**, **`CD<digits>` = cinema/venue**, **city = slug** (e.g. `mumbai`, `delhi-ncr`). City is **NOT a simple path segment** — `/movies/mumbai` 404s; the city is embedded in the movie/cinema slug (`-in-<city>-`) and/or set via a `location` cookie.

| Purpose | URL pattern | Notes |
|---|---|---|
| Movie-in-city showtimes (**PRIMARY**) | `district.in/movies/<movie-slug>-movie-tickets-in-<city>-MV<id>` | e.g. `…/spider-man-brand-new-day-movie-tickets-in-mumbai-MV194537`. `?fromdate=YYYY-MM-DD` (ISO) per date. SSR, no auth. |
| Movie detail (city-wide discovery) | `district.in/movies/<slug>-movie-tickets-MV<id>` | `showDates[]` empty = booking not open; non-empty = open. Lists nearby cinemas (via `location` cookie). |
| Cinema / venue page | `district.in/movies/<cinema-slug>-in-<city>-CD<id>` | venue-level sessions (= BMS `byvenue`). |
| City listing | `district.in/movies/<city>-movie-tickets` | hrefs of bookable `…-MV<id>` titles. |
| Seat-layout (deep-link OUT) | `district.in/movies/seat-layout/<code>?encsessionid=…` | the booking page to send users to. |
| Catalog sitemaps | `district.in/robots.txt` → `sitemap-movies.xml` → `movie-detail-generic.xml` (2624 MV), `sitemap-movies-city.xml` (526 cities), `sitemap-cinema-detail-pages.xml` (2515 CD) | plain XML; seed Convex catalog from here (avoids token-gated catalog API) |

---

## 3. Endpoint / data catalogue

| # | Target | Type | Parallel-reachable? | Returns | Verdict |
|---|--------|------|---------------------|---------|---------|
| 1 | movie-in-city page `…-in-<city>-MV<id>` | SSR HTML (`__NEXT_DATA__`) | **✅ reachable (rendered text); 200, no Akamai block.** Raw JSON stripped by Parallel | showtimes/dates/formats/`avail` as text; `serverState.movieSessions[code].pageData…sessions[]{showTime,scrnFmt,statusColor,seatStatus,avail,total,areas[]{price,sAvail,sTotal}}` **if** raw HTML recoverable | **PRIMARY** |
| 2 | cinema page `…-CD<id>` | SSR HTML | ✅ reachable (rendered text) | venue sessions (= BMS byvenue) | REUSE (venue watch) |
| 3 | movie-detail `…-movie-tickets-MV<id>` | SSR HTML | ✅ likely | `showDates[]` (open?) + `cinemas[]` | REUSE (discovery) |
| 4 | sitemaps (MV/CD/city) | XML | ✅ reachable (tags stripped — URLs still in text) | full catalog of codes | REUSE (seeding) |
| 5 | guest-token gateway `district.in/gw/consumer/movies/v3/cinema` | REST JSON | **❌ empty via Parallel** (token/headers not forwarded) | clean `pageData.sessions[]` JSON (works from a real browser w/ client-gen token) | AVOID via Parallel; reference |
| 6 | HMAC gateway `api.edition.in/gw/consumer/movies/v3/{movie,cinema,cities,…}` | REST JSON | ❌ token-gated (HMAC `Authorization`, 401) | clean catalog + sessions JSON | REFERENCE only (field semantics) |
| 7 | Official District MCP `mcp-server.district.in/mcp` | MCP/OAuth | ❌ third-party use forbidden (README) | movie/theatre/showtime tools | REFERENCE only |
| 8 | `api.district.in` / `api.insider.in` / `gw.district.in` | — | ❌ NXDOMAIN | — | DEAD |
| 9 | `district.ticketnew.com` (ex-Paytm TicketNew backend) | — | unverified (404 root) | legacy backend | INVESTIGATE later |

OSS references (the source of the URL/ID/field intel): `joel122002/bms-bot` (`district.py` gateway+token format), `kartikth40/district-show-watcher` (`__NEXT_DATA__` parser for cinema + movie pages, full session/areas decode). Legacy Paytm Insider repos are dead (NXDOMAIN).

---

## 4. Recommended Parallel approach

**Mirror the BMS pipeline, but parse rendered HTML instead of JSON:**
1. **Discovery / booking-open:** Parallel-extract the movie-in-city page (`…-in-<city>-MV<id>`). Non-empty showdates + rendered theatre/showtime content ⇒ *tickets are live*. Detection rule = target movie present with ≥1 non-"Sold Out" session for the date.
2. **Per-venue depth (optional):** Parallel-extract the cinema page (`…-CD<id>`) for venue-level sessions.
3. **Parse availability** from `seatStatus` = **Available | Filling Fast | Almost Full | Sold Out** (`statusColor` G/Y/R/D) → **reuse the BMS `AVAIL_STATUS_MAP` (3/2/1/0)** decode. Same four alert types, same "filling fast" badge.
4. **Seed catalog** from the sitemaps (MV/CD/city) into Convex rows (cache `MV`/`CD`/city slug).
5. **Deep-link OUT** to the District seat-layout page to book.

**Collapse key (monitor_targets):** `MV-code + CD-code + date` (or `MV + city + date` for movie-level).

**Do NOT** chase the token gateways (#5/#6): #6 needs server-minted HMAC; #5 returned empty via Parallel. App-impersonation is out of scope (worse legal posture, uncomputable per-request).

**Cost:** District pages are ~13–14 KB rendered via Parallel (the raw HTML is ~322–497 KB but Parallel returns the cleaned text) — same ~$0.001–0.002/extract as BMS.

---

## 5. Reusable IDs & logic

- **City → cinemas:** `location` cookie (`cityId, lat/long, pCityKey`) scopes results; city slug also appears in the URL (`-in-<city>-`). 526 city slugs in `sitemap-movies-city.xml`.
- **Movie = `MV<digits>`, Cinema = `CD<digits>`** — trailing codes in the web URL; enumerate from sitemaps. Cache on catalog/venue rows alongside the BMS `ET`/`venueCode`.
- **Availability decode** = same constant as BMS (`AVAIL_STATUS_MAP` 0–3 / G-Y-R-D). One decode serves both sources.
- **Freshness:** District SSR is `no-cache` per request → fresher than BMS; **no cache-bust param needed**.

---

## 6. Open risks / verify before build

1. **[BLOCKER] Can Parallel return RAW HTML (recover `__NEXT_DATA__`)?** Default Extract strips the script → you lose the clean `serverState` JSON and parse rendered text instead. Test a Parallel raw/HTML output mode. This decides clean-JSON vs text-parsing for District.
2. **[VERIFY] Is the FULL per-theatre showtime grid in Parallel's render?** The movie-in-city extract returned only ~14 KB (header + date strip + filters + some `showTime`/`avail`/`cinema` tokens). Confirm the complete theatre×time×seat grid renders (vs a partial/client-hydrated list) — same render-completeness check as BMS §8.0.1.
3. **Guest-token gateway is empty via Parallel** — confirmed; don't rely on it. The clean JSON only flows to a real browser with a client-generated token; Parallel-by-URL doesn't reproduce it.
4. **SSR-dependency canary:** District works because the server injects showtimes into anonymous HTML (`isCSR:false`). If District moves showtimes to post-hydration client fetch, the Parallel-render signal weakens — watch page size / `serverState` presence as the canary.
5. **`buildId` rotates** (`/_next/data/<buildId>/…` is 404 anyway) — target the human-facing `…-MV<id>` URL, which is buildId-independent.
6. **ToS unchanged** (founder deprioritized legal): `district.in/robots.txt` allows `/movies` but disallows `/order`/`/checkout`/`/sgw/*`; movie pages are allowed. Keep the watcher non-load-bearing, real-user-triggered, deep-link-OUT.
7. **City slug set:** only `mumbai` verified live; validate other slugs against `sitemap-movies-city.xml`.
8. **`api.edition.in`** is the real internal host (LIVE, Akamai) but HMAC-gated — reference only; `api.district.in`/`api.insider.in` are NXDOMAIN.
