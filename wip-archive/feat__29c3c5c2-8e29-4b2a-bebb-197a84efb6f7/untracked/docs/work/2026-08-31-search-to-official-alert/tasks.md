# Tasks: 29c3c5c2

## Plan
- [x] Grilling Q11-Q42 closed, Forge issue amended rev10
- [x] 4-lens local review (deepseek/muse/glm/hunyuan simulated) due to zen/Codex billing block
- [x] Design approved 9/10

## TDD
- [ ] RED: Search filtering/preselection + theatre single vs multi
- [ ] RED: Set an alert phone-verified vs anonymous, past date, missing city/format, duplicate rearm, theatre tier
- [ ] RED: Alerts payoff wiring with unsafe/missing bookingUrl, empty states, aggregated multi-theatre card
- [ ] RED: ZeptoMail sender unit + dispatchNotifications integration with bounce suppression
- [ ] GREEN: Search with labeled input + functional category/source filters over real catalog
- [ ] GREEN: Notify me preserves catalog id → Set an alert preselected
- [ ] GREEN: Set an alert real city/date/format/theatre/qty/maxPrice + account-wide email toggle
- [ ] GREEN: Alerts via getAlertPayoff + alertPayoffView + honest states + exact safe deep-links
- [ ] GREEN: ZeptoMail sender replacing stub, injectable, audited, bounded retry
- [ ] REFACTOR: remove fabricated June 2026 rows, follower counts, Earlier history when Convex configured

## Validate
- [ ] bunx tsc --noEmit
- [ ] bunx tsc --project convex/tsconfig.json --noEmit
- [ ] bun run check
- [ ] bun run check:routes
- [ ] bun run build
- [ ] bun test (full)
- [ ] bun run cf:dry-run
- [ ] Route smoke: /app/search, /app/requests/new?catalogItemId=..., /app/alerts

## Ship
- [ ] Verify ZeptoMail sending domain + ZEPTOMAIL_API_KEY in Convex env
- [ ] Push branch, open PR, resolve CodeRabbit, merge, verify master, close issue
