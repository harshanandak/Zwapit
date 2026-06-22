# Free movie-catalog data options for Zwapit — cross-checked (2026-06-22)

Question: *is TMDB the only option for free movie-catalog integration, or are there others?*
Constraint: **$0 / free tier only, no paid subscription, and Zwapit is a COMMERCIAL product** (so the
free tier must permit commercial use), India/regional-language film coverage matters.

Method: each source checked against its **current official Terms/pricing** (fetched 2026-06-22 via
context-mode), plus a verification pass on the free-AND-commercial claim. Two of the candidates
(Trakt, Streaming Availability API) came from the research workflow; the rest were fetched directly
(the workflow's other agents were API-rate-limited).

## Headline: TMDB itself is not a clean "free for commercial" option
TMDB **API Terms of Use §2 (Commercial Use):** *"The license… does not permit any commercial use of
TMDB, the TMDB APIs, or TMDB Content. Selling… or deriving revenues from the use or provision of …
TMDB Content, for commercial or monetary gain, directly or indirectly, is … only permitted under a
separate written agreement between You and TMDB."* Developer FAQ: *"Our API is free to use for
**non-commercial** purposes as long as you attribute TMDB… for **commercial purposes, please
contact** [TMDB]."* (https://www.themoviedb.org/api-terms-of-use)
- Zwapit charges a success fee → **commercial** → the free TMDB key does NOT cover it by itself.
- It's not necessarily a *paid* wall — TMDB grants commercial agreements (sometimes free-of-charge),
  but you must **apply/contact them**; you can't just ship on the free key per the letter of the terms.
- Attribution is mandatory either way (TMDB logo + "uses TMDB and the TMDB APIs but is not endorsed…").
- No fixed rate limit (legacy 40/10s disabled; soft ~40 req/s anti-scrape ceiling).
- **Action:** revisit the CLAUDE.md "TMDB for movies" decision — either get a TMDB commercial
  agreement, or use a CC0/commercial-clean source.

## Two DIFFERENT needs — don't conflate them
- **(a) Catalog METADATA** (titles, year, language, poster, IDs) — backs `catalog_items` + request/want
  matching. This is what "movie catalog" means in CLAUDE.md. Several free options exist.
- **(b) SHOWTIMES / now-showing-in-India** (which film is in which cinema, when) — for availability
  alerts. **No free API exists** for this in India (see bottom). This is the real gap.

## (a) Catalog metadata — comparison (commercial-use column is the decisive one)

| Source | Free tier | Commercial use on free tier | India/regional coverage | Notes | Verdict |
|---|---|---|---|---|---|
| **Wikidata** (SPARQL/MediaWiki) | Yes, no key | **YES — CC0 / public domain, no attribution required** | Decent (community; mainstream + many regional films) | WDQS limits: 60s processing / 60s per client, 429 backoff; seed/cache, don't hot-query | ✅ **Best $0 + commercial-clean** |
| **TMDB** | Yes (free key) | **NO on the free key** — commercial needs a separate written agreement (contact TMDB); attribution required | Strong (best India/regional coverage + posters) | Superior data/UX; the licensing step is the catch | ⚠️ Great data, but needs a commercial agreement |
| **Trakt** | Yes (free key) | **Yes** (verified: Trakt staff "no restriction… for commercial use", Feb 2026) | Partial (its title metadata is **TMDB-derived**) | Good for trending/anticipated/most-watched + cross-IDs; Trakt itself says source canonical metadata from TMDB → doesn't escape TMDB's terms for the actual titles | ⚠️ Signal layer, not a clean catalog |
| **OMDb** | Yes (1000/day free key; Patreon for more/posters) | **Unclear/likely not** — no explicit commercial grant; data is IMDb/RT-derived (licensing risk) | Weak–partial | Tiny free quota; murky provenance | ❌ Risky for commercial |
| **TVmaze** | Yes, no key | **Yes — CC BY-SA 4.0** (credit + ShareAlike) | n/a | **TV shows only, not movies** → not a movie catalog (relevant only if Zwapit adds TV) | ❌ Wrong domain |
| **IMDb non-commercial datasets** | Yes (TSV dumps) | **NO — "personal and non-commercial use" only** | Strong | Explicitly bans commercial use — a trap | ❌ Cannot use |
| **Google Knowledge Graph Search API** | Yes (quota) | Yes (GCP terms) | Partial | Google itself: *"not suitable for use as a production-critical service"* + being **migrated/deprecated** to the paid Cloud Enterprise Knowledge Graph | ❌ Deprecated/weak |
| **Streaming Availability API** (Movie of the Night) | Yes (500 req/mo) | **Yes** (verified; attribution required; no resell/redistribute) | Partial (OTT-centric incl. Zee5/Hotstar) | Streaming-availability shaped; catalog slice redundant with TMDB; tiny quota | ❌ Wrong shape |
| **Watchmode** | Limited free tier | Paid-leaning (they emphasize charging for quality) | India listed (50+ countries) | Streaming-availability, not theatrical catalog | ❌ Wrong shape |
| **JustWatch** | No official public API (partner-only) | n/a | India yes (in product) | Unofficial scrapers = ToS/legal risk | ❌ No public API |

## (b) Showtimes / now-showing in India — the real gap
- **MovieGlu / Gracenote (Nielsen):** the serious global showtimes providers — **paid / trial-only**,
  not $0.
- **BookMyShow, District (Zomato):** **no public API.** (Unofficial scraping = ToS risk + fragile.)
- **Cinemalytics** and similar India analytics: paid/B2B.
- → For $0, there is **no free showtimes API for India**. This matches the existing
  `free-stack-decision.md`: curated/seeded events + an internal availability watcher, with deep-links
  OUT to the official site (Zwapit doesn't resell official inventory anyway).

## Recommendation for Zwapit ($0, commercial, India)
1. **Catalog metadata backbone → Wikidata (CC0).** Only mainstream source that is unambiguously
   free **and** commercial-clean **and** attribution-free. Seed/cache `catalog_items` from it
   (respect WDQS rate limits — batch, don't live-query per request). Good enough for canonical
   titles + IDs + language for exact-match wants.
2. **If you want TMDB's richer data/posters/coverage → get a TMDB commercial agreement** (contact
   TMDB; often granted, sometimes free) — then keep TMDB, but as a *licensed* dependency, not a free
   one. Don't ship a commercial product on the bare free key.
3. **Trakt (optional) for "what's hot"** — trending/most-anticipated lists + cross-ID mapping (free,
   commercial-ok), layered on top of the Wikidata/TMDB canonical rows.
4. **Showtimes/now-showing → stay curated + watcher** (no free API for India). Unchanged from the
   free-stack decision.
5. **Avoid:** IMDb datasets (non-commercial), OMDb (murky commercial/provenance), Google KG
   (deprecated/non-production), JustWatch unofficial scrapers.

## Update (2026-06-22): TheTVDB + OMDb (from publicapis.io links)
- **TheTVDB (thetvdb.com/api-information)** — **revenue-tiered license**, verified on its official
  page: **< $50k/yr company revenue = FREE (attribution required)**; $50k–$250k = **$1,000/yr**;
  $250k–$1M = **$10,000/yr**; $1M+ = custom. Covers TV **and** movies. Attribution (direct link to
  TheTVDB.com) required. Significance: it is the **only mainstream movie-capable API with an explicit
  free-for-COMMERCIAL tier** (TMDB's free tier is non-commercial) — but only while tiny, and it
  becomes a paid annual subscription as Zwapit grows. **TV-primary; movie + India/regional coverage
  is weaker than TMDB/Wikidata.** Verdict: ⚠️ viable "free while <$50k revenue" option, but a future
  subscription + weaker for Indian films → still behind Wikidata for the permanent $0/commercial goal.
- **OMDb (publicapis.io listing)** — directory blurb only; no new licensing detail. Unchanged: free
  key (1000/day) + Patreon, user-contributed/IMDb-derived, commercial terms unclear, weak India. ❌.

## Directory scan (publicapis.io Media + Video, 63 listings) — 2026-06-22
Scanned the full publicapis.io Media (31) + Video (32) categories for any movie/TV catalog we'd
missed. No new clean $0+commercial+India catalog surfaced. Additional names (directory/profile-level,
not full-ToS-verified — lower confidence):
- **Simkl** — movie/TV/anime tracker (Trakt-like); metadata community/TMDB-derived → tracking layer,
  not a canonical catalog. Commercial terms unverified.
- **Reelgood** — streaming-availability aggregator (Watchmode/JustWatch-like); partner/commercial API,
  not open/free. Wrong shape.
- **ErosNow** — India/Bollywood, but a **Partner API for its own streaming catalog**, not an open
  self-serve movie catalog. Not $0/self-serve.
- **Third-party "IMDB-API" wrappers (RapidAPI)** — resell IMDb data (non-commercial) → legal/ToS risk.
  Avoid. ("MovieDB" in the directory = TMDB, already covered.)
- Everything else in those categories is video-hosting infra (Cloudinary/Vimeo/Mux/api.video/Gcore/
  YouTube/Vidyard), novelty/fictional (Harry Potter, SWAPI, LOTR, Breaking Bad quotes, Owen Wilson
  Wow, Trace.moe), or non-movie (Goodreads, Flickr, Rijksmuseum). Not usable as a catalog.
Conclusion unchanged: Wikidata (CC0) for permanent $0+commercial; TheTVDB free while <$50k revenue;
TMDB needs a commercial agreement.

- **Letterboxd** (checked 2026-06-22, api-docs.letterboxd.com + letterboxd.com/api-coming-soon):
  **API is "available by request only," access not guaranteed**, and explicitly **not granted** for
  personal/recommendation/LLM projects — not a self-serve/shippable option. It's a *social/reviews*
  layer (ratings/lists/diary), not a movie catalog, and its film data is TMDB-sourced. Letterboxd's
  own page says: *"If you require an API for … movie and TV data (… poster, etc.), we recommend
  applying for access to TMDB directly."* → confirms TMDB.

## Images / posters — the decisive gap (empirical, 2026-06-22)
Live WDQS query over **183 recent (2024+) Indian films** (`P31=film, P495=India, P577>=2024`):
- **P18 image: 1%** · **TMDB id (P4947): 93%** · **IMDb id (P345): 98%**.
So **Wikidata has essentially NO movie posters** — movie posters are copyrighted and Wikimedia
Commons only hosts freely-licensed media, so film items rarely carry one (and P18, when present, is
often a premiere photo/logo, not the poster). A pure-Wikidata catalog = title-text cards with no
recognizable artwork → poor UX for a consumer ticket app.
**But** Wikidata carries the TMDB/IMDb **ids** for ~93–98% of films → it's an excellent free,
commercial-clean **metadata + ID-bridge backbone**, just not a poster source.

**There is no fully-free + commercial-clean source of recognizable movie posters** (posters are
copyrighted). The poster sources gate commercial use:
- **TMDB** — best posters + India coverage, but its API Terms cover images too → commercial use of
  posters needs the TMDB commercial agreement.
- **TheTVDB** — artwork DB, free while <$50k revenue (then paid), but weaker movie/India poster coverage.

**Revised recommendation (posters required):**
- **A — TMDB with a commercial agreement (recommended):** use TMDB for metadata + posters; best
  coverage/UX. The "cost" is applying for the agreement (often granted, sometimes free — confirm with
  TMDB). Wikidata optional as a free ID-bridge / coverage filler.
- **B — Wikidata (free metadata/IDs) + TheTVDB artwork (free <$50k):** most-free now; weaker India
  posters; TheTVDB becomes a paid subscription as Zwapit grows.
- **C — Wikidata only, no real posters (title/placeholder cards):** strictly $0 forever, but weak
  recognition UX.
Net: the image requirement pushes back toward **TMDB + agreement** — the licensing step that made us
hesitate is unavoidable for posters anyway, and TMDB is the strongest at it.

## Confidence / caveats
- TMDB §2, IMDb non-commercial, Wikidata CC0, TVmaze CC BY-SA, Google KG deprecation: **high**
  (direct from current official pages, quoted above).
- Trakt + Streaming Availability commercial-use: **medium–high** (workflow-verified; Trakt's rests on
  an official-forum staff statement, not verbatim ToS — their legal pages 403'd).
- OMDb / Watchmode commercial terms: **low** (pages thin; treat as not-cleared).
- India/regional coverage ratings are directional, not benchmarked.
