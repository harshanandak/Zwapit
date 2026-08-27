import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  AVAIL_STATUS_MAP,
  computeCollapseKey,
  eventShowMatchesTargetDate,
  isPastAlertDate,
  extractSaleOpensAt,
  looksLikeEventPage,
  officialBookingUrl,
  parseBmsByEvent,
  parseBmsByVenue,
  parseBmsEventPage,
  parseDistrictEventPage,
  parseDistrictMovieCity,
  snapshotHash,
} from "../watcher/parse";
import type { NormalizedShow } from "../watcher/types";

// Pure unit tests: parse.ts must have NO Convex imports, so these run without
// codegen. Fixtures are small, real-shaped captures from the §0 live results in
// docs/work/2026-06-20-catalog-data-maps-research/{bms,district}-*-execution.md.

const bmsByVenue = JSON.parse(
  readFileSync(new URL("./fixtures/bms-byvenue.json", import.meta.url), "utf8"),
);
const bmsByEvent = JSON.parse(
  readFileSync(new URL("./fixtures/bms-byevent.json", import.meta.url), "utf8"),
);
const districtText = readFileSync(
  new URL("./fixtures/district-movie-city.txt", import.meta.url),
  "utf8",
);
const districtNoShows = readFileSync(
  new URL("./fixtures/district-no-shows.txt", import.meta.url),
  "utf8",
);

describe("AVAIL_STATUS_MAP", () => {
  test("decodes the validated BMS 0-3 numeric codes", () => {
    expect(AVAIL_STATUS_MAP[0]).toBe("sold_out");
    expect(AVAIL_STATUS_MAP[1]).toBe("almost_full");
    expect(AVAIL_STATUS_MAP[2]).toBe("filling_fast");
    expect(AVAIL_STATUS_MAP[3]).toBe("available");
  });
});

describe("parseBmsByVenue", () => {
  test("flattens ChildEvents x ShowTimes into NormalizedShow[]", () => {
    const shows = parseBmsByVenue(bmsByVenue);
    // 2 shows under 2D + 1 under 3D = 3 total
    expect(shows.length).toBe(3);
    for (const s of shows) {
      expect(s.source).toBe("bms");
      expect(s.theatreName).toBe("Cinepolis: Seawoods, Navi Mumbai");
      expect(s.venueCode).toBe("CSWO");
    }
  });

  test("carries showTime + format from the child event", () => {
    const shows = parseBmsByVenue(bmsByVenue);
    const first = shows.find((s) => s.showTime === "10:30");
    expect(first?.format).toBe("2D");
    const threeD = shows.find((s) => s.showTime === "18:00");
    expect(threeD?.format).toBe("3D");
  });

  test("decodes a valid 0-3 AvailStatus into status", () => {
    const shows = parseBmsByVenue(bmsByVenue);
    expect(shows.find((s) => s.showTime === "10:30")?.status).toBe("available"); // 3
    expect(shows.find((s) => s.showTime === "13:45")?.status).toBe("filling_fast"); // 2
  });

  test("leaves status undefined when AvailStatus is blank (live edge case)", () => {
    const shows = parseBmsByVenue(bmsByVenue);
    const blank = shows.find((s) => s.showTime === "18:00");
    expect(blank?.status).toBeUndefined();
  });

  test("returns [] for an empty ShowDetails payload (booking not open)", () => {
    expect(parseBmsByVenue({ ShowDetails: [] })).toEqual([]);
    expect(parseBmsByVenue({})).toEqual([]);
  });
});

describe("parseBmsByEvent", () => {
  test("parses the same ShowDetails model into NormalizedShow[]", () => {
    const shows = parseBmsByEvent(bmsByEvent);
    expect(shows.length).toBe(1);
    expect(shows[0].source).toBe("bms");
    expect(shows[0].showTime).toBe("11:00");
    expect(shows[0].format).toBe("2D");
    expect(shows[0].status).toBe("available");
    expect(shows[0].venueCode).toBe("CSWO");
  });

  test("returns [] when ShowDetails is empty (region-param miss)", () => {
    expect(parseBmsByEvent({ ShowDetails: [], ShowDatesArray: [] })).toEqual([]);
  });
});

