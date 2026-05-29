import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const contractPath = join(root, "docs", "IMPLEMENTATION_CONTRACT.md");
const distPath = join(root, "dist");

const sampleParams = {
  listingId: "listing_bms_event_1",
  orderId: "order_demo_1",
};

const routeToFile = (route) => {
  const concreteRoute = route.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    const value = sampleParams[key];
    if (!value) {
      throw new Error(`No route coverage sample configured for :${key}`);
    }
    return value;
  });

  if (concreteRoute === "/") {
    return join(distPath, "index.html");
  }

  return join(distPath, concreteRoute.replace(/^\//, ""), "index.html");
};

const contract = readFileSync(contractPath, "utf8");
const routes = Array.from(
  contract.matchAll(/^- `([^`]+)` ->/gm),
  (match) => match[1],
);

if (routes.length === 0) {
  throw new Error("No contract routes found in docs/IMPLEMENTATION_CONTRACT.md");
}

const failures = [];

for (const route of routes) {
  const filePath = routeToFile(route);
  if (!existsSync(filePath)) {
    failures.push(`Missing rendered route ${route} at ${filePath}`);
    continue;
  }

  const html = readFileSync(filePath, "utf8");
  if (!html.includes(`data-route-id="${route}"`)) {
    failures.push(`Rendered route ${route} is missing its data-route-id marker`);
  }
}

const homeHtmlPath = routeToFile("/app/home");
if (existsSync(homeHtmlPath)) {
  const homeHtml = readFileSync(homeHtmlPath, "utf8");
  for (const label of ["Home", "Sell", "My Tickets", "Me"]) {
    const labelPattern = new RegExp(`>\\s*${label.replace(" ", "\\s+")}\\s*<`);
    if (!labelPattern.test(homeHtml)) {
      failures.push(`Bottom nav missing ${label}`);
    }
  }

  for (const forbiddenLabel of ["Transactions", "Sales"]) {
    if (homeHtml.includes(forbiddenLabel)) {
      failures.push(`Forbidden bottom-nav/seller label found: ${forbiddenLabel}`);
    }
  }
}

if (!existsSync(routeToFile("/app/sell/orders"))) {
  failures.push("Seller Orders route is missing inside Sell");
}

const adminHtmlPath = routeToFile("/admin");
if (existsSync(adminHtmlPath)) {
  const adminHtml = readFileSync(adminHtmlPath, "utf8");
  if (!adminHtml.includes("Admin placeholder")) {
    failures.push("/admin is missing placeholder copy");
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Route coverage passed for ${routes.length} contract routes.`);
