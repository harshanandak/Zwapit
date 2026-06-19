// Seller UI smoke check.
// Reads built dist/ HTML for the seller routes and asserts the required
// copy/states are server-rendered, and that no forbidden terms leak.
// Light smoke: a few route-distinctive needles + the Publish click-path; the
// exhaustive per-route copy contract lives in verify-first-visible-slice.mjs.
// Run after `bun run build`:  bun scripts/ui-smoke-seller.mjs
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

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

const sell = read("/app/sell", "app/sell");
const orders = read("/app/sell/orders", "app/sell/orders");

must("/app/sell", sell, ['data-route-id="/app/sell"', "List a ticket", "Publish listing"]);
must("/app/sell/orders", orders, ['data-route-id="/app/sell/orders"', "Payout setup", "Waiting for buyer"]);

for (const [route, html] of [
  ["/app/sell", sell],
  ["/app/sell/orders", orders],
]) {
  mustNot(route, html);
}

// The consolidated Sell screen owns the publish submit click-path (moved here
// from the retired /app/sell/promise step). Exercise the built page module.
const sellScriptMatches = [...(sell ?? "").matchAll(/<script type="module" src="\/([^"]+)"><\/script>/g)];
const sellScriptPath = sellScriptMatches.at(-1)?.[1];

class FakeElement {
  constructor({ textContent = "", hidden = false } = {}) {
    this.textContent = textContent;
    this.hidden = hidden;
    this.dataset = {};
    this.childNodes = [];
    this.attributes = new Map();
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
    this[name] = value;
  }
}

class FakeAnchor extends FakeElement {
  constructor() {
    super({ textContent: "Publish listing" });
    this.href = "/app/sell/orders";
  }

  click() {
    const event = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    const listener = this.listeners.get("click");
    if (!listener) {
      throw new Error("no click listener registered");
    }
    listener(event);
    return event;
  }
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    value(key) {
      return values.get(key);
    },
  };
}

async function waitFor(predicate) {
  for (let i = 0; i < 20; i += 1) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return false;
}

function installSellPageDom({ checked }) {
  const continueLink = new FakeAnchor();
  const warning = new FakeElement();
  const resultPanel = new FakeElement({ hidden: true });
  const resultTitle = new FakeElement();
  const resultDetail = new FakeElement();
  const detectedDraft = new FakeElement({ textContent: /<script type="application\/json" id="seller-detected-draft">([\s\S]*?)<\/script>/.exec(sell ?? "")?.[1] ?? "" });
  const promiseChecks = [0, 1, 2].map(() => ({ checked }));
  const elements = new Map([
    ["promise-continue", continueLink],
    ["promise-warning", warning],
    ["promise-result", resultPanel],
    ["promise-result-title", resultTitle],
    ["promise-result-detail", resultDetail],
    ["seller-detected-draft", detectedDraft],
  ]);

  globalThis.HTMLAnchorElement = FakeAnchor;
  globalThis.Node = { TEXT_NODE: 3 };
  globalThis.document = {
    createElement(tagName) {
      return {
        tagName,
        relList: { supports: (feature) => feature === "modulepreload" },
        set rel(value) {
          this._rel = value;
        },
        set href(value) {
          this._href = value;
        },
        set as(value) {
          this._as = value;
        },
        set crossOrigin(value) {
          this._crossOrigin = value;
        },
        addEventListener() {},
      };
    },
    getElementById(id) {
      return elements.get(id) ?? null;
    },
    getElementsByTagName() {
      return [];
    },
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "#promise-continue") return [continueLink];
      if (selector === "[data-seller-promise]") return promiseChecks;
      return [];
    },
  };
  globalThis.window = {
    __ZWAPIT_UI_SMOKE_PHONE_GATE_STATUS: "verified",
    location: { hostname: "localhost", pathname: "/app/sell", search: "", href: "" },
  };
  globalThis.sessionStorage = createStorage();
  globalThis.localStorage = createStorage();

  return { continueLink, warning, resultPanel, resultTitle, resultDetail, promiseChecks };
}

async function importSellScript(scenario) {
  if (!sellScriptPath) {
    failures.push("/app/sell: missing built Sell page module script");
    return;
  }
  await import(`${pathToFileURL(join(dist, sellScriptPath)).href}?scenario=${scenario}-${Date.now()}`);
  await waitFor(() => true);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function verifyPublishClickPath() {
  const dom = installSellPageDom({ checked: false });
  await importSellScript("sell-publish-click-path");

  const uncheckedEvent = dom.continueLink.click();
  if (!uncheckedEvent.defaultPrevented) {
    failures.push("/app/sell: unchecked promise click did not prevent default navigation");
  }
  if (dom.warning.textContent !== "Accept the seller promise to continue.") {
    failures.push("/app/sell: unchecked promise click did not show the acceptance warning");
  }
  if (globalThis.window.location.href === "/app/sell/orders") {
    failures.push("/app/sell: unchecked promise click navigated to Orders");
  }

  for (const checkbox of dom.promiseChecks) checkbox.checked = true;
  const acceptedEvent = dom.continueLink.click();
  if (!acceptedEvent.defaultPrevented) {
    failures.push("/app/sell: accepted promise click did not own the submit event");
  }
  const navigated = await waitFor(() => globalThis.window.location.href === "/app/sell/orders");
  const published = globalThis.sessionStorage.value("zwapit:seller-published");
  if (!navigated) {
    failures.push("/app/sell: accepted promise click did not navigate to Orders");
  }
  if (!published?.includes('"kind":"submitted"') || !published.includes("Your listing is live")) {
    failures.push("/app/sell: accepted promise click did not persist the submitted banner state");
  }
  if (dom.resultPanel.hidden !== false || dom.resultTitle.textContent !== "Your listing is live") {
    failures.push("/app/sell: accepted promise click did not show the submitted UI state");
  }
}

await verifyPublishClickPath();

if (failures.length > 0) {
  console.error("Seller UI smoke check FAILED:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}

console.log("Seller UI smoke check passed for 2 seller routes plus Publish submit click path.");
