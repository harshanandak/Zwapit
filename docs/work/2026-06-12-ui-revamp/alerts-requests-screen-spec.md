# Zwapit — "Alerts + Requests" Screen Specification (build-ready)

Hand-code an HTML/CSS mobile preview from this spec, reusing the existing design-system vocabulary verified in `docs/work/2026-06-12-ui-revamp/zwapit-ui-revamp-preview.html`.

## Global conventions (apply to every screen)

- Shell: `.stage` (ambient `--acc` glow) → `.phone` (metal-rim frame) → `.screen` (scroll) with `.statusbar` on top. Per-screen accent set via `--acc`.
- Type: Fraunces (`--font-d`) for display headings, `.wordmark`, and prices (`.price-d`) ONLY. Space Grotesk (`--font-b`) for all UI text.
- Color discipline: rose `--rose` is the ONLY money/action color (`.btn-primary`, Buy CTAs). jade=protection, gold=deadlines/tickets/plans, steel=transfer/sell, bronze=requests, violet=home.
- Surfaces: `.gl` (glass) for fixed chrome + hero/feature cards; `.solid` for scrolling list rows; `.metal` for money moments; `.sweep` ONLY on the primary "Buy with Protection" CTA.
- Bottom chrome on every screen: `.bnav` with 5 items — Home, Search, Requests, Listings, Profile — using `i-home`, `i-search`, `i-bell`, `i-ticket`, `i-user`. **No center Sell tab.** A `.sellbtn` FAB pill ("List a ticket", `i-plus`) floats above `.bnav`, right-aligned, on Home / Search / Listings / Profile. Selling is also reachable from the Profile Selling hub.
- Icons: stroke-only `.ic` SVG via `<use href="#i-…">`. No emoji.
- Chips: `.chip` with variants `.protect` (jade, protection), `.mode` (steel, transfer mode), `.live` (gold, tickets-live/official), `.wait` (bronze, people-looking / status), `.req` (bronze, request state).
- Microcopy rules: premium, composed, benefit-first. No exclamation marks anywhere except the single official-alert title "Tickets are live". Banned user-facing words: escrow, settlement, dispute, merchant, fulfilment, entitlement, KYC, demand, allotment, queue, reverse listing. Use "people looking" / "interest", "Priority", "report window", "protected payment".

### Proposed NEW component classes (named + described; no CSS here)

- `.quota` — quota meter row: label + thin track bar + count. Used on Requests + Profile ("2 / 3 active requests").
- `.alert-card` — alert payoff card; a `.gl` panel with a left accent rail (jade for community match, gold for official). Holds icon, title, sub, CTA.
- `.wave-pill` — small status pill for alert waves: Standard / Priority / High Priority. Visual tier via fill weight, never a number.
- `.zone-tab` — Home zone toggle ("Official tickets" / "Community listings"); reuses `.seg` look if preferred.
- `.notify-btn` — compact bell affordance on official poster/rows ("Notify me", `i-bell`); ghost until armed, then jade-tinted "Alert on".
- `.demand-band` — seller demand-signal banner (reuse `.buyerwait` if its layout fits; otherwise this). bronze, shows "52 people looking · High interest", NO buyer info.
- `.drop-sched` — auto price-drop schedule control: enable toggle + amount stepper + interval stepper + plain-language preview line.
- `.tier-card` — Free/Plus tier card with referral progress bar (gold).
- `.compare` — two-column Free vs Plus comparison grid for Plans.
- `.ladder` — referral rewards ladder (vertical steps).
- `.chan-row` — notification-channel toggle row (Email/Push/Telegram/WhatsApp).
- `.disc` — verified-discount line/badge ("20% off · was ₹X"), rendered ONLY when original price is verified; otherwise show `.seller-price` label ("Seller price").

### Friendly icon-id set (reuse existing + add)

