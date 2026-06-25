import { describe, expect, test } from "bun:test";

import { alertPayoffView, type AlertPayoffResult } from "../alertPayoff";

// Pin the pure mapper from getAlertPayoff's union return shape (convex/watcher.ts
// getAlertPayoff) → a render-ready view model the alerts/payoff card consumes.
// The deep-link OUT (Zwapit never resells official inventory) is only produced for a
// safe http(s) bookingUrl — the watcher A03/A10 guard carried to the render boundary.

describe("alertPayoffView — live 'Tickets are live' card", () => {
  test("should map a live payoff to a live card with theatres, showtimes and a safe deep-link href", () => {
    const result: AlertPayoffResult = {
      status: "live",
      isLive: true,
      title: "Dune: Part Three",
      theatres: ["PVR Phoenix", "INOX Forum"],
      showtimes: [
        { theatre: "PVR Phoenix", time: "21:30", format: "2D" },
        { theatre: "INOX Forum", time: "18:00", format: "IMAX" },
      ],
      bookingUrl: "https://in.bookmyshow.com/movies/dune/ET00123",
    };

    const view = alertPayoffView(result);

    expect(view.kind).toBe("live");
    if (view.kind !== "live") throw new Error("expected live");
    expect(view.title).toBe("Dune: Part Three");
    expect(view.heading).toBe("Tickets are live");
    expect(view.theatres).toEqual(["PVR Phoenix", "INOX Forum"]);
    expect(view.showtimes).toHaveLength(2);
    expect(view.bookingHref).toBe("https://in.bookmyshow.com/movies/dune/ET00123");
    expect(view.ctaLabel).toBe("Open booking");
  });

  test("should keep a live card with a safe http(s) District deep-link", () => {
    const view = alertPayoffView({
      status: "live",
      isLive: true,
      title: "Kantara",
      theatres: ["Cinepolis"],
      showtimes: [{ theatre: "Cinepolis", time: "19:15", format: "2D" }],
      bookingUrl: "http://www.district.in/movies/kantara-MV456",
    });
    expect(view.kind).toBe("live");
    if (view.kind !== "live") throw new Error("expected live");
    expect(view.bookingHref).toBe("http://www.district.in/movies/kantara-MV456");
  });
});

describe("alertPayoffView — unsafe / missing deep-link is dropped (A03/A10)", () => {
  test("should drop a non-http(s) or malformed bookingUrl so the card never emits an unsafe href", () => {
    const cases: Array<string | null | undefined> = [
      null,
      undefined,
      "",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "ftp://example.com/file",
      "  ",
      "not a url",
    ];
    for (const bookingUrl of cases) {
      const view = alertPayoffView({
        status: "live",
        isLive: true,
        title: "Live but no safe link",
        theatres: ["A"],
        showtimes: [{ theatre: "A", time: "20:00", format: "2D" }],
        bookingUrl: bookingUrl as string,
      });
      // Still a live card (booking did open), but with no clickable deep-link.
      expect(view.kind).toBe("live");
      if (view.kind !== "live") throw new Error("expected live");
      expect(view.bookingHref).toBeNull();
    }
  });
});

describe("alertPayoffView — waiting state", () => {
  test("should map a watching target to the 'We'll notify you' waiting card", () => {
    const view = alertPayoffView({ status: "watching", isLive: false, title: "Dune: Part Three" });
    expect(view.kind).toBe("waiting");
    if (view.kind !== "waiting") throw new Error("expected waiting");
    expect(view.title).toBe("Dune: Part Three");
    expect(view.heading).toBe("We'll notify you");
    expect(view.message).toContain("notify you");
  });

  test("should map a watching target with no monitor yet (no title) to a waiting card", () => {
    const view = alertPayoffView({ status: "watching", isLive: false });
    expect(view.kind).toBe("waiting");
    if (view.kind !== "waiting") throw new Error("expected waiting");
    expect(view.title).toBeNull();
  });

  test("should map closed/degraded targets to a waiting card (never a fabricated live card)", () => {
    for (const status of ["closed", "degraded"] as const) {
      const view = alertPayoffView({ status, isLive: false, title: "Some Movie" });
      expect(view.kind).toBe("waiting");
    }
  });

  test("should map a null payoff (not the caller's alert / no alert) to a safe waiting card", () => {
    const view = alertPayoffView(null);
    expect(view.kind).toBe("waiting");
    if (view.kind !== "waiting") throw new Error("expected waiting");
    expect(view.title).toBeNull();
  });
});
