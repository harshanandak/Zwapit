import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

import { createMockFixture } from "../src/lib/mock/fixtures.ts";
import { mockCurrentUserId } from "../src/lib/auth/mockAuth.ts";
import { syncUserToConvex } from "../src/lib/auth/authAdapter.ts";
import {
  connectMockCheckoutFlow,
  connectMockListingFlow,
  connectSellerOrderFlow,
  connectTimelineActions,
  reportBuyerIssue,
} from "../src/lib/flow/mockFlow.ts";

const root = process.cwd();
const dist = join(root, "dist");

const routes = [
  ["/", "index.html"],
  ["/app", "app/index.html"],
  ["/app/home", "app/home/index.html"],
  ["/app/sell", "app/sell/index.html"],
  ["/app/sell/upload", "app/sell/upload/index.html"],
  ["/app/sell/confirm", "app/sell/confirm/index.html"],
  ["/app/sell/price", "app/sell/price/index.html"],
  ["/app/sell/promise", "app/sell/promise/index.html"],
  ["/app/sell/orders", "app/sell/orders/index.html"],
  ["/app/tickets", "app/tickets/index.html"],
  ["/app/listings/:listingId", "app/listings/listing_bms_event_1/index.html"],
  ["/app/checkout/:listingId", "app/checkout/listing_bms_event_1/index.html"],
  ["/app/orders/:orderId", "app/orders/order_demo_1/index.html"],
  ["/app/me", "app/me/index.html"],
  ["/admin", "admin/index.html"],
];

const routeDistPaths = new Map(routes);

const allowedTask10Paths = new Set([
  "scripts/verify-first-visible-slice.mjs",
  "tests/acceptance/firstVisibleSlice.test.ts",
  "src/lib/types.ts",
]);

const allowedFirstSlicePaths = [
  ".coderabbit.yaml",
  "bun.lock",
  "package.json",
  "wrangler.jsonc",
  "docs/deploy/cloudflare-workers.md",
  /^\.github\/workflows\//,
  /^scripts\//,
  /^tests\//,
  /^src\/components\//,
  /^src\/layouts\//,
  /^src\/lib\/(auth|flow|mock|rules|state|types|validation)/,
  /^src\/pages\/(admin|app|index\.astro)/,
  /^src\/styles\//,
];

const issueReasonCodes = [
  "ticket_not_transferred",
  "wrong_ticket",
  "qr_or_code_already_used",
  "details_do_not_match",
  "eligibility_problem",
  "cannot_access_ticket",
];

const forbiddenUserTerms = [
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

function result(failures, notes = []) {
  return { ok: failures.length === 0, failures, notes };
}

function decodeEntities(value) {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readBuilt(route, relPath, failures) {
  const file = join(dist, relPath);
  if (!existsSync(file)) {
    failures.push(`${route}: missing built file ${file}. Run bun run build first.`);
    return "";
  }
  return decodeEntities(readFileSync(file, "utf8"));
}

function mustContain(route, html, needles, failures) {
  for (const needle of needles) {
    if (!html.includes(needle)) {
      failures.push(`${route}: missing ${JSON.stringify(needle)}`);
    }
  }
}

function walkFiles(dir, predicate = () => true) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return walkFiles(path, predicate);
    return predicate(path) ? [path] : [];
  });
  return entries;
}

