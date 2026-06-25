import { describe, expect, test } from "bun:test";

import { unionAndDedupe } from "../watcher/parse";
import type { NormalizedShow } from "../watcher/types";

// Task 3: union + dedupe across BMS + District. A theatre present on BOTH sources
// (matched via the canonical venueMap) appears once; isOpen = any show present.

const bmsShow = (over: Partial<NormalizedShow> = {}): NormalizedShow => ({
  source: "bms",
  theatreName: "Cinepolis: Seawoods, Navi Mumbai",
  venueCode: "CSWO",
  showTime: "18:00",
  format: "2D",
  status: "available",
  bookingUrl: "https://in.bookmyshow.com/x?_cb=1",
  ...over,
});

const districtShow = (over: Partial<NormalizedShow> = {}): NormalizedShow => ({
  source: "district",
  theatreName: "Cinepolis Seawoods",
  showTime: "18:00",
  format: "2D",
  bookingUrl: "https://www.district.in/y",
  ...over,
});

describe("unionAndDedupe", () => {
  test("empty both -> isOpen false, no shows", () => {
    const result = unionAndDedupe([], [], {});
    expect(result.isOpen).toBe(false);
    expect(result.shows).toEqual([]);
  });

  test("District-only input passes through, isOpen true", () => {
    const result = unionAndDedupe([], [districtShow()], {});
    expect(result.isOpen).toBe(true);
    expect(result.shows.length).toBe(1);
    expect(result.shows[0].source).toBe("district");
  });

  test("BMS-only input passes through, isOpen true", () => {
    const result = unionAndDedupe([bmsShow()], [], {});
    expect(result.isOpen).toBe(true);
    expect(result.shows.length).toBe(1);
    expect(result.shows[0].source).toBe("bms");
  });

  test("same theatre+showtime+format on both sources -> one merged entry", () => {
    // venueMap bridges the BMS venueCode and the District theatreName to one id.
    const venueMap = {
      "bms:CSWO": "venue_seawoods",
      "district:cinepolis seawoods": "venue_seawoods",
    };
    const result = unionAndDedupe([bmsShow()], [districtShow()], venueMap);
    expect(result.isOpen).toBe(true);
    expect(result.shows.length).toBe(1);
  });

  test("different showtimes at the same venue are NOT merged", () => {
    const venueMap = {
      "bms:CSWO": "venue_seawoods",
      "district:cinepolis seawoods": "venue_seawoods",
    };
    const result = unionAndDedupe(
      [bmsShow({ showTime: "18:00" })],
      [districtShow({ showTime: "21:00" })],
      venueMap,
    );
    expect(result.shows.length).toBe(2);
  });

  test("unmapped venues fall back to normalized theatre name (still dedupes identical names)", () => {
    const result = unionAndDedupe(
      [bmsShow({ theatreName: "PVR Phoenix", venueCode: undefined })],
      [districtShow({ theatreName: "pvr phoenix" })],
      {},
    );
    // Same normalized name + showTime + format -> one entry even with no venueMap.
    expect(result.shows.length).toBe(1);
  });

  test("exposes a bookingUrl when any show is open", () => {
    const result = unionAndDedupe([bmsShow()], [], {});
    expect(typeof result.bookingUrl).toBe("string");
    expect(result.bookingUrl).toContain("bookmyshow.com");
  });
});