describe("parseDistrictMovieCity", () => {
  test("splits '* theatre' / '+ HH:MM <format>' into NormalizedShow[]", () => {
    const shows = parseDistrictMovieCity(districtText);
    // PVR: 3 shows, INOX: 2 shows, Cinepolis: 1 show = 6
    expect(shows.length).toBe(6);
    for (const s of shows) {
      expect(s.source).toBe("district");
      // District text carries no fill-status and no venue code
      expect(s.status).toBeUndefined();
      expect(s.venueCode).toBeUndefined();
    }
  });

  test("attaches each show to the preceding theatre line", () => {
    const shows = parseDistrictMovieCity(districtText);
    const pvr = shows.filter((s) => s.theatreName === "PVR Market City Kurla(W)");
    expect(pvr.length).toBe(3);
    expect(pvr.map((s) => s.showTime)).toEqual(["09:00 AM", "10:30 AM", "13:45 PM"]);
    const inox = shows.filter((s) => s.theatreName === "INOX Megaplex Inorbit Malad");
    expect(inox.map((s) => s.format)).toEqual(["3D SCREEN X", "3D MX4D"]);
  });

  test("ignores junk lines (date strip, legend, cancellation policy)", () => {
    const shows = parseDistrictMovieCity(districtText);
    // No show should pick up the legend words or the date strip as a theatre.
    const theatres = new Set(shows.map((s) => s.theatreName));
    expect(theatres.has("PVR Market City Kurla(W)")).toBe(true);
    expect(theatres.has("INOX Megaplex Inorbit Malad")).toBe(true);
    expect(theatres.has("Cinepolis Lake Shore Thane")).toBe(true);
    expect(theatres.size).toBe(3);
  });

  test("returns [] when no theatres are present (booking not open)", () => {
    expect(parseDistrictMovieCity(districtNoShows)).toEqual([]);
    expect(parseDistrictMovieCity("")).toEqual([]);
  });

  test("keeps the meridiem on the time when a show line has no format token", () => {
    const shows = parseDistrictMovieCity("* PVR Demo\n+ 09:00 AM\n+ 13:45");
    expect(shows).toHaveLength(2);
    // Meridiem stays with the time instead of being swallowed into `format`.
    expect(shows[0]).toMatchObject({ theatreName: "PVR Demo", showTime: "09:00 AM", format: "" });
    // A format-less / 24h time-only line is still captured (was dropped before).
    expect(shows[1]).toMatchObject({ showTime: "13:45", format: "" });
  });

  test("still splits time+meridiem from a trailing format token", () => {
    const shows = parseDistrictMovieCity("* PVR Demo\n+ 09:00 AM PXL 3D");
    expect(shows[0]).toMatchObject({ showTime: "09:00 AM", format: "PXL 3D" });
  });
});

describe("computeCollapseKey", () => {
  test("joins catalogItemId|city|date|format (matches schema fixture literal)", () => {
    expect(
      computeCollapseKey({
        catalogItemId: "catalog_movie_1",
        city: "mumbai",
        date: "2026-06-25",
        format: "2D",
      }),
    ).toBe("catalog_movie_1|mumbai|2026-06-25|2D");
  });

  test("uses an empty trailing segment when format is missing", () => {
    expect(
      computeCollapseKey({
        catalogItemId: "catalog_movie_1",
        city: "mumbai",
        date: "2026-06-25",
      }),
    ).toBe("catalog_movie_1|mumbai|2026-06-25|");
  });
});

describe("snapshotHash", () => {
  const a: NormalizedShow = {
    source: "bms",
    theatreName: "PVR",
    showTime: "18:00",
    format: "2D",
    bookingUrl: "https://in.bookmyshow.com/x?_cb=111",
  };
  const b: NormalizedShow = {
    source: "district",
    theatreName: "INOX",
    showTime: "20:00",
    format: "3D",
    bookingUrl: "https://www.district.in/y",
  };

  test("is stable regardless of show ordering", () => {
    expect(snapshotHash([a, b])).toBe(snapshotHash([b, a]));
  });

  test("ignores cache-bust bookingUrl churn (no false fire)", () => {
    const aCacheBusted: NormalizedShow = {
      ...a,
      bookingUrl: "https://in.bookmyshow.com/x?_cb=999",
    };
    expect(snapshotHash([a, b])).toBe(snapshotHash([aCacheBusted, b]));
  });

  test("changes when a showtime changes (real transition)", () => {
    const aLater: NormalizedShow = { ...a, showTime: "21:00" };
    expect(snapshotHash([a, b])).not.toBe(snapshotHash([aLater, b]));
  });

  test("empty set has a stable hash", () => {
    expect(snapshotHash([])).toBe(snapshotHash([]));
  });
});