Existing (reuse): `i-home i-search i-bell i-ticket i-user i-film i-music i-bus i-pin i-clock i-shield i-spark i-star i-trophy i-up i-zap i-eye i-route i-signal i-check i-x i-plus i-minus i-chev i-arrow i-back`.
Add: `i-tag` (discount), `i-drop` (price-drop), `i-trend` (trending), `i-voucher`, `i-pass`, `i-bolt-last` (last-minute), `i-gift` (referral), `i-mail`, `i-upload`, `i-edit`, `i-filter`, `i-people` (people looking), `i-crown` (Plus).

---

## 1. Home — accent `--violet`

(a) Accent: violet. (b) Sections top→bottom:

1. `.statusbar`.
2. `.home-top` (`.gl`): `.wordmark` "Zwapit" + `.city` ("Bengaluru", `i-pin`) left; `i-bell` notifications icon right.
3. Hero line: `.divider` "TELL US WHAT YOU WANT" then `h1` (`--font-d`) "We'll notify you when it's available." + sub (`.dim`) "Track official tickets and community resale in one place."
4. `.req-cta` (violet→bronze feel, `.gl`): icon `i-bell`, title "Set an alert", sub "Pick a show, a budget, the alerts you want." Button `.btn` "Create a request".
5. `.trust-band` (`.protect`/jade): `i-shield` "Protected payment on every purchase. Your money is held safely until transfer is confirmed."
6. Zone toggle `.zone-tab` (or `.seg`): "Official tickets" | "Community listings".
7. ZONE A "Official tickets": `.divider` "OFFICIAL TICKETS" with category `.chips` row — Movies (`i-film`), Events (`i-music`), Bus (`i-bus`). `.carousel` of `.poster-card` items; each card has `.art`/`.poster`, `.when`, `.body`/`.meta`, and a `.notify-btn` ("Notify me", `i-bell`) instead of a price `.go`. Helper under one card: `.wait` chip "You + 124 others waiting".
8. ZONE B "Community listings": `.divider` "COMMUNITY LISTINGS" + sub-`.seg` "Latest · Discounted · Trending". `.carousel`/`.rowcard` list; cards show `.disc` ("20% off · was ₹X") when verified else `.price` "Seller price", `.chip.protect` "Protected", `.chip.mode` (transfer mode), `.seller-tick`.
9. `.sellbtn` FAB "List a ticket" (`i-plus`) above `.bnav`.
10. `.bnav` (Home active).

(c) Microcopy: hero "We'll notify you when it's available."; CTA "Create a request" / "Set an alert"; trust "Protected payment on every purchase."; zone labels "Official tickets" / "Community listings"; "You + 124 others waiting for this show"; notify "Notify me" → armed "Alert on". (d) Glyphs: `i-bell i-pin i-shield i-film i-music i-bus i-tag i-trend i-plus i-home i-search i-ticket i-user`.

---

## 2. Search — accent `--steel`

(a) Accent: steel. (b) Sections:

1. `.statusbar`.
2. `.topbar` with `i-back` + page title "Search".
3. `.searchbar` (`.gl`, `i-search`): placeholder "Search movies, events, bus, vouchers, passes".
4. Category `.tabrow` (underlined): Movie · Event · Bus · Voucher · Pass (glyphs `i-film i-music i-bus i-voucher i-pass`).
5. Filter chips row `.chips`: Price (`i-tag`), Date (`i-clock`), Location (`i-pin`), Source (`i-signal`), Category (`i-filter`). Active filter chip filled steel.
6. Source toggle `.seg`: "All · Official · Community".
7. Results: `.rowcard` list (`.solid`). Official rows carry `.chip.live` "Official" + `.notify-btn`; community rows carry `.chip.protect` "Protected", `.disc`/`.price`, `.seller-tick`.
8. Empty state (`.gl`, centered): `i-search` muted, "No matches yet", sub "We can watch this for you and alert you the moment it appears." Primary `.btn-ghost` (steel, not rose — no money moves) "Create a request instead".
9. `.sellbtn` FAB; `.bnav` (Search active).

