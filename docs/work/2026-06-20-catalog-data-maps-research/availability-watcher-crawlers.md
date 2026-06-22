<!-- Source: background workflow wf_444402d7-258 (run wmew68j95) — research + adversarial verification + synthesis, 2026-06-20. Answers the founder's question: can crawlers (Firecrawl / AI browser agents / RPA / n8n) reliably check "is this show live" on BookMyShow/District? Research + recommendation only, not an implementation. Companion to research.md, free-only-stack.md, decisions.md. NOTE: this pass CORRECTED an earlier claim — the "Sept-2024 BMS police complaint / Zomato legal notices against resellers" is contested/unverified (see §2). -->

# Crawlers & Automation for Zwapit's Availability Watcher — Final Recommendation

## 1. Direct answer

**No.** No crawler — AI-powered, browser-based, or RPA — can reliably, cheaply, *and* acceptably determine whether a specific India BookMyShow/District show is open over time. Capability is the easy part: any rendering tool can read a "Book tickets" state off a public showtime page *once*. The two binding constraints both fail: **anti-bot durability** is WEAK-to-MEDIUM and decaying for every option (the most popular public BMS notifier hit a *lightweight JSON endpoint* — not even rendered HTML — and was still killed by a plain server IP block), and **India legal exposure** (IT Act s43/s66 gray area + a Dec-2024 state mandate requiring platforms to detect and report bot traffic) rises the harder a tool fights the anti-bot wall. **Cost is NOT the deciding factor** — at a real-user-triggered, shared-watcher volume (tens-to-hundreds of checks/day), free tiers cover it; the durable problem is structural, not budgetary. Treat any rendered check as a fragile, graceful-degradation last resort, exactly as the product design already frames it — never a reliable backbone.

## 2. The real constraint — anti-bot + India legal reality

**The crawler choice is secondary because the bottleneck is not crawling capability — it is IP reputation + TLS/JA3-JA4 fingerprint + rate-limiting at the official platforms.** Every vendor in this space solves the same problem the same way: residential/stealth proxy + headless browser against Akamai-class defenses. They differ on price and convenience, not on durable BMS/District capability.