describe("officialBookingUrl — deep-link allowlist", () => {
  test("keeps an https BookMyShow / District URL", () => {
    expect(officialBookingUrl("https://in.bookmyshow.com/movies/x/ET1")).toBe(
      "https://in.bookmyshow.com/movies/x/ET1",
    );
    expect(officialBookingUrl("https://www.district.in/movies/y")).toBe(
      "https://www.district.in/movies/y",
    );
  });

  test("drops non-https, non-official host, unsafe scheme, and malformed values", () => {
    for (const u of [
      "http://in.bookmyshow.com/x", // not https
      "https://evil.com/in.bookmyshow.com", // wrong host
      "javascript:alert(1)",
      "data:text/html,x",
      "not a url",
      "",
      null,
      undefined,
    ]) {
      expect(officialBookingUrl(u as string)).toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// EVENT detail pages (probe 2026-08-21 � events-phase2 decisions.md)
// ---------------------------------------------------------------------------

const bmsEventPage = readFileSync(
  new URL("./fixtures/bms-event-page.txt", import.meta.url),
  "utf8",
);
const districtEventPage = readFileSync(
  new URL("./fixtures/district-event-page.txt", import.meta.url),
  "utf8",
);

describe("parseBmsEventPage", () => {
  test("parses the probed Kumar Sanu page: filling_fast wins over Book Now", () => {
    const shows = parseBmsEventPage(bmsEventPage);
    expect(shows.length).toBe(1);
    expect(shows[0].source).toBe("bms");
    expect(shows[0].status).toBe("filling_fast");
    expect(shows[0].format).toBe("event");
    expect(shows[0].theatreName).toContain("Yashobhoomi");
    expect(shows[0].showTime).toContain("16 Jan 2027");
    expect(shows[0].showTime).toContain("7:30 PM");
  });

  test("returns [] for a not-open-yet page (no bookable markers)", () => {
    expect(parseBmsEventPage("Search for Movies\n\n# Some Event\n\nComing Soon")).toEqual([]);
  });

  test("returns [] for sold out (never fires tickets-live on an unbuyable event)", () => {
    expect(parseBmsEventPage("# Event\n\nSold Out\n\nBook Now")).toEqual([]);
  });

  test("returns [] for empty content", () => {
    expect(parseBmsEventPage("")).toEqual([]);
  });
});

describe("parseDistrictEventPage", () => {
  test("parses the probed Gorillaz page: live general sale + venue + datetime", () => {
    const shows = parseDistrictEventPage(districtEventPage);
    expect(shows.length).toBe(1);
    expect(shows[0].source).toBe("district");
    expect(shows[0].status).toBe("available");
    expect(shows[0].format).toBe("event");
    expect(shows[0].theatreName).toContain("District Arena @ Terraform");
    expect(shows[0].showTime).toContain("23 Jan");
    expect(shows[0].showTime).toContain("6:00 PM");
  });

  test("parses the minimal shape (Book tickets, venue TBA)", () => {
    const shows = parseDistrictEventPage(
      "### Akhil Sachdeva - Homecoming India Tour | Mumbai\n\nFri, 23 Oct, 9:00 PM\n\nVenue to be announced, Mumbai\n\n\u20B91999\n\nonwards\n\nBook tickets\n",
    );
    expect(shows.length).toBe(1);
    expect(shows[0].status).toBe("available");
    expect(shows[0].showTime).toContain("23 Oct");
  });

  test("returns [] when no sale is live", () => {
    expect(parseDistrictEventPage("# Event\n\nVenue to be announced, Mumbai\n")).toEqual([]);
  });

  test("returns [] for empty content", () => {
    expect(parseDistrictEventPage("")).toEqual([]);
  });
});

describe("looksLikeEventPage", () => {
  test("sniffs DISTRICT event pages by their sales markers", () => {
    expect(looksLikeEventPage(districtEventPage)).toBe(true);
  });

  test("BMS event pages are routed by JSON-vs-markdown, not this sniffer", () => {
    // The BMS event page's markers ("Book Now", "Filling Fast") overlap the
    // District movie legend vocabulary — the sniffer must stay District-only.
    expect(looksLikeEventPage(bmsEventPage)).toBe(false);
  });

  test("does not misclassify movie payloads", () => {
    expect(looksLikeEventPage(JSON.stringify(bmsByVenue))).toBe(false);
    expect(looksLikeEventPage(districtText)).toBe(false);
    expect(looksLikeEventPage("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Event occurrence matching (kernel 0ebd2562 � CodeRabbit P1 on PR #42)
// ---------------------------------------------------------------------------

describe("eventShowMatchesTargetDate", () => {
  test("should match BMS-style dates when the day-month-year align", () => {
    expect(eventShowMatchesTargetDate("Sat 16 Jan 2027 7:30 PM", "2027-01-16")).toBe(true);
  });

  test("should match District-style dates that omit the year", () => {
    expect(eventShowMatchesTargetDate("Fri, 23 Oct, 9:00 PM", "2026-10-23")).toBe(true);
  });

  test("should reject a different occurrence of a multi-date event page", () => {
    expect(eventShowMatchesTargetDate("Sat 16 Jan 2027 7:30 PM", "2027-02-14")).toBe(false);
    expect(eventShowMatchesTargetDate("Sat, 23 Jan, 6:00 PM", "2027-01-27")).toBe(false);
  });

  test("should fail closed when the parsed showTime carries no usable date", () => {
    // A wrong-date alert is worse than a missed one (AGENTS standards) � an
    // unparsable date must NOT fire tickets-live for this target.
    expect(eventShowMatchesTargetDate("", "2027-01-16")).toBe(false);
    expect(eventShowMatchesTargetDate("Doors at 7 PM", "2027-01-16")).toBe(false);
  });
});

describe("eventShowMatchesTargetDate � calendar + weekday guards", () => {
  test("should reject yearless labels whose weekday contradicts the target year", () => {
    // Jan 23 2027 is a Saturday; Jan 23 2028 is a Sunday.
    expect(eventShowMatchesTargetDate("Sat, 23 Jan, 6:00 PM", "2027-01-23")).toBe(true);
    expect(eventShowMatchesTargetDate("Sat, 23 Jan, 6:00 PM", "2028-01-23")).toBe(false);
  });

  test("should fail closed on non-calendar dates in either side", () => {
    expect(eventShowMatchesTargetDate("2027-02-30", "2027-02-30")).toBe(false);
    expect(eventShowMatchesTargetDate("30 Feb 2027", "2027-02-30")).toBe(false);
    expect(eventShowMatchesTargetDate("16 Jan 2027", "2027-13-01")).toBe(false);
  });

  test("should still match full ISO labels for valid dates", () => {
    expect(eventShowMatchesTargetDate("2027-01-16T19:30:00Z", "2027-01-16")).toBe(true);
  });
});

describe("extractSaleOpensAt", () => {
  const districtFixture = readFileSync(
    new URL("./fixtures/district-event-page.txt", import.meta.url),
    "utf8",
  );
  // Mid-January 2026: both timeline windows are in the future.
  const NOW_JAN = "2026-01-15T00:00:00.000Z";

  test("should return the general-sale start from the Gorillaz fixture timeline", () => {
    // Fixture timeline minus its "is live now" state line — a page whose sale
    // is ALREADY open returns null (the availability markers handle firing).
    const timelineOnly = [
      "Sales timeline",
      "Mastercard Pre-Sale Mon 13 Apr, 1 PM - Sat 18 Apr, 1 PM",
      "General Sale Sat 18 Apr, 2026, 2 PM - Sat 23 Jan, 2027, 7 PM",
    ].join("\n\n");
    expect(extractSaleOpensAt(timelineOnly, NOW_JAN)).toBe("2026-04-18T14:00:00.000+05:30");
  });

  test("should return null when the fixture marks the sale as already live", () => {
    expect(extractSaleOpensAt(districtFixture, NOW_JAN)).toBeNull();
  });

  test("should borrow the timeline year for a yearless pre-sale start when no general sale is ahead", () => {
    const text = [
      "Sales timeline",
      "Mastercard Pre-Sale Mon 13 Apr, 1 PM - Sat 18 Apr, 1 PM",
    ].join("\n\n");
    expect(extractSaleOpensAt(text, NOW_JAN)).toBe("2026-04-13T13:00:00.000+05:30");
  });

  test("should return null when every window is already past", () => {
    const text = ["Sales timeline", "General Sale Sat 18 Apr, 2025, 2 PM - Sat 23 Jan, 2026, 7 PM"].join("\n\n");
    expect(extractSaleOpensAt(text, NOW_JAN)).toBeNull();
  });

  test("should return null when the general sale is already live", () => {
    const text = "General Sale is live now\n\nBook tickets";
    expect(extractSaleOpensAt(text, NOW_JAN)).toBeNull();
  });

  test("should return null for garbage input", () => {
    expect(extractSaleOpensAt("", NOW_JAN)).toBeNull();
    expect(extractSaleOpensAt("no timeline here at all", NOW_JAN)).toBeNull();
  });
});

describe("extractSaleOpensAt � New-Year roll-forward", () => {
  test("should roll a yearless January window into next year when polled in December", () => {
    const text = "Sales timeline\n\nGeneral Sale 2 Jan, 1 PM - 9 Jan, 1 PM";
    const nowDec = "2026-12-20T00:00:00.000Z";
    expect(extractSaleOpensAt(text, nowDec)).toBe("2027-01-02T13:00:00.000+05:30");
  });
});

  test("should NOT roll forward a yearless window when the poll is past New Year", () => {
    // Polled Jan 3 for a Jan 2 window: stale same-year, no next-year phantom.
    // Within the 24h chase lookback it still returns (post-open chase); far
    // past it, null.
    const text = "Sales timeline\n\nGeneral Sale 2 Jan, 1 PM - 9 Jan, 1 PM";
    expect(extractSaleOpensAt(text, "2027-01-03T00:00:00.000Z")).toBe(
      "2027-01-02T13:00:00.000+05:30",
    );
    expect(extractSaleOpensAt(text, "2027-01-15T00:00:00.000Z")).toBeNull();
  });

  test("should return a just-opened window so the post-open chase can engage", () => {
    // Window opened 30 minutes ago, page not yet marked live (propagation lag).
    const text = "Sales timeline\n\nGeneral Sale Sat 10 Jan, 2031, 10 AM - Sat 7 Mar, 2031, 1 PM";
    const now = Date.parse("2031-01-10T10:30:00.000Z"); // 30 min after open
    expect(extractSaleOpensAt(text, new Date(now).toISOString())).toBe(
      "2031-01-10T10:00:00.000+05:30",
    );
  });

  test("should not chase windows older than a day", () => {
    const text = "Sales timeline\n\nGeneral Sale Sat 10 Jan, 2031, 10 AM - Sat 7 Mar, 2031, 1 PM";
    const now = Date.parse("2031-01-11T11:00:00.000Z"); // >24h after open
    expect(extractSaleOpensAt(text, new Date(now).toISOString())).toBeNull();
  });

  test("should chase the MOST recently opened window when several have passed", () => {
    // Two general-sale starts already inside lookback: the live one is latest.
    const text =
      "Sales timeline\n\nGeneral Sale Sat 10 Jan, 2031, 10 AM - Sat 20 Jan, 2031, 1 PM" +
      "\n\nGeneral Sale Mon 12 Jan, 2031, 11 AM - Sat 7 Mar, 2031, 1 PM";
    const now = new Date(Date.parse("2031-01-12T11:30:00.000Z")).toISOString();
    expect(extractSaleOpensAt(text, now)).toBe("2031-01-12T11:00:00.000+05:30"); // 11 AM IST
  });

describe("isPastAlertDate (kernel 1a6575c7)", () => {
  test("should reject dates before today, allow today, allow future", () => {
    const now = "2026-08-26T10:00:00.000Z";
    expect(isPastAlertDate("2026-08-25", now)).toBe(true);
    expect(isPastAlertDate("2026-08-26", now)).toBe(false);
    expect(isPastAlertDate("2027-01-18", now)).toBe(false);
  });
});