(c) Microcopy: placeholder above; empty "No matches yet" / "We can watch this for you and alert you the moment it appears." / "Create a request instead"; source labels "All / Official / Community". (d) Glyphs: `i-search i-film i-music i-bus i-voucher i-pass i-tag i-clock i-pin i-signal i-filter i-bell`.

---

## 3. Create Request / Set an alert — accent `--bronze`

(a) Accent: bronze. (b) Sections:

1. `.statusbar`.
2. `.topbar`: `i-back` + "Set an alert".
3. Step strip `.steps`/`.step` (`.step-ln`): "Category → Item → Budget → Alerts".
4. STEP Category: `.tiles`/`.tile` grid — Movie (`i-film`), Event (`i-music`), Bus (`i-bus`), Voucher (`i-voucher`), Pass (`i-pass`). Selected tile gets `.sel`.
5. STEP Catalog item: `.searchbar` to find canonical item, then `.catres` rows (catalog results); selected row `.catres.sel`. For official movie show the canonical detail line: movie + theatre + date + time + language + format (e.g. "Dune · PVR Orion · Sat 21 Jun · 9:30 PM · English · IMAX 3D"). Event/Bus variants: event+venue+date / route+operator+date+time.
6. Social proof (official only) `.buyerwait` (bronze): `i-people` "You + 124 others waiting for this show". Helper `.dim`: "One alert, shared by everyone watching this show."
7. STEP Budget: `.formrow` + `.stepper` "Max price per ticket" (₹), quantity `.stepper` "Tickets", expiry `.formrow` "Alert me until" (date).
8. STEP Alerts: toggle list (`.chan-row` style) — "Availability" (`i-bell`), "Discount" (`i-tag`), "Price-drop" (`i-drop`), "Last-minute" (`i-bolt-last`). Each with one-line benefit sub.
9. Reassurance `.note` (`.dim`): "We'll alert you when this becomes available — booking is never guaranteed."
10. `.stickybar`: primary `.btn-primary` "Create request & alert me" (rose — sets up a money-capable flow). No `.sweep` here (reserve for Buy).
11. `.bnav` (Requests active).

(c) Microcopy: title "Set an alert"; steps "Category / Item / Budget / Alerts"; "Max price per ticket"; alert subs — Availability "Tell me the moment tickets are live", Discount "Tell me when the price drops below my budget", Price-drop "Track scheduled seller drops", Last-minute "Alert me close to showtime"; social "You + 124 others waiting for this show"; reassurance "booking is never guaranteed"; CTA "Create request & alert me". (d) Glyphs: `i-film i-music i-bus i-voucher i-pass i-bell i-tag i-drop i-bolt-last i-people i-clock i-back`.

---

## 4. Requests — accent `--bronze`

(a) Accent: bronze. (b) Sections:

1. `.statusbar`.
2. `.home-top`/`.topbar`: title "Your requests" + `i-plus` "New".
3. `.quota` meter: "2 / 3 active requests" with thin track. Sub `.dim`: "Free plan."
4. State filter `.seg`: "Active · Matched · Purchased · Expired".
5. `.reqcard` list (`.solid`; hot ones `.reqcard.hot`). Each card:
   - State `.chip.req` (Active) / `.chip.live` (Matched) / `.chip.protect` (Purchased) / muted (Expired).
   - Catalog summary line (`--font-d` small) + venue/date `.meta`.
   - Budget `.price` "Up to ₹420".
   - Enabled alert glyph row: `i-bell i-tag i-drop i-bolt-last` (lit = on).
   - `.matchrow`: "3 matches this week" (`i-spark`).
   - `.wave-pill` status: "Priority" / "Standard".
   - `.reqactions`: `.btn-ghost` "Edit" (`i-edit`), ghost "Pause".
6. Soft nudge card `.gl` (NOT dark-pattern): `i-gift` "Invite 3 verified friends → one extra request and earlier alerts." `.btn-ghost` "See referrals". Optional `.btn-ghost` (gold) "Compare Plus".
7. `.sellbtn` FAB; `.bnav` (Requests active).