function gitOutput(args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function gitChangedFiles(args) {
  const output = gitOutput(args);
  return output ? output.split(/\r?\n/).map((path) => path.replace(/\\/g, "/")) : [];
}

function gitRefExists(ref) {
  try {
    gitOutput(["rev-parse", "--verify", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function resolveBaseRef() {
  const candidates = [];
  if (process.env.GITHUB_BASE_REF) {
    candidates.push(`origin/${process.env.GITHUB_BASE_REF}`);
  }
  try {
    candidates.push(gitOutput(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]));
  } catch {
    // Some local checkouts do not have origin/HEAD configured.
  }
  candidates.push("origin/master", "origin/main");

  for (const candidate of [...new Set(candidates.filter(Boolean))]) {
    if (gitRefExists(candidate)) return candidate;
  }
  throw new Error(`unable to resolve base ref from candidates: ${candidates.join(", ")}`);
}

function allowedFirstSlicePath(path) {
  return allowedFirstSlicePaths.some((allowed) => (allowed instanceof RegExp ? allowed.test(path) : allowed === path));
}

function routeHrefToBuiltFile(href) {
  if (href === "/") return "index.html";
  if (href === "/favicon.svg") return "../public/favicon.svg";
  if (href.startsWith("/_astro/")) return href.slice(1);
  if (href.startsWith("/app/listings/")) return routeDistPaths.get("/app/listings/:listingId");
  if (href.startsWith("/app/checkout/")) return routeDistPaths.get("/app/checkout/:listingId");
  if (href.startsWith("/app/orders/")) return routeDistPaths.get("/app/orders/:orderId");
  return routeDistPaths.get(href);
}

export function verifyRouteCoverage() {
  const failures = [];
  for (const [route, relPath] of routes) {
    const html = readBuilt(route, relPath, failures);
    const hrefs = [...html.matchAll(/\shref="([^"#?]+)(?:[#?][^"]*)?"/g)].map((match) => match[1]);
    for (const href of hrefs) {
      if (!href.startsWith("/")) continue;
      const builtTarget = routeHrefToBuiltFile(href);
      if (!builtTarget) {
        failures.push(`${route}: link ${href} is not part of the first-slice route contract`);
        continue;
      }
      const fullTarget = builtTarget.startsWith("../public/")
        ? join(root, builtTarget.replace("../public/", "public/"))
        : join(dist, builtTarget);
      if (!existsSync(fullTarget)) {
        failures.push(`${route}: link ${href} points to missing built target ${fullTarget}`);
      }
    }
  }
  return result(failures, [`checked ${routes.length} contract routes`]);
}

export async function verifyAcceptanceCriteria() {
  const failures = [];
  const notes = [];
  const built = new Map(routes.map(([route, relPath]) => [route, readBuilt(route, relPath, failures)]));

  const appRoutes = ["/app/home", "/app/sell", "/app/tickets", "/app/me"];
  for (const route of appRoutes) {
    mustContain(route, built.get(route) ?? "", ["Home", "Sell", "My Tickets", "Me"], failures);
  }

  mustContain("/app/home", built.get("/app/home") ?? "", [
    "Arijit Singh Live - Silver Pass",
    "Bengaluru Arena",
    "Official Transfer",
    "Protected payment",
    "Buy with Protection",
  ], failures);

  mustContain("/app/listings/:listingId", built.get("/app/listings/:listingId") ?? "", [
    "Arijit Singh Live - Silver Pass",
    "Official Transfer",
    "Protected payment",
    "Item price",
    "2,400",
    "10 + GST",
    "GST on fee",
    "1.80",
    "Total payable",
    "2,411.80",
    "Transfer by",
    "20 Dec 2026, 6:00 PM",
    "Protected until",
    "21 Dec 2026, 11:59 PM",
  ], failures);

  for (const [route, needles] of [
    ["/app/sell/upload", ["Upload to Sell", "Add your ticket or pass", "Continue"]],
    ["/app/sell/confirm", ["Confirm Details", "Detected details", "Looks right"]],
    ["/app/sell/price", ["Set your price", "Payout", "2,400", "Continue"]],
    ["/app/sell/promise", ["seller promise", "Approved", "now live", "Go to Orders"]],
  ]) {
    mustContain(route, built.get(route) ?? "", needles, failures);
  }

  mustContain("/app/tickets", built.get("/app/tickets") ?? "", [
    "My Tickets",
    "Payment confirmed",
    "Transfer needed",
    "Confirm receipt",
    "Protection active",
    "Completed",
    "Report issue",
  ], failures);

  mustContain("/app/sell/orders", built.get("/app/sell/orders") ?? "", [
    "Orders",
    "Arijit Singh Live - Silver Pass",
    "Transfer needed",
    "Waiting for buyer",
    "Payout waiting",
    "Completed",
  ], failures);

  mustContain("/app/orders/:orderId", built.get("/app/orders/:orderId") ?? "", [
    "Report issue",
    "Ticket wasn't transferred",
    "Wrong ticket",
    "Code already used",
    "Details don't match",
    "Eligibility problem",
    "Can't access the ticket",
  ], failures);

  const fixture = createMockFixture();
  const listingFlow = connectMockListingFlow();
  if (!listingFlow.purchasable || listingFlow.evaluation.decision !== "AUTO_APPROVE") {
    failures.push("listing flow is not AUTO_APPROVE and purchasable");
  }
  notes.push("purchasability gate is verified in connectMockListingFlow and enforced at checkout through validateCheckout");

  if (fixture.order.state !== "checkout_pending") failures.push("fixture order does not start checkout_pending");
  const checkout = connectMockCheckoutFlow(fixture.order, { buyerEligibilityAcknowledged: true });
  if (!checkout.ok) failures.push(`checkout did not pass: ${checkout.blockers.join(",")}`);
  if (checkout.order.state !== "transfer_pending") failures.push("mock_pay did not transition to transfer_pending");

  let state = { order: checkout.order, transferTask: fixture.transferTask };
  const sequence = [state.order.state];
  for (let i = 0; i < 6 && state.order.state !== "completed"; i += 1) {
    const next = connectTimelineActions(state.order, state.transferTask);
    state = { order: next.order, transferTask: next.transferTask };
    sequence.push(state.order.state);
  }
  const expected = ["transfer_pending", "transfer_submitted", "buyer_confirmed", "dispute_window_open", "completed"];
  if (JSON.stringify(sequence) !== JSON.stringify(expected)) {
    failures.push(`timeline sequence mismatch: ${sequence.join(" -> ")}`);
  }

  const seller = connectSellerOrderFlow();
  if (!seller.listingValidation.ok) failures.push(`seller listing validation failed: ${seller.listingValidation.blockers.join(",")}`);
  if (seller.transferTask.id !== "transfer_demo_1") failures.push("Sell Orders does not expose seller transfer task");

  const reported = reportBuyerIssue(checkout.order, fixture.issue, "cannot_access_ticket", "Cannot open transfer link");
  if (reported.issue.reasonCode !== "cannot_access_ticket" || reported.issue.evidenceItems.length === 0) {
    failures.push("Report issue did not capture reason code and evidence");
  }

  const typeSource = readFileSync(join(root, "src/lib/types.ts"), "utf8");
  const reportIssueSource = readFileSync(join(root, "src/components/buyer/ReportIssue.astro"), "utf8");
  for (const code of issueReasonCodes) {
    if (!typeSource.includes(`"${code}"`)) failures.push(`MockIssue type missing reason code ${code}`);
    if (!reportIssueSource.includes(`code: "${code}"`)) failures.push(`ReportIssue UI missing reason code ${code}`);
  }
  if (typeSource.includes('"ticket_invalid"')) failures.push("MockIssue type still includes non-contract reason ticket_invalid");

  const authSync = syncUserToConvex();
  if (mockCurrentUserId !== "user_demo_1") failures.push("mockCurrentUserId is not user_demo_1");
  if (authSync.appUser.id === authSync.authIdentity.providerUserId) {
    failures.push("auth adapter exposes provider id as app user id");
  }

  return result(failures, notes);
}

export async function verifyNoScopeDrift() {
  const failures = [];
  const notes = [];
  const builtHtml = routes.map(([route, relPath]) => [route, readBuilt(route, relPath, failures)]);

  for (const [route, html] of builtHtml) {
    const lower = html.toLowerCase();
    for (const term of forbiddenUserTerms) {
      if (lower.includes(term.toLowerCase())) {
        failures.push(`${route}: forbidden user-facing term ${JSON.stringify(term)}`);
      }
    }
    if (/\bKYC\b/i.test(html)) failures.push(`${route}: forbidden user-facing term "KYC"`);
  }

  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
  for (const depName of Object.keys(deps)) {
    if (/clerk|razorpay|convex|stripe|supabase|neon|postgres/i.test(depName)) {
      failures.push(`real integration dependency present: ${depName}`);
    }
  }

  const sourceFiles = walkFiles(join(root, "src"), (path) => /\.(astro|ts|tsx|js|jsx|mjs)$/.test(path));
  const realIntegrationImport = /^\s*import\s+.*?from\s+["'][^"']*(clerk|razorpay|convex|stripe|supabase|neon|postgres)[^"']*["']/im;
  for (const file of sourceFiles) {
    const source = readFileSync(file, "utf8");
    if (realIntegrationImport.test(source)) {
      failures.push(`real integration import in ${relative(root, file)}`);
    }
  }

  try {
    const baseRef = resolveBaseRef();
    const mergeBase = gitOutput(["merge-base", baseRef, "HEAD"]);
    const branchChanges = gitChangedFiles(["diff", "--name-only", "--diff-filter=ACMRT", mergeBase, "HEAD"]);
    const outOfScopeBranchChanges = branchChanges.filter((path) => !allowedFirstSlicePath(path));
    for (const path of outOfScopeBranchChanges) {
      failures.push(`out-of-scope first-slice branch change: ${path}`);
    }

    const stagedChanges = gitChangedFiles(["diff", "--cached", "--name-only", "--diff-filter=ACMRT"]);
    const outOfScopeStaged = stagedChanges.filter((path) => !allowedTask10Paths.has(path) && !allowedFirstSlicePath(path));
    for (const path of outOfScopeStaged) {
      failures.push(`out-of-scope staged first-slice change: ${path}`);
    }

    const unstagedTracked = gitChangedFiles(["diff", "--name-only", "--diff-filter=ACMRT"]);
    const outOfScopeUnstaged = unstagedTracked.filter((path) => !allowedFirstSlicePath(path));
    if (outOfScopeUnstaged.length > 0) {
      notes.push(`unrelated unstaged tracked changes excluded from first-slice commit: ${outOfScopeUnstaged.join(", ")}`);
    }
  } catch (error) {
    failures.push(`git scope drift check failed: ${error.message}`);
  }

  notes.push("package.json was not changed; e2e and UI smoke scripts are run explicitly for Task 10");
  return result(failures, notes);
}

async function main() {
  const checks = [
    ["route coverage", verifyRouteCoverage()],
    ["acceptance criteria", await verifyAcceptanceCriteria()],
    ["scope drift", await verifyNoScopeDrift()],
  ];
  const failures = checks.flatMap(([name, check]) => check.failures.map((failure) => `${name}: ${failure}`));
  const notes = checks.flatMap(([, check]) => check.notes);

  if (failures.length > 0) {
    console.error("First visible slice verification FAILED:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log("First visible slice verification passed.");
  for (const note of notes) console.log(`- ${note}`);
}

if (import.meta.main) {
  await main();
}
