// Buyer UI smoke check.
// Reads the built dist/ HTML for the buyer routes and asserts the required
// copy/states are server-rendered, and that no user-facing forbidden terms leak.
// Data-driven: one entry per route in `routeChecks` (route label, dist path,
// required needles) so the read/assert structure lives once in the loop below.
// Run after `bun run build`:  bun scripts/ui-smoke-buyer.mjs
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const failures = [];

// Astro HTML-escapes text expressions (e.g. ' -> &#39;). Decode the common
// entities so we match the copy a user actually sees.
const decodeEntities = (html) =>
  html
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const read = (route, rel) => {
  const path = join(dist, rel, "index.html");
  if (!existsSync(path)) {
    failures.push(`${route}: missing built file ${path} (run \`bun run build\` first)`);
    return null;
  }
  return decodeEntities(readFileSync(path, "utf8"));
};

const must = (route, html, needles) => {
  if (html === null) return;
  for (const needle of needles) {
    if (!html.includes(needle)) {
      failures.push(`${route}: missing required copy/state -> ${JSON.stringify(needle)}`);
    }
  }
};

// User-facing language the product must never show buyers (AGENTS.md).
const FORBIDDEN = [
  "escrow",
  "settlement",
  "dispute",
  "merchant",
  "fulfilment",
  "entitlement",
  "linked account",
  "AMBER",
  "Sales",
  "Transactions",
];
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const forbiddenPattern = (term) => new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(term)}([^A-Za-z0-9_]|$)`, "i");
const mustNot = (route, html) => {
  if (html === null) return;
  for (const term of FORBIDDEN) {
    if (forbiddenPattern(term).test(html)) {
      failures.push(`${route}: forbidden user-facing term present -> ${JSON.stringify(term)}`);
    }
  }
  // "KYC" as a standalone word (avoid matching inside hashed asset names).
  if (/\bKYC\b/.test(html)) {
    failures.push(`${route}: forbidden user-facing term present -> "KYC"`);
  }
};

// One entry per buyer route: [routeLabel, distRelPath, requiredNeedles].
// This is a SMOKE check: a few route-distinctive needles to prove each route
// renders, plus the forbidden-term sweep below. The exhaustive per-route copy
// contract lives in scripts/verify-first-visible-slice.mjs (acceptance), so we
// deliberately do NOT mirror its full needle lists here.
const routeChecks = [
  ["/app/home", "app/home", ['data-route-id="/app/home"', "Set an alert"]],
  ["/app/search", "app/search", ['data-route-id="/app/search"', "Oppenheimer", "2 found"]],
  ["/app/requests", "app/requests", ['data-route-id="/app/requests"', "Your requests", "See referrals"]],
  ["/app/requests/new", "app/requests/new", ['data-route-id="/app/requests/new"', "Set an alert", "Create request & alert me"]],
  ["/app/alerts", "app/alerts", ['data-route-id="/app/alerts"', "Tickets are live", "A match for your request", "Buy with Protection"]],
  ["/app/profile", "app/profile", ['data-route-id="/app/profile"', "Free plan", "Sign out"]],
  ["/app/listings/:listingId", "app/listings/listing_bms_event_1", [
    'data-route-id="/app/listings/:listingId"',
    "Buy with Protection",
  ]],
  ["/app/checkout/:listingId", "app/checkout/listing_bms_event_1", [
    'data-route-id="/app/checkout/:listingId"',
    "Pay ₹2,411.80",
  ]],
  ["/app/tickets", "app/tickets", ['data-route-id="/app/tickets"', "My Tickets", "Confirm receipt"]],
  ["/app/orders/:orderId", "app/orders/order_demo_1", [
    'data-route-id="/app/orders/:orderId"',
    "Complete checkout first",
  ]],
];

for (const [route, rel, needles] of routeChecks) {
  const html = read(route, rel);
  must(route, html, needles);
  mustNot(route, html);
}

if (failures.length > 0) {
  console.error("Buyer UI smoke check FAILED:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}

console.log(`Buyer UI smoke check passed for ${routeChecks.length} buyer routes.`);
