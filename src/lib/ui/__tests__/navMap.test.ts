import { describe, expect, test } from "bun:test";

import { ACCENTS, resolveNav, TABS } from "../navMap";

describe("TABS", () => {
  test("defines exactly the 5 bottom-nav tabs in order", () => {
    expect(TABS.map((t) => t.key)).toEqual([
      "home",
      "search",
      "requests",
      "listings",
      "profile",
    ]);
  });

  test("every tab has a canonical /app href and a sprite icon name", () => {
    for (const tab of TABS) {
      expect(tab.href.startsWith("/app/")).toBe(true);
      expect(tab.icon.length).toBeGreaterThan(0);
      expect(tab.label.length).toBeGreaterThan(0);
    }
  });

  test("accents match the locked per-screen palette", () => {
    expect(ACCENTS).toEqual({
      home: "#8E7BC9", // violet
      search: "#7FA3C4", // steel
      requests: "#C98B5F", // bronze
      listings: "#F23D7F", // rose
      profile: "#D9A84E", // gold
    });
  });
});

describe("resolveNav — happy path (tab landings)", () => {
  test("/app/home → home tab, violet, FAB shown", () => {
    expect(resolveNav("/app/home")).toEqual({
      tab: "home",
      accent: "#8E7BC9",
      showFab: true,
    });
  });

  test("/app/listings → listings tab, rose, FAB shown", () => {
    expect(resolveNav("/app/listings")).toEqual({
      tab: "listings",
      accent: "#F23D7F",
      showFab: true,
    });
  });

  test("/app/search and /app/requests light their tabs with FAB", () => {
    expect(resolveNav("/app/search")).toEqual({
      tab: "search",
      accent: "#7FA3C4",
      showFab: true,
    });
    expect(resolveNav("/app/requests")).toEqual({
      tab: "requests",
      accent: "#C98B5F",
      showFab: true,
    });
  });

  test("/app/profile lights the profile tab but hides the FAB", () => {
    expect(resolveNav("/app/profile")).toEqual({
      tab: "profile",
      accent: "#D9A84E",
      showFab: false,
    });
  });
});

describe("resolveNav — unknown / default", () => {
  test("unknown route falls back to no tab, violet default, no FAB, no throw", () => {
    expect(resolveNav("/app/does-not-exist")).toEqual({
      tab: null,
      accent: "#8E7BC9",
      showFab: false,
    });
  });
});

describe("resolveNav — dynamic / detail / flow routes", () => {
  test("listing detail keeps Listings active but hides the FAB", () => {
    expect(resolveNav("/app/listings/abc123")).toEqual({
      tab: "listings",
      accent: "#F23D7F",
      showFab: false,
    });
  });

  test("checkout is a money flow: no tab, rose, no FAB", () => {
    expect(resolveNav("/app/checkout/abc123")).toEqual({
      tab: null,
      accent: "#F23D7F",
      showFab: false,
    });
  });

  test("sell flow: no active tab (Sell is the FAB), steel, no FAB", () => {
    expect(resolveNav("/app/sell")).toEqual({
      tab: null,
      accent: "#7FA3C4",
      showFab: false,
    });
    expect(resolveNav("/app/sell/price")).toEqual({
      tab: null,
      accent: "#7FA3C4",
      showFab: false,
    });
  });
});

describe("resolveNav — legacy routes fold into Profile", () => {
  test.each(["/app/me", "/app/tickets", "/app/orders/o1"])(
    "%s → profile tab, gold, no FAB",
    (routeId) => {
      expect(resolveNav(routeId)).toEqual({
        tab: "profile",
        accent: "#D9A84E",
        showFab: false,
      });
    },
  );
});

describe("resolveNav — every existing route resolves safely", () => {
  // The 12 routeIds the existing pages pass to AppShell (blast-radius search).
  const EXISTING_ROUTES = [
    "/app/checkout/:listingId",
    "/app/home",
    "/app/listings/:listingId",
    "/app/me",
    "/app/orders/:orderId",
    "/app/sell",
    "/app/sell/confirm",
    "/app/sell/orders",
    "/app/sell/price",
    "/app/sell/promise",
    "/app/sell/upload",
    "/app/tickets",
  ];

  test.each(EXISTING_ROUTES)("%s resolves to a hex accent without throwing", (routeId) => {
    const nav = resolveNav(routeId);
    expect(nav.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(typeof nav.showFab).toBe("boolean");
  });
});

describe("resolveNav — trailing slash is tolerated", () => {
  test("/app/home/ resolves like /app/home", () => {
    expect(resolveNav("/app/home/")).toEqual(resolveNav("/app/home"));
  });
});
