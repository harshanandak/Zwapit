# Zwapit

Zwapit is a planned mobile-first marketplace for transferable tickets, passes,
watchers, bookings, and selected customer-managed handoffs.

## Current Status

The first visible mock mobile flow is implemented, and PR #5 adds the first
Convex persistence slice. It keeps mock auth/payment boundaries while persisting
the demo listing, checkout order, and order timeline through Convex for local
validation.

The active product direction is documented in:
- `AGENTS.md`
- `CLAUDE.md`
- `docs/PRODUCT_SPEC.md`
- `docs/development-plan.md`

Some original Bun starter files are still present, but the product runtime target
is the planned app stack:
- Astro
- React
- Tailwind
- Capacitor
- Convex

## First Build Target

Build the foundation and first visible mock slice:
- Home, Sell, My Tickets, Me mobile shell.
- Mock Home marketplace.
- Mock Sell upload.
- Listing detail.
- Checkout preview.
- Order/transfer timeline.

Real auth, real payments, Razorpay, deployment, and full admin work come later.

## Local Development

Install dependencies:

```bash
bun install
```

Run the app locally:

```bash
bun run dev
```

Run validation:

```bash
bun run check
bunx tsc --noEmit
bun run build
bun test
```

For browser-connected Convex smoke checks, expose `PUBLIC_CONVEX_URL` in a
gitignored local env file or shell environment. `VITE_CONVEX_URL` remains a
fallback for compatibility only.
