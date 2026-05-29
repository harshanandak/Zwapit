// Buyer UI smoke check (Task 4).
// Reads the built dist/ HTML for the buyer routes and asserts the required
// copy/states are server-rendered, and that no user-facing forbidden terms leak.
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
const mustNot = (route, html) => {
  if (html === null) return;
  const lower = html.toLowerCase();
  for (const term of FORBIDDEN) {
    if (lower.includes(term.toLowerCase())) {
      failures.push(`${route}: forbidden user-facing term present -> ${JSON.stringify(term)}`);
    }
  }
  // "KYC" as a standalone word (avoid matching inside hashed asset names).
  if (/\bKYC\b/.test(html)) {
    failures.push(`${route}: forbidden user-facing term present -> "KYC"`);
  }
};

const home = read("/app/home", "app/home");
must("/app/home", home, [
  "Arijit Singh Live - Silver Pass",
  "Bengaluru Arena",
  "Official Transfer",
  "Protected payment",
  "₹2,400",
  "Buy with Protection",
]);

const listing = read("/app/listings/:listingId", "app/listings/listing_bms_event_1");
must("/app/listings/:listingId", listing, [
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
]);

const checkout = read("/app/checkout/:listingId", "app/checkout/listing_bms_event_1");
must("/app/checkout/:listingId", checkout, [
  'data-route-id="/app/checkout/:listingId"',
  "Protected payment",
  "Total payable",
  "₹2,411.80",
  "₹10 + GST",
  "Refund",
  "Pay ₹2,411.80",
  "Transfer by",
  "20 Dec 2026, 6:00 PM",
]);

const tickets = read("/app/tickets", "app/tickets");
must("/app/tickets", tickets, [
  "My Tickets",
  "Arijit Singh Live - Silver Pass",
  "Payment confirmed",
  "Transfer needed",
  "Confirm receipt",
  "Protection active",
  "Completed",
  "Report issue",
]);

const orders = read("/app/orders/:orderId", "app/orders/order_demo_1");
must("/app/orders/:orderId", orders, [
  'data-route-id="/app/orders/:orderId"',
  "Transfer needed",
  "Confirm receipt",
  "Protection active",
  "Completed",
  "Report issue",
  "Ticket wasn't transferred",
  "Can't access the ticket",
]);

for (const [route, html] of [
  ["/app/home", home],
  ["/app/listings/:listingId", listing],
  ["/app/checkout/:listingId", checkout],
  ["/app/tickets", tickets],
  ["/app/orders/:orderId", orders],
]) {
  mustNot(route, html);
}

if (failures.length > 0) {
  console.error("Buyer UI smoke check FAILED:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}

console.log("Buyer UI smoke check passed for 5 buyer routes.");