(c) Microcopy: "Your requests"; "2 / 3 active requests"; states "Active / Matched / Purchased / Expired"; "Up to ₹420"; "3 matches this week"; wave "Priority" / "Standard"; nudge "Invite 3 verified friends → one extra request and earlier alerts." / "See referrals". (d) Glyphs: `i-plus i-bell i-tag i-drop i-bolt-last i-spark i-edit i-gift i-crown`.

---

## 5. Alert payoff / Match — accent `--jade` + `--rose`

(a) Accent: jade (protection lead), rose for the Buy action; gold rail on the official card. (b) Sections:

1. `.statusbar`.
2. `.topbar`: `i-back` + "Alerts".
3. `.divider` "JUST NOW".
4. OFFICIAL `.alert-card` (gold left rail, `i-ticket`): title "Tickets are live" (the ONLY exclamation-bearing line). Sub: "Dune · PVR Orion · Sat 21 Jun, 9:30 PM — official booking just opened." `.chip.live` "Official". CTA `.btn` (gold-tinted, not rose — leaves to external booking) "Open booking" (`i-arrow`). Helper `.dim`: "You + 124 others were alerted. Acting early helps — it's never a guaranteed seat."
5. COMMUNITY `.alert-card` (jade left rail, `i-spark`): title "A match for your request". Sub: catalog summary + "from a verified seller." Price block: `.price-d` "₹390", `.disc` "13% off · was ₹450" (verified only). Chips `.chip.protect` "Protected payment", `.chip.mode` "Official transfer". CTA `.btn-primary.sweep` "Buy with Protection" (rose — money moves; `.sweep` allowed here). 
6. Protection reinforcement `.trust-band` (`.protect`): `i-shield` "Your payment is held safely until the transfer is confirmed."
7. `.divider` "EARLIER" → muted past alert `.solid` rows.
8. `.bnav` (Requests active).

(c) Microcopy: "Tickets are live" (only exclamation); "Open booking"; "A match for your request"; "Buy with Protection"; "13% off · was ₹450"; protection "Your payment is held safely until the transfer is confirmed."; honesty "it's never a guaranteed seat." (d) Glyphs: `i-ticket i-spark i-shield i-arrow i-tag i-check i-back`.

---

## 6. Listings — accent `--rose`

(a) Accent: rose. (b) Sections:

1. `.statusbar`.
2. `.home-top`: `.wordmark`/title "Community listings" + `i-search`.
3. Section `.tabrow` (underlined, scrollable): "Latest · Trending · Discounted · Ending Soon · Near Me" (glyphs `i-clock i-trend i-tag i-zap i-pin`).
4. `.carousel`/grid of `.poster-card` listing cards (`.solid`). Each:
   - `.art`/`.poster` thumb + `.urgency` ("Starts in 2h", gold) when ending soon.
   - `.disc` badge "20% off" ONLY when original price verified; else `.price` label "Seller price".
   - `.pricerow`: `.price-d` "₹390", `.cut` "₹450" (verified only).
   - Chips `.chip.protect` "Protected", `.chip.mode` transfer mode (e.g. "Official transfer").
   - `.seller-tick` verified seller (`i-check`), seller name `.meta`.
   - `.go` chevron into detail.
5. `.sellbtn` FAB; `.bnav` (Listings active).

(c) Microcopy: title "Community listings"; tabs "Latest / Trending / Discounted / Ending Soon / Near Me"; "20% off" (verified) vs "Seller price"; "Protected"; transfer mode "Official transfer"; "Starts in 2h"; verified-seller tooltip "Verified seller". (d) Glyphs: `i-clock i-trend i-tag i-zap i-pin i-shield i-check i-chev`.

---

## 7. Listing detail — accent `--rose`

(a) Accent: rose. (b) Sections (keep existing trust grid):

