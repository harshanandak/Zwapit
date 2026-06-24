# Catalog Data & Maps — Decisions

Companion to `research.md` (full options) and `free-only-stack.md` (verified $0 stack).

## D1 — Maps: Google Maps Platform for MVP (2026-06-20)

**Decision:** Use **Google Maps Platform free tier** for the MVP — map rendering, **theatre/venue discovery (Places)**, and **bus route selection (Routes + Places Autocomplete)**.

**Rationale (founder):** easiest and most on-point to implement; best India coverage; one provider covers map + theatre-finding + bus routes; gets the MVP testable fastest. Optimization can come later.

**What this accepts:**
- Google requires a **Google Cloud billing account with a card on file** even at ₹0 spend (there is no card-free path to a Maps key).
- The **native Maps SDK (India) SKU is unlimited-free**; data APIs (Geocoding, Places Autocomplete, Routes, web Dynamic Maps) are free **under 70,000 calls/SKU/month in India**, then billed per-1,000 with **no automatic hard stop**.
- **Guardrail (do on day one):** set **per-SKU daily quota caps** in the Cloud console so a spike/abuse cannot produce a surprise bill. Keep the Maps key **server-side / proxied via Convex**.

**Status of the no-card alternative:** the **MapLibre + OpenFreeMap + LocationIQ + ORS** stack in `free-only-stack.md` remains the documented **fallback / post-MVP cost-optimization path** (fully no-card, commercial-OK). Not discarded — deferred.

**Supersedes:** the "no credit card anywhere" preference in `free-only-stack.md` **for the MVP phase only**. The free-only doc stays valid as the optimization target.

## D2 — Catalogue (unchanged, confirmed)

- **Movies/metadata/posters → TMDB** (confirm commercial-use agreement before public launch; attribution mandatory — see `research.md` §3.1/§5).
- **Theatres/venues → Google Places (MVP)**, optionally enriched/seeded by OSM/Wikidata later.
- **Events & bus routes → curated/manual `catalog_events` / `catalog_routes`**, seeded from free open data (Wikidata CC0, data.gov.in GODL, OSM) — no free dated/intercity feed exists.

## D3 — Availability detection ("tickets are live") — UNDER RESEARCH (2026-06-20)

**Confirmed:** no official/public/affiliate API exposes India venue-level "is booking open" — this is the one genuinely unsolved slot. Design specifies a **watcher-triggered rendered check** (real-user-triggered, low-rate, robots-respecting, internal-only/audited, deep-link OUT to the official site; Zwapit never resells official inventory).

**Open question being researched** (workflow `wf_444402d7-258` → output: `availability-watcher-crawlers.md`): whether modern crawlers (Firecrawl, AI browser agents, RPA, the existing self-hosted n8n) make the watcher reliable + cheap + ToS/legally acceptable, **given BMS/District anti-bot defences and India legal exposure**.

**Outcome (2026-06-20):** report delivered — `availability-watcher-crawlers.md`. Verdict: **no crawler reliably + cheaply + acceptably checks "is this show live" on BMS/District** — the binding constraints are anti-bot durability (the historic IP-block of the popular BMS notifier) and India legal exposure (IT Act s43/s66 gray area + the Dec-2024 Maharashtra detect-and-report mandate), not crawler capability or cost. **Recommended design:** crawl is an **ASSIST, never primary** — primary truth = community corroboration + admin "mark live" + always-present official deep-link; an on-demand rendered check fires only when a real alert exists (never cron polling), hosted/orchestrated by the existing **n8n** (fetch from a separate non-datacenter IP), ripped out when any official feed appears. MVP cost: **$0** by keeping the crawl non-load-bearing.

**Correction logged:** the earlier "2024 BMS police complaint / Zomato legal notices against resellers" citation is **contested/unverified** — the Mumbai Coldplay complaint was filed *against BMS* and closed; the Zomato claim is unsourced. Corrected in `research.md` §2.

## D4 — ShowTing (showting.in) is a direct competitor, NOT a data source (2026-06-22)

Investigated showting.in (founder's "subscribe on their behalf + rebroadcast their alerts" idea). Finding: **ShowTing is a direct competitor**, not a neutral notifier. Homepage = "Movie Ticket Alerts & Marketplace"; identical flow (sign up → set movie/theatre/screen/date/showtime preferences → app push + email with booking link when tickets go live), plus **IPL ticketing, a referral program, and a paid "Plus" tier**. Built by Vishwa & Bharath; appears very early-stage ("0+ users"). **No public API** (`/api`, `/docs` → 404; `/about`, `/pricing`, `/contact` also 404 — small site).

**Decision: do NOT build availability detection on ShowTing.** Rebroadcasting a competitor's per-account alerts = renting our core moat from a rival who can (and would) cut us off the moment one account subscribing to everything + commercial rebroadcast is noticed; it needs fragile UI automation (no API), breaches their ToS, adds a detect→email→inbox→fan-out latency hop, and **leaks our demand data straight to a competitor**. Availability detection is the differentiator — **own it** via the validated Parallel direct-check (see `availability-watcher-crawlers.md` §8.0, ~$0.001/check, freshness solved), not a competitor's feed. ShowTing's value to us is **competitive intelligence only** (proves the market is real; sets the UX bar — alerts + resale + referrals + IPL + Plus tier).

## D5 — BMS and District are BOTH first-class sources (complementary, build together) (2026-06-22)

Corrects an earlier framing ("ship BMS first, District later"). BMS and District are the two dominant India ticketing apps and **theater exclusivity is real** — some theaters are District-only, some BMS-only, many on both. The two sources are **complementary coverage, not redundant**: watching only BMS makes a show at a District-exclusive theater invisible to us (and vice versa) — a correctness failure, not a coverage nicety. The "BMS easy / District hard" distinction is **only parsing mechanics** (BMS = clean JSON, District = rendered SSR text), not capability — both reach via Parallel at ~$0.001/check.

**Decision:** build **both source adapters together in v1.**
- A canonical catalog venue maps to its **BMS `venueCode` and/or District `CD` code** (source-tagged, per the `catalog_venues` design); some venues carry both, some one.
- The watcher checks whichever platform(s) a venue is on; for "any theater in my city" requests it checks both and **unions** the results.
- A show is "tickets live" if available on **either** source. Both adapters feed the same `monitor_target`; the availability decode (`AVAIL_STATUS_MAP`) is shared; deep-link out to whichever platform has it.

See `bms-oss-reuse-execution.md` + `district-reuse-execution.md`.
