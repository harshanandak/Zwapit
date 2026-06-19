/**
 * Route → navigation/ambient resolver for the v5 app shell.
 *
 * The shell derives BOTH the active bottom-nav tab and the per-route ambient
 * accent (`--acc`) from the current `routeId`, so screens don't have to declare
 * an `activeTab` prop (legacy pages stay untouched — see design.md §B).
 *
 * Pure module: no Astro/DOM imports, so it is unit-testable with `bun test`.
 * Source of truth for the palette + tab set: design.md §5/§7 and the locked
 * v5 preview. Do not invent accents outside this map.
 */

export type TabKey = "home" | "search" | "requests" | "listings" | "profile";

export interface NavTab {
  /** Stable identity used to mark the active tab. */
  key: TabKey;
  /** User-facing label rendered under the icon. */
  label: string;
  /** Canonical destination route. */
  href: string;
  /** Icon sprite id suffix — rendered as `<use href="#i-${icon}">`. */
  icon: string;
}

/** The five bottom-nav tabs, in display order. Selling is a FAB, not a tab. */
export const TABS: readonly NavTab[] = [
  { key: "home", label: "Home", href: "/app/home", icon: "home" },
  { key: "search", label: "Search", href: "/app/search", icon: "search" },
  { key: "requests", label: "Requests", href: "/app/requests", icon: "bell" },
  { key: "listings", label: "Listings", href: "/app/listings", icon: "ticket" },
  { key: "profile", label: "Profile", href: "/app/profile", icon: "user" },
];

/** Per-screen ambient accent (design.md §5). */
export const ACCENTS: Record<TabKey, string> = {
  home: "#8E7BC9", // violet
  search: "#7FA3C4", // steel
  requests: "#C98B5F", // bronze
  listings: "#F23D7F", // rose
  profile: "#D9A84E", // gold
};

/** Accent for an unknown route — home's violet. */
const DEFAULT_ACCENT = ACCENTS.home;

/** Jade ambient for the Alerts payoff screen (§5) — protection lead; not a tab accent. */
const ALERTS_ACCENT = "#6FBF9A"; // --jade

/** Tabs that surface the "List a ticket" FAB on their landing screen. */
const FAB_TABS: readonly TabKey[] = ["home", "search", "requests", "listings"];

export interface NavState {
  /** Active tab to highlight, or `null` for flows/details with no tab. */
  tab: TabKey | null;
  /** Ambient accent hex for `--acc`. */
  accent: string;
  /** Whether to show the Sell FAB on this screen. */
  showFab: boolean;
}

/** Strip a trailing slash (but keep the root) and guarantee a leading slash. */
function normalize(routeId: string): string {
  let path = routeId.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

/** True when `path` is exactly `base` or a sub-path under `base`. */
function isUnder(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

/** Build a {@link NavState} result. */
function state(tab: TabKey | null, accent: string, showFab: boolean): NavState {
  return { tab, accent, showFab };
}

/**
 * Resolve a `routeId` (the `/app/...` path, possibly with `:param` placeholders)
 * to its active tab, ambient accent, and FAB visibility.
 */
export function resolveNav(routeId: string): NavState {
  const path = normalize(routeId);

  // 1. Money / sell flows: no active tab.
  if (isUnder(path, "/app/checkout")) return state(null, ACCENTS.listings, false); // rose
  if (isUnder(path, "/app/sell")) return state(null, ACCENTS.search, false); // steel

  // 1b. Alerts payoff (§5): the bell's inbox. Requests tab stays lit; jade ambient.
  if (isUnder(path, "/app/alerts")) return state("requests", ALERTS_ACCENT, false);

  // 2. Legacy routes fold into the Profile tab (superseded in U7).
  if (path === "/app/me" || path === "/app/tickets" || isUnder(path, "/app/orders")) {
    return state("profile", ACCENTS.profile, false);
  }

  // 3. Canonical tab sections: exact landing shows the FAB; a drilled-in
  //    sub-path keeps the tab active but hides it.
  for (const tab of TABS) {
    if (path === tab.href) {
      return state(tab.key, ACCENTS[tab.key], FAB_TABS.includes(tab.key));
    }
    if (path.startsWith(`${tab.href}/`)) {
      return state(tab.key, ACCENTS[tab.key], false);
    }
  }

  // 4. The /app root behaves as Home.
  if (path === "/app") return state("home", ACCENTS.home, true);

  // 5. Unknown route — graceful default, no throw.
  return state(null, DEFAULT_ACCENT, false);
}