1. `.statusbar`.
2. `.hero`/`.panel`: `.art`/`.poster`, title (`--font-d`), `.meta` (venue · date · time · format), `.chip.live` "Official transfer" or community context chip.
3. Price area `.pricelist`: `.price-d` "₹390"; `.disc` line "20% off · was ₹450" rendered ONLY when original price verified, else just "Seller price"; `.chip.protect` "Protected payment".
4. `.trust-grid` (existing) with four `.trust-cell`: Transfer mode (`i-route`, steel) · Payout shield (`i-shield`, jade, "Seller paid only after you confirm") · Transfer deadline (`i-clock`, gold) · Report window (`i-eye`, "48-hour report window").
5. `.sellerrow`: `.avatar`, seller name, `.rating` (`i-star`), `.seller-tick` "Verified".
6. Full price breakdown `.pricelist`: Ticket price ₹390 · Platform fee ₹10 + GST · "Total payable ₹402" (`.total`). Line "Refundable if the transfer isn't completed."
7. `.stickybar`: `.btn-primary.sweep` "Buy with Protection" (rose, `.sweep` allowed). Secondary `.btn-ghost` "Set a price-drop alert" (`i-drop`).
8. `.bnav`.

(c) Microcopy: "20% off · was ₹450" (verified only) / "Seller price"; trust cells "Official transfer", "Seller paid only after you confirm", "Transfer by Sat 9:00 PM", "48-hour report window"; "Total payable ₹402"; "Refundable if the transfer isn't completed."; CTA "Buy with Protection"; "Set a price-drop alert". (d) Glyphs: `i-route i-shield i-clock i-eye i-star i-check i-drop i-tag i-back`.

---

## 8. Sell / List a ticket — accent `--steel`

(a) Accent: steel. (b) Sections (upload-first):

1. `.statusbar`.
2. `.topbar`: `i-back` + "List a ticket". `.sell-steps`/`.sstep`: "Upload → Details → Price → Review".
3. `.dropzone` (`i-upload`): "Upload your ticket" / "Drop a screenshot or PDF — we'll read the details." `.fmt`/`.formats` chips: PDF · PNG · JPG.
4. `.demand-band` (reuse `.buyerwait`, bronze): `i-people` "52 people looking · High interest". Sub `.dim`: "We never share buyer details or budgets." (No buyer info, no budgets, no Priority numbers.)
5. Item confirm `.catres.sel`: parsed catalog summary (editable).
6. Price `.formrow`s: "Your price" (₹, `.stepper`), "Original price (optional)" with note "Verify to show a discount badge.", "Discount %" (auto-computed, read-only until original verified). Urgent toggle `.formrow`: "Mark as urgent" (`i-zap`) — adds an "Ending soon" surface.
7. OPTIONAL auto price-drop `.drop-sched`: enable toggle "Auto price-drop", amount `.stepper` "Drop ₹X", interval `.stepper` "every 30 min", boundary "before start time". Preview `.note`: "₹390 now → ₹360 at 6:30 → ₹330 at 7:00, stopping at start."
8. Eligibility `.tiles`/`.tile`: "Can list" (movies, events, bus, vouchers — `i-check`, jade) vs "Can't list" (`i-x`, muted) with one-liners.
9. "Your orders" peek `.order-metal`: compact recent sales row (`i-ticket`), `.btn-ghost` "View sales".
10. `.stickybar`: `.btn-primary` "Publish listing" (rose). `.bnav`.

(c) Microcopy: "List a ticket"; "Upload your ticket" / "Drop a screenshot or PDF — we'll read the details."; "52 people looking · High interest"; "We never share buyer details or budgets."; "Your price"; "Original price (optional)" / "Verify to show a discount badge."; "Mark as urgent"; "Auto price-drop" / "Drop ₹30 every 30 min before start."; eligibility "Can list" / "Can't list"; "Your orders" / "View sales"; "Publish listing". (d) Glyphs: `i-upload i-people i-zap i-drop i-tag i-check i-x i-ticket i-back i-plus i-minus`.

---

## 9. Profile — accent `--gold`

(a) Accent: gold. (b) Sections:

