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
const routeChecks = [
  ["/app/home", "app/home", [
    "Arijit Singh Live - Silver Pass",
    "Bengaluru Arena",
    "Official Transfer",
    "Protected payment",
    "₹2,400",
    "Set an alert",
  ]],
  ["/app/search", "app/search", [
    'data-route-id="/app/search"',
    "Search",
    "Movie",
    "Event",
    "Bus",
    "Bengaluru",
    "Results",
    "2 found",
    "Oppenheimer",
    "Notify me",
    "Arijit Singh Live - Silver Pass",
    "Seller price",
  ]],
  ["/app/requests", "app/requests", [
    'data-route-id="/app/requests"',
    "Your requests",
    "active requests",
    "Active",
    "Matched",
    "Up to",
    "matches this week",
    "Standard",
    "Priority",
    "See referrals",
    "Arijit Singh Live - Silver Pass",
  ]],
  ["/app/listings/:listingId", "app/listings/listing_bms_event_1", [
    'data-route-id="/app/listings/:listingId"',
    "Arijit Singh Live - Silver Pass",
    "Official Transfer",
    "Protected payment",
    "Item price",
    "₹2,400",
    "₹10 + GST",
    "GST on fee",
    "₹1.80",
    "Total payable",
    "₹2,411.80",
    "Transfer by",
    "20 Dec 2026, 6:00 PM",
    "Protected until",
    "21 Dec 2026, 11:59 PM",
    "Buy with Protection",
  ]],
  ["/app/checkout/:listingId", "app/checkout/listing_bms_event_1", [
    'data-route-id="/app/checkout/:listingId"',
    "Protected payment",
    "Total payable",
    "₹2,411.80",
    "₹10 + GST",
    "Refund",
    "Pay ₹2,411.80",
    "Transfer by",
    "20 Dec 2026, 6:00 PM",
  ]],
  ["/app/tickets", "app/tickets", [
    "My Tickets",
    "Arijit Singh Live - Silver Pass",
    "Payment confirmed",
    "Transfer needed",
    "Confirm receipt",
    "Protection active",
    "Completed",
    "Report issue",
  ]],
  ["/app/orders/:orderId", "app/orders/order_demo_1", [
    'data-route-id="/app/orders/:orderId"',
    "Complete checkout first",
    "Transfer needed",
    "Confirm receipt",
    "Protection active",
    "Completed",
    "Report issue",
    "Ticket wasn't transferred",
    "Can't access the ticket",
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