- **The IP-block precedent is direct, not theoretical.** The abinpaul1 BMS notifier hit `in.bookmyshow.com/api/explore` (an undocumented JSON endpoint, minimal footprint) and was disabled in production — README verbatim: *"Live Bot has been disabled because BookMyShow blocked IP of server from which bot was operating."* A datacenter/VPS IP (including the founder's n8n box) is flagged on reputation alone; in 2026 Akamai's top vector is TLS/JA3 at the handshake, which a Node HTTP client fails before reading anything.
- **The Dec-2024 Maharashtra Cyber mandate (s168 BNSS)** now requires BookMyShow, Zomato Live, Paytm Insider et al. to deploy AI/firewalls to detect bot vs human traffic and report suspicious patterns to police. This is the durable, *rising* adversary — detection nets are pattern-based, not intent-aware, so even a read-only ping is exposed to blocking/referral regardless of legal merit.
- **The legal liability for a posture-(b) watcher is LOW-TO-MODERATE and CIVIL, not criminal** — *if* kept honest. s66 criminal liability needs dishonest/fraudulent intent, which is absent when Zwapit holds no inventory, takes no money on the official path, and deep-links demand TO the official seller. The OLX precedent (India's clearest scraping case) turns on *republishing* and expressly exempts private use; a one-bit availability flag republishes nothing. **Critically: the more a tool actively defeats Akamai (Web-Unlocker bypass, CAPTCHA-solving, residential-proxy rotation, fake accounts), the worse the s43/s66 framing — paying for bypass-as-a-service manufactures the "unauthorized access / circumvention" reading and the very "dishonest intent" that today is absent.**

**Verification corrections folded in (these override the brief and earlier verdicts):**
- The **Sept-2024 "BookMyShow police complaint against resellers" and "Zomato Live legal notices" are CONTESTED / UNVERIFIED.** Primary checking found the Mumbai complaint was filed *against BookMyShow* (alleging BMS itself manipulated Coldplay access) and was *closed by Mumbai Police* finding no irregularities; the Zomato-notices claim returned no supporting source. **Do not cite either as precedent against an availability checker.** The durable legal facts are: IT Act s43/s66 unsettled gray area + the demonstrated IP-block precedent + the Maharashtra detect-and-report mandate.
- **robots.txt is a SHIELD here, verified.** BMS disallows `/payment/`, `/order-summary*`, `/booking-details*`, `/confirmation.bms`; District disallows `/checkout`, `/order`, `/bookings`, `/payments` while allowing `/` and movie/event listings. A read of *only* the public showtime page touches no Disallow path — robots-compliant on both.
- **District is structurally app-first.** Its fullest real-time availability surface lives in the app, not web. For District, the whole web-scraping class is **UNVERIFIED–likely-no**, not "partial."

## 3. Tool comparison

| Tool | Can check BMS/District? | Anti-bot durability | Cost (free tier?) | ToS/legal risk | Verdict |
|---|---|---|---|---|---|
| **Firecrawl** (/scrape + Stealth) | Partial (web only; District app-gated) | Weak–medium, decaying | Free ~500–1,000 cr/mo but Stealth = 5 cr/page burns it fast | High — paying to defeat Akamai strengthens s43 framing | **avoid** ⬇ *(downgraded from investigate)* |
| **Crawl4AI** (OSS self-host) | Partial (web only) | Weak default / medium w/ own residential proxy | Free SW; proxy bandwidth is the real spend | Same gray area but cleanest posture (not buying bypass) | fallback |
| **Apify** (actor platform) | No verified fit — no BMS/District actor exists | Weak–medium, build-it-yourself | $5/mo credit + $8/GB residential (not included) | High once you add residential+stealth | **avoid** ⬇ *(downgraded from investigate)* |
| **Bright Data** Web Unlocker / Scraping Browser | Partial (most capable web) | Strongest vs Akamai (bought, not owned) | Not free in practice; per-success billing | **Highest** — paying explicitly to bypass = worst s43/s66 posture | avoid |
| **Zyte API** | Partial | Medium–strong (managed anti-ban) | $5 trial; Akamai = expensive high tier | High (paying to circumvent) | avoid |
| **ScrapingBee / Scrapingdog / ScrapingAnt** | Partial → likely-fails (ScrapingAnt ~31–35% on protected) | Medium–weakest | No/low free tier; stealth tiers costly | High on stealth/CAPTCHA path | avoid |
| **Browserless** (hosted headless) | Partial (you script it) | Medium (you supply proxies) | Free 1K units/mo + proxy cost | High-ish (built-in bypass) | fallback |
| **Playwright / Puppeteer self-host** | Yes (web surfaces); District app inventory unreachable | Weak default; needs residential/mobile proxy to last | Free SW (~$0 on existing VPS) + proxy ~$3–12/GB | Same gray area; lowest-risk *posture* if self-hosted | **fallback (the operable server-side option)** |
| **Browser extension** (content script in user's own logged-in Chrome) | Partial (web only) | Detection half-flips (real IP/TLS) BUT behavioral/intent detection still flags polling; flagship BMS extension was removed from Chrome store | Free to run; Chrome-store review + maintenance burden | Shifts ban risk onto the *user's own account/IP* | **fallback — one-off "check now" helper only, NOT a 24/7 watcher** ⬇ *(downgraded from investigate; "defeats anti-bot by construction" claim did not hold)* |
| **Browserbase + Stagehand / Steel.dev (hosted)** | Partial | Shared datacenter IP pools — blocked *faster* than one residential IP | Recurring SaaS + proxy GB | Same; adds US third-party processor | avoid |
| **Browser Use / Skyvern** (AI browser agents) | Partial | Same Chromium fingerprint as Playwright — *no* anti-bot benefit | Free SW + per-check LLM token cost | Same | avoid — AI layer adds cost/latency/nondeterminism; a boolean check needs zero reasoning |
| **n8n HTTP Request node — as the FETCHER** | No (no JS render; raw Node TLS fingerprint) | Weakest — fails at handshake; datacenter IP flagged | Free | High once you add proxies to make it work | **avoid (as fetcher)** ⬇ *(downgraded from recommend)* |
| **n8n — as ORCHESTRATOR / NOTIFIER** | n/a (host, not fetcher) | n/a | **Free — already self-hosted** | None (no scraping) | **recommend (host role only)** |
| **n8n + Playwright community node** (separate worker) | Partial–yes (capability) | Medium, decaying; needs residential proxy + jitter | Free node + proxy + RAM | Higher (full browser automation) | fallback |
| **n8n + managed anti-bot API** (ZenRows/Scrapfly) | Yes (capability) | Strongest of self-host options (vendor absorbs arms race) | Not free at steady state; trials ~1,000 cr | High — third-party extraction on Zwapit's behalf doesn't cure ToS/s43 | fallback |
| **Automa / Robocorp / UiPath / Power Automate / Make / Zapier** | No / wrong-shape | Same Akamai ceiling, no edge | UiPath Community is **non-commercial only**; PAD/Make useful modes are paid | Same or worse (UiPath license breach) | avoid |

## 4. Recommended approach — crawl as ASSIST, never primary

**Architecture: Hybrid — non-crawler signals are the primary truth source; a crawl is at most a timing tiebreaker; an official deep-link is always the payoff.** Any crawl-primary design fails both binding constraints, so the product promise must ride on signals that are organic, free, and zero-legal-risk.

**Truth-source order (highest → lowest):**
1. **Community corroboration** — a seller listing the show, or a requester reporting "it's open," is native to a marketplace, costs $0, and carries no ToS/scraping exposure. Strongest non-crawler signal. (Gameable — rate-limit, reputation-weight, ideally cross-check against an actual listing.)
2. **Admin "mark live"** — a human curator flips status for high-demand titles.
3. **On-demand rendered check** — fires **ONLY** when an active alert exists for that `monitor_target`. **Never scheduled/cron polling** — that is exactly the pattern that got the old notifier blocked and maximizes footprint + legal exposure.
4. **Official deep-link** — always present as the payoff ("Check on BookMyShow/District"). Because Zwapit never claims to be the authoritative "open" source and always sends the user OUT to book, a missed or blocked check degrades gracefully and the whole feature de-risks.

**Concrete mechanics:**
- **Shared `monitor_targets`** collapses many alerts on one show to ONE watcher. Collapse key = catalog id + venue + date + showtime + format. One watcher notifies all subscribers.
- **`snapshotHash`** hashes a **NARROW extracted region** (the specific showtime row / book-button state), NOT the full page — BMS/District pages churn ads/counters, so a whole-page hash would false-fire constantly.
- **Per-target cache + TTL** — serve cached state to new subscribers without re-fetching.
- **Exponential backoff** on 403/challenge; raise the interval floor; on repeated block, flip the target to **degraded mode** (suppress the check, fall back to community/admin signals + deep-link CTA).

**Where a crawler fits (and where it does not):**
- **n8n (already self-hosted) is the ORCHESTRATOR/NOTIFIER** — scheduling the on-demand jobs, dedup via `monitor_targets`, fan-out to Email + Web Push (then Telegram). **The fetch must NOT originate from n8n's datacenter IP** — Cloudflare/Akamai block it first.
- **Firecrawl earns no slot — avoid.** It adds a fast-burning paid Stealth dependency without solving Akamai durability and cannot cover District's app-only signal.
- **If a rendered check runs at all, pick ONE fallback fetch layer:** (a) **self-host Playwright on a SEPARATE worker** (not the prod n8n box) with residential/mobile proxy + jitter — the lower-risk *posture* because you own the blocked IP rather than buy bypass; or (b) **n8n → managed anti-bot API** (ZenRows/Scrapfly) — more reliable, modest recurring cost, but a third-party extracts on Zwapit's behalf.
- **Do NOT buy Web-Unlocker-class bypass** (Bright Data, Zyte high tier, stealth-proxy tiers) — the capability that makes them best technically makes them worst legally.

**Guardrails (non-negotiable):** low rate, real-user-triggered only, respect robots.txt, **no anti-bot-defeating tactics against the official sites**, and **rip the crawl out the moment any official/affiliate feed appears.** Keep the deep-link-out watcher architecturally and narratively SEPARATE from Zwapit's protected-payment community-resale leg (only the resale leg shares DNA with scalper targets).

## 5. If you DO crawl — the least-risky way

**Do:**
- **Real-user-triggered only** — a check fires solely because a real user set an alert. No cron sweeps, no pre-population.
- **Low rate + human cadence + jitter** — one shared watcher per show, collapsed via `monitor_targets`.
- **Respect robots.txt** — read ONLY the public showtime URL; never `/payment`, `/order`, `/checkout`, `/bookings`, `/confirmation`. Codify "never request a Disallow path" and auto-halt if a target path becomes Disallowed or goes behind auth. Re-check robots.txt on a schedule (it can tighten and flip from shield to evidence-against).
- **Never log in / never accept a clickwrap** — keep any ToS binding at the weaker browsewrap level.
- **Boolean availability only** — store ONLY `{showId, open:boolean, checkedAt}`. Never cache, store, or display BMS/District content, prices, seat maps, or artwork (stay clear of OLX). Show users your own catalog (TMDB/curated) + a deep-link.
- **Deep-link OUT** — always route the user to the official site to book; never resell official inventory or touch that money.
- **Kill on block** — degrade gracefully to community/admin signals + manual deep-link; treat detection-and-block as *expected*, not a bug to defeat.
- **Audit everything** — internal-only mutations, audit logs proving the watcher only notifies and links out. No client-exposed matching mutations.
- **Isolate the fetcher** on a separate worker (never the prod n8n box — headless Chromium can RAM/CPU-exhaust the founder's live blog + FB-ads workflows).

**Do NOT:**
- Schedule fixed-cadence polling regardless of alerts (the pattern that killed the prior notifier).
- Add residential-proxy rotation, CAPTCHA-solving, or fake accounts *for the official sites* — these cost money AND manufacture the s66 "dishonest intent" that is currently absent.
- Make the crawl the load-bearing/authoritative availability source.
- Pay a vendor for bypass-as-a-service against BMS/District.
- Cache or surface scraped showtimes/prices/seat maps as Zwapit's own content.
- Run the fetcher from n8n's datacenter IP.

## 6. Cost at MVP

**Target and realistic outcome: $0 marginal.**
- **Orchestration/notification: $0** — reuse the founder's existing self-hosted n8n (scheduling, dedup, Email/Web-Push/Telegram fan-out).
- **Primary signals: $0** — community corroboration + admin mark-live + official deep-link involve no scraping and no third-party spend.
- **Optional on-demand rendered check:** only fires on a real alert, and `monitor_targets` collapse keeps volume to tens-to-hundreds of checks/day. Free tiers (Firecrawl ~500–1,000 cr/mo *if used* — not recommended; Browserless 1K units/mo; ZenRows/Scrapfly ~1,000 trial credits; Playwright is free MIT software) cover this comfortably **until** datacenter IPs get blocked.
- **The only real recurring cost** is residential/mobile proxy bandwidth once datacenter IPs are flagged: residential ~$1.75–8/GB, mobile ~$15–30/GB (2026 snapshots — **unverified**, re-check at build). At a boolean-check workload, GB usage is tiny — but this is precisely the spend that erodes the "free" premise *and* worsens legal posture, so prefer graceful degradation over funding proxies.

**Bottom line:** build the MVP at $0 by keeping the crawl non-load-bearing. Spend money only if you accept the legal trade-off, and even then it buys fragile, decaying durability — not reliability.

## 7. Open questions / verify before build

1. **Clickwrap walk (highest priority).** Does merely *viewing* a BMS/District showtime page force an "I Agree" / login wall? robots.txt paths and public browseability were verified, but the wall was **not interactively walked**. If a clickwrap gate exists on the view path, the ToS-breach risk jumps from weak (browsewrap) to strong (enforceable contract) and the s43 "without permission" argument strengthens.
2. **Live BMS/District probe.** No candidate has any BMS/District-*specific* verified success — all "BookMyShow scraper" pages found (actowiz, realdataapi, arctechnolabs) are DaaS marketing, not working products; there is no BMS/District actor in the Apify store. Load-test the chosen fetch layer against the live target before relying on it.
3. **District web vs app inventory.** Confirm whether `district.in/movies/` exposes the SAME real-time availability as the District app, or whether key shows are app-only behind cert-pinning/attestation. If app-gated, **no web tool can check District at all** (would need Appium/mobile automation — heavier, higher-risk, not recommended).
4. **Anti-bot vendor confirmation.** "BMS is Akamai-fronted" is asserted, not independently confirmed for the live India endpoints; District's specific anti-bot vendor (Akamai vs Cloudflare vs DataDome vs PerimeterX/HUMAN) is **unverified**. The durability conclusion holds regardless (overdetermined by the IP-block precedent + ticketing being a top-tier bot target).
5. **The contested Sept-2024 legal claims.** The "BMS police complaint against resellers" was actually filed *against BMS* and *closed*; the "Zomato Live notices against resellers" claim is **unsourced/unverified**. **Do not cite either as precedent.** Confirm the current enforcement climate with India counsel rather than relying on these.
6. **Maharashtra mandate reach.** The Dec-2024 detect-and-report mandate is state-issued and concert-centric; its reach to routine *movie* availability checks and to other states is unsettled and likely to expand. Monitor.
7. **India counsel sign-off on the one crux question:** does an automated, no-login, no-republishing, public boolean read constitute access "*without permission*" under IT Act s43? This is the unresolved point worth a paid Indian tech-lawyer opinion before scaling. India has no on-point judgment applying s43 to a public-page read or ruling on ToS-scraping-clause enforceability — **do NOT import US CFAA/hiQ "public data" reasoning.**
8. **Verbatim ToS clauses.** BMS/District anti-bot/anti-automation clause wording was not fetched verbatim — confirm before relying on the browsewrap characterization.
9. **2026 pricing/free-tier drift.** All proxy and scrape-API figures are 2026 snapshots, several from secondary review sites (Bright Data trial gating, ScrapingAnt success rate, ZenRows/Scrapfly INR pricing, Robocorp's post-Sema4.ai free tier) — re-verify on vendor pages before committing.
10. **`snapshotHash` region brittleness.** If BMS/District change the DOM around the showtime row, the narrow extractor silently breaks (false-fires or goes dark) — needs monitoring + a fast selector-update path.
11. **Reputational conflation risk.** If press or platforms conflate Zwapit's deep-link-out watcher with scalper bots, harm lands regardless of legal merit — pre-stage clear public positioning ("notify + send you to the official site to buy at face value") and keep the watcher cleanly separated from the resale leg.

---

## 8. AI search tools (Parallel AI etc.) — where they fit and where they don't

<!-- Source: background workflow wf_b1e3dc32-124 (run wnqdbab6b) — research + adversarial verification, 2026-06-22. Answers the founder's specific question: can an AI SEARCH tool (they named Parallel AI / parallel.ai) "check and verify if tickets are open on certain URLs"? Verifications corrected several first-pass verdicts; corrected verdicts are used here. All dollar figures are 2026 snapshots, several aggregator-sourced — marked unverified where so. -->

### 8.0 EMPIRICAL UPDATE — live API test (2026-06-22) — CORRECTS the predictions in §8.1/§8.2

The founder supplied a live Parallel API key; I ran direct calls. The results **materially correct** the §8.1/§8.2 prediction that Parallel Extract would be blocked (403/empty) on BMS/District:

- **Search API (`POST /v1beta/search`, HTTP 200):** strong for the COARSE signal, as predicted — returned dated *"ADVANCE BOOKING NOW OPEN" / "tickets now LIVE on BookMyShow"* social posts and resolved real per-city BMS movie URLs (e.g. `in.bookmyshow.com/movies/mumbai-western/cocktail-2/ET00491386`).
- **Extract API (`POST /v1beta/extract`, HTTP 200) — NOT blocked.** It returned real content from `in.bookmyshow.com` (8 KB) and `district.in` (45 KB), contradicting the "avoid / 403 / empty" verdict in the table below.
- **It reached per-theatre, per-showtime detail (the FINE signal §8.1 said no tool could deliver).** Extracting the **dated buytickets URL** `…/buytickets/cocktail-2-mumbai/movie-mumbai-ET00491386-MT/20260622` returned **53 showtimes, 15 cinema references, and live status words (filling-fast / sold-out / available)**. (The movie *detail* page and the *un-dated* buytickets URL returned 0 showtimes — the **dated buytickets URL** is the one that yields the showtime grid.)

**Corrected verdict: Parallel Extract CAN technically retrieve BMS movie + showtime availability today.** Four caveats remain decisive:

1. **FRESHNESS — the critical open risk (UNCONFIRMED).** Parallel caches by default. A hint of staleness: the returned showtimes page led its date strip with **SUN 21 JUN** although the test ran **Mon 22 Jun** — consistent with a ~1-day-old cached snapshot. For an alert whose whole value is "tickets *just* opened," a day-stale answer causes false/missed alerts. **Must** be tested with a forced-fresh fetch compared against the live site before any reliance.
2. **Legal/ToS UNCHANGED.** Parallel reaching BMS's booking page is still a third party fetching ToS-protected pages *on Zwapit's behalf* — the §5/§7 IT Act s43 exposure stands, and the `/buytickets` path is deeper into the booking flow (re-check BMS `robots.txt` for `/buytickets`). **Capability ≠ permission.**
3. **District deep pages UNCONFIRMED.** Generic `district.in/movies` extracted (45 KB) but a guessed `district.in/movies/mumbai` returned 404; District remains app-first with unverified deep-URL structure.
4. **Cost / durability.** Each full extract ≈ 2 SKU units (per-query pricing); and one success now ≠ durable — Parallel's crawler IPs could be blocked by BMS later.

Net change to the recommendation: Parallel Extract moves from "avoid" to a **viable candidate for the availability check — gated entirely on the freshness test and a legal/ToS sign-off.** The §4 architecture (community/admin primary, deep-link-out payoff, real-user-triggered, `monitor_targets` dedup) is unchanged; Parallel would slot in as the rendered-check fetch layer **if** freshness proves out — replacing the self-host-Playwright option in §4 with less ops burden but the same ToS posture.

### 8.0.1 Freshness + cost — resolved by test (2026-06-22)

**Freshness is controllable — proven.** Extract caches by URL. A plain call to the dated buytickets URL returned a **stale snapshot from the previous day** (date strip led with *SUN 21 JUN* although the test ran **Mon 22 Jun**; 205 showtimes). Appending a unique cache-bust query param — `…/20260622?cb=<timestamp>` — forced a **fresh same-day crawl** (date strip led with *MON 22 JUN*). So the watcher must **cache-bust every poll** to get live data; the default is stale.
- No documented freshness param works: `fetch_policy:"live"` → HTTP 422 (rejected); `freshness` / `max_age_seconds:0` / `cache:false` → accepted but **ignored** (still returned the stale strip). The reliable lever is the **cache-bust query string** (undocumented — could change).
- **Render-completeness wrinkle:** the fresh crawl returned fewer showtimes (53) than the cached one (205). Enough to answer "open? + which theatres," but exact per-showtime counts vary by render — validate if precise seat-level data is needed.

**Real pricing (parallel.ai/pricing, verified 2026-06-22):** **Extract API = $0.001 per URL**; Search API = $0.005 / 10 results. Cheap mode confirmed: an **excerpts-only extract still carries all showtimes and bills 1 unit** (`full_content` adds a 2nd unit) → a live check costs ~**$0.001**.

**Cost model** — 1 check = 1 cache-busted Extract of the movie+city+date URL = **all theatres at once**:

| Scenario | Polls | Cost |
|---|---|---|
| One check | 1 | ~$0.001 |
| Catch one movie-open, tight ~3 h window @ 5-min | ~36 | ~$0.04 |
| Catch one, wide 12 h/day × 2 days @ 5-min | ~288 | ~$0.29 |
| Naive 24/7 @ 5-min for 2 days | ~576 | ~$0.58 |
| MVP: ~100 movie-targets / month (windowed) | ~30k | **~$30/mo** |

ET-code resolution via Search is one cached call per movie (~$0.005) — negligible. Parallel reportedly grants startup credits, so early testing may be $0 (unverified).

> The subsections below (§8.1–§8.5) are the pre-test research. Where they say Extract is blocked/avoid, **§8.0 supersedes them.**

### 8.1 Direct answer

**Split the question, because the answer flips.** For the COARSE signal — "has Movie X opened for booking in India *at all*, per a public announcement / news / listing?" (hours-to-days freshness is fine) — yes, an AI search tool is a legitimate, cheap *assist*: it queries the open web (news, social, aggregator pages), never BMS/District internals, so anti-bot and ToS are not in the path. For the FINE signal — "is THIS theatre's 9:30pm show bookable *right now*?" — **no AI search tool can do this reliably or acceptably.** There are only two mechanisms and both fail (b): index-backed tools (Parallel Search/Monitor, Exa /search, Brave, SerpApi, Perplexity, Gemini-grounding) read a crawl/SERP index that is **stale by design** and never reads the live BMS page; the only true live-fetch-a-named-URL paths (Parallel Extract, Exa /contents `maxAgeHours=0`, Tavily /extract) hit the **same Akamai IP-reputation + TLS-fingerprint wall** that killed the old BMS notifier (§2), and a third party fetching on Zwapit's behalf **does not cure the ToS/legal exposure**. And any LLM-synthesised "yes, it's open" (Perplexity Sonar, Gemini grounding, Parallel Task) is a probabilistic claim that must *itself* be verified — so it cannot *be* the verification gate.

### 8.2 Tool comparison

(b) = the fine, per-showtime live gate the founder actually asked about. "recommend-coarse" means: usable for (a) title-level discovery only, **never** for (b).

| Tool | Mechanism (index vs live-fetch) | Fresh enough for live state (b)? | Anti-bot on BMS/District | Raw or LLM answer | 2026 cost (free tier) | Verdict |
|---|---|---|---|---|---|---|
| **Parallel Search API** | Own crawl INDEX; optional forced live-fetch (`fetch_policy`, **10-min freshness floor**) | No — 10-min floor + booking flips faster | Live-fetch path = ShapBot crawler with *published IPs* → textbook firewall/Akamai block, then **silent stale-cache fallback** | RAW ranked URLs + excerpts | ~$0.005/req (10 results); free ~16k req + startup credits *(free tier unverified)* | **recommend-coarse** |
| **Parallel Extract API** | LIVE-FETCH a named URL; **cached by default** | No — default cached; forced-live hits the wall | Not an anti-bot product ("any *public* URL"); 403/empty on protected pages | RAW markdown (only if fetch succeeds) | ~$0.001/URL | **avoid** ⬇ *(downgraded from "investigate")* |
| **Parallel Monitor API** | Always-on query over the INDEX; **hourly cadence floor** | No — hourly poll, index-biased | Same fetcher limits; monitors public pages only | LLM-synthesised "something changed" event | $3–$10 / 1k executions | **recommend-coarse** (cheap "now listed" assist) ⬆ *(was "fallback")* |
| **Parallel Task API** (deep research) | Agentic fan-out + LLM synthesis; 10s–2hr async | No — latency alone disqualifies | Sub-fetches of BMS silently fail | LLM-SYNTHESISED (highest hallucination risk) | $5–$100+/1k runs | **avoid** |
| **Exa** (/search + /contents) | DUAL: /search = neural INDEX (stale); /contents `maxAgeHours=0` = true live-fetch | /search no (stale); /contents fresh-in-principle but blocked | /contents is below Firecrawl on the bypass ladder → 403/empty on BMS; /search never touches BMS | RAW by default (/answer adds LLM) | search ~$7/1k, contents ~$1/1k; **20k req/mo free (recurring)** | **recommend-coarse** (/search only; /contents = avoid) |
| **Tavily** (/search + /extract) | DUAL: /search index+scrape; /extract = live-fetch up to 20 named URLs | /search no (stale); /extract blocked or hollow (empty on JS SPAs) | /extract not in bypass class → 403/empty on BMS/District | RAW by default | free 1k credits/mo; PAYG ~$0.008/credit | **recommend-coarse** (/search only; /extract = avoid) |
| **Perplexity Sonar API** | SERP-mediated search + LLM synthesis; **not a URL fetcher** (`search_domain_filter` only steers results) | No — search-mediated, summarised | N/A (never fetches BMS) → indirect + stale | LLM-SYNTHESISED (~37% citation-hallucination) | tokens + ~$5–$14/1k request fee *(aggregator, unverified)* | **recommend-coarse**, caution ⬆ *(was "fallback/avoid"; only as a lead, never a trigger)* |
| **Brave Search API** | Own independent INDEX (~40B pages); no live-fetch | No — index latency, shell-only on BMS | N/A (own index; crawler uses generic UA → thin BMS index) | RAW results (LLM summary if opted in) | Web search ~$5/1k; **dedicated free tier removed Feb 2026**, only ~$5/mo renewing credit | **recommend-coarse** |
| **SerpApi** | Real-time scrape of GOOGLE's SERP (not BMS); fixed engine catalog | No — Google's crawl of BMS lags; cannot fetch a BMS URL at all | N/A vs BMS (hits Google, not BMS) — do **not** mislabel "blocked" | RAW structured JSON | free 100–250/mo *(sources conflict, unverified)*; paid ~$25/1k | **recommend-coarse** (raw-SERP fallback) ⬆ |
| **Google Vertex / Gemini grounding** | LLM synthesis grounded in Google's INDEX; separate URL-context tool exists but same wall/ToS | No — index-bounded + probabilistic | N/A for grounding (own index); URL-context tool would hit the wall + ToS | LLM-SYNTHESISED with citations | ~$14/1k grounded queries (Gemini 3) + token fees; ~5k/mo free | **recommend-coarse**, pricier/redundant |

⬇/⬆ mark where the adversarial verification **downgraded or upgraded** the first-pass verdict. The two consequential downgrades: **Parallel Extract → avoid** (default-cached + not an anti-bot product), and treating any **live-fetch / extract path on BMS/District as avoid** regardless of the parent tool's coarse verdict.

### 8.3 The right role — coarse discovery enrichment, never the live gate

AI search belongs in exactly one slot: a low-trust, title-level **"has booking opened in India" discovery trigger** that feeds the existing confirmation pipeline (§4) — which then deep-links the user OUT to confirm on the official site. It is **not** the per-theatre live gate, and on the COARSE signal it **ranks below the free announcement stack the founder already runs.** Ranking for (a), best to worst:

1. **Community corroboration** — a real user reporting "it's live" is the cheapest and freshest title-level truth (already §4's primary).
2. **Existing n8n RSS + Google-Alerts feeds** — free, already built, already watching the core sources.
3. **Email subscribe-and-parse** of official "now booking" mailers — free, near-official.
4. **TMDB release-date prediction** — free, deterministic timing to pre-arm the watch window.
5. **— only here —** a paid AI search query, as ad-hoc coverage for the **long tail** of titles / regional sources the RSS feeds don't already watch.

**When (if ever) paying for an AI search query beats the free stack:** only when long-tail or regional-source discovery becomes a *measured* gap that community + RSS + email + TMDB demonstrably miss. Until then it largely **duplicates a free stack the founder already operates**, at a few tenths of a cent per query. Practical call on a startup budget: **skip paid AI search for now.** If one is ever adopted, prefer a RAW-result tool (Parallel Search ~$0.005/req, or Brave/SerpApi raw SERP) over an LLM-synthesis tool (Perplexity Sonar, Gemini grounding) — a raw excerpt you parse yourself avoids hallucinating a yes/no on a gate.

### 8.4 If used — the rules

- **Title-level only.** Ask "has Movie X opened for booking in India per a public announcement?" — never "is this 9:30pm show bookable now?" The tools cannot answer the second.
- **Treat the answer as a HINT, not truth.** Frame outputs as "BMS opened, per a public announcement," never "the tool checked BMS." Confirm every positive via deep-link / real-human / admin signal before any user-facing "tickets are live."
- **Never display a synthesised "it's open" as authoritative.** Sonar's ~37% citation-hallucination (real URLs, fabricated claims) is a false-promise risk to a buyer.
- **Never point a live-fetch/extract primitive at in.bookmyshow.com / district.in.** Outsourcing the fetch to Parallel Extract / Exa /contents / Tavily /extract still scrapes a ToS-protected site on Zwapit's behalf and hits the same wall — same posture as §5's "do not buy bypass."
- **Mind per-query cost at watcher scale.** These are per-query priced; keep them on the long-tail discovery trigger behind `monitor_targets` dedup, not on a per-showtime poll.

### 8.5 Open questions / verify before build

1. **Will Parallel/Exa/Tavily even fetch BMS, or just skip it? — UNVERIFIED, inferred not tested.** The "blocked on BMS" verdict for every live-fetch path (Parallel Extract, Exa /contents, Tavily /extract) is inferred from the §2 BMS-notifier IP-block + the confirmed fact that these are basic extraction fetchers with no TLS-spoofing / residential-rotation / challenge-solving — **not** a fresh live probe (probing BMS is itself blocked/ToS-risky). The cheap decisive test *before any dependence*: one Parallel Extract call (~$0.001) and one Exa /contents call against a real `in.bookmyshow.com` showtime URL and a `district.in` URL — observe 403/empty vs real content. Expect failure or silent stale-cache.
2. **Free-tier specifics — UNVERIFIED.** Parallel "~16k free requests + up to $250 startup credits" is from a 2026 third-party roundup, not a canonical Parallel pricing line; Brave's dedicated free tier was *removed* for new users Feb 2026 (only ~$5/mo renewing credit, kept only with public attribution); SerpApi free tier conflicts (100 vs 250/mo). Re-confirm on each vendor's pricing page at build.
3. **Pricing is volatile and partly aggregator-sourced — UNVERIFIED.** Perplexity's per-request fee ($5–$14/1k) and several other figures came from aggregators, not official pages. Treat all dollar amounts as approximate; re-check before committing.
4. **India-source recall is UNVERIFIED.** Parallel/Exa claim India + 30+ country coverage, but depth/freshness on *Indian cinema* announcement sources is untested. Pilot against real titles before trusting coarse recall.
5. **ToS/legal is NOT cured by proxying the fetch.** Routing a BMS/District fetch through any third-party tool still accesses *their* site; legal cover does not transfer to Zwapit. India-specific contract / IT Act s43 exposure (per §7.7) should get counsel review before any fetch-based approach is ever attempted — do not import US CFAA/hiQ "public data" reasoning.
6. **LLM answers were assessed from product/pricing docs, not a live booking-open test.** If a synthesis tool (Sonar / Gemini grounding / Parallel Task) is ever used for (a), always cross-check against the raw cited source, never the synthesised claim.