1. `.statusbar`.
2. `.home-top`: `.avatar` + name + phone-verified `.seller-tick` "Verified", `i-edit`.
3. `.tier-card` (gold, `.metal`): "Free plan" + `i-crown` "Compare Plus". Referral progress bar: "Invite 3 verified friends → earlier alerts" with `.fill` (1 of 3). `.btn-ghost` "Invite friends" (`i-gift`).
4. `.quota` recap: "2 / 3 active requests".
5. HUB "Buying" `.divider` "BUYING": `.tiles`/`.tile` rows — My Requests (`i-bell`), Saved (`i-star`), Purchases (`i-ticket`), Notifications (`i-bell`).
6. HUB "Selling" `.divider` "SELLING": `.tiles`/`.tile` — My Listings (`i-tag`), Sales (`i-trend`), Payouts (`i-shield`, "Paid after the buyer confirms"). Includes an entry "List a ticket" (`i-plus`) — the Selling hub entry point.
7. Notification channels `.chan-row` list: Email (on), Push (on), Telegram ("Soon", disabled), WhatsApp ("Soon", disabled).
8. Footer `.ghostlink` rows: Help, Protected-payment policy, Sign out.
9. `.bnav` (Profile active). `.sellbtn` FAB optional here (Selling hub already present).

(c) Microcopy: "Free plan" / "Compare Plus"; "Invite 3 verified friends → earlier alerts" / "Invite friends"; hubs "Buying" / "Selling"; "Paid after the buyer confirms"; channels "Email", "Push", "Telegram — soon", "WhatsApp — soon"; "Protected-payment policy". (d) Glyphs: `i-user i-edit i-crown i-gift i-bell i-star i-ticket i-tag i-trend i-shield i-mail i-plus`.

---

## 10. Plans & Referrals — accent `--gold`

(a) Accent: gold. (b) Sections:

1. `.statusbar`.
2. `.topbar`: `i-back` + "Plans & referrals".
3. `.divider` "CHOOSE YOUR PLAN".
4. `.compare` grid — Free vs Plus (Plus card `.metal`, gold, `i-crown`):
   - Active requests: "3" vs "Unlimited within fair use".
   - Alert timing: "Standard" vs "Earlier alerts".
   - Discount + price-drop alerts: "Included" vs "Included + sharper thresholds".
   - Status: `.wave-pill` "Standard" vs "Priority".
   - Plus CTA `.btn` (gold) "Upgrade to Plus".
5. App-store caveat `.note` (`.dim`): "Plus may be managed on the web for the best price."
6. `.divider` "REFERRAL REWARDS".
7. `.ladder` (gold steps, `i-gift`): "1 verified friend → +1 request" · "3 verified friends → earlier alerts" · "5 verified friends → occasional hold tokens". Progress `.fill`.
8. Alert-waves explainer `.gl` panel (`i-signal`): "How alert waves work" — three `.wave-pill`s Standard / Priority / High Priority, each with a plain line. Closing line: "Priority means you may hear earlier — never a guaranteed ticket."
9. `.btn-ghost` "Share my invite link" (`i-gift`).
10. `.bnav` (Profile active).

(c) Microcopy: "Plans & referrals"; comparison rows above; "Upgrade to Plus"; "Plus may be managed on the web for the best price."; ladder rewards above; "How alert waves work"; "Priority means you may hear earlier — never a guaranteed ticket."; "Share my invite link". (d) Glyphs: `i-crown i-gift i-signal i-spark i-check i-up i-back`.

---

## Build notes / guardrails recap

- One action color: `.sweep` appears ONLY on "Buy with Protection" (screens 5 & 7). "Create request & alert me" and "Publish listing" use `.btn-primary` without `.sweep`.
- `.disc` / "20% off" renders ONLY when original price is verified; otherwise "Seller price". Never invent a fake strike-through.
- Seller never sees buyer identity, budgets, or any Priority/number — only `.demand-band` "N people looking · interest level".
- Never promise booking. Honesty lines on screens 3, 4, 5, 10.
- Avoid all banned words in rendered copy (escrow, settlement, dispute, merchant, fulfilment, entitlement, KYC, demand, allotment, queue, reverse listing).
