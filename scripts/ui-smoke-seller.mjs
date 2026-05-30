// Seller UI smoke check (Task 5).
// Reads built dist/ HTML for the seller routes and asserts the required
// copy/states are server-rendered, and that no forbidden terms leak.
// Run after `bun run build`:  bun scripts/ui-smoke-seller.mjs
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const failures = [];

// Astro HTML-escapes text expressions (e.g. ' -> &#39;). Decode common
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

// Seller flow must never surface these terms. "Sales" must not replace "Orders".
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
  if (/\bKYC\b/.test(html)) {
    failures.push(`${route}: forbidden user-facing term present -> "KYC"`);
  }
};

const overview = read("/app/sell", "app/sell");
must("/app/sell", overview, ["Upload to Sell", "Orders"]);

const upload = read("/app/sell/upload", "app/sell/upload");
must("/app/sell/upload", upload, [
  'data-route-id="/app/sell/upload"',
  "Upload your ticket",
  "detect",
  "Continue",
]);

const confirm = read("/app/sell/confirm", "app/sell/confirm");
must("/app/sell/confirm", confirm, [
  "Detected details",
  "Arijit Singh Live - Silver Pass",
  "Bengaluru Arena",
  "Official Transfer",
  "Looks right",
]);

const price = read("/app/sell/price", "app/sell/price");
must("/app/sell/price", price, ["Set your price", "Payout", "₹2,400", "Continue"]);

const promise = read("/app/sell/promise", "app/sell/promise");
must("/app/sell/promise", promise, [
  "seller promise",
  "before the deadline",
  "Approved",
  "now live",
  "Go to Orders",
]);

const orders = read("/app/sell/orders", "app/sell/orders");
must("/app/sell/orders", orders, [
  "Arijit Singh Live - Silver Pass",
  "Transfer needed",
  "Waiting for buyer",
  "Payout waiting",
  "Completed",
  "Transfer by",
  "20 Dec 2026, 6:00 PM",
  "Payout setup",
]);

for (const [route, html] of [
  ["/app/sell", overview],
  ["/app/sell/upload", upload],
  ["/app/sell/confirm", confirm],
  ["/app/sell/price", price],
  ["/app/sell/promise", promise],
  ["/app/sell/orders", orders],
]) {
  mustNot(route, html);
}

if (failures.length > 0) {
  console.error("Seller UI smoke check FAILED:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}

console.log("Seller UI smoke check passed for 6 seller routes.");
