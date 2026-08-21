import { afterEach, describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";

import { api, internal } from "../_generated/api";
import crons from "../crons";
import schema from "../schema";
import { __setFetcher, __setSenders } from "../watcher";
import type { ParallelExtractResponse } from "../watcher/adapters";
import type { NotificationMessage, SenderResult } from "../watcher/senders";

// convex-test globs the module tree; Bun has no import.meta.glob, so we hand it an
// explicit map of every function module the tests touch (transitively). Missing a
// module surfaces as a confusing resolution error, so list them all.
const modules = {
  "../convex/_generated/api.js": () => import("../_generated/api.js"),
  "../convex/watcher.js": () => import("../watcher"),
  "../convex/identity.js": () => import("../identity"),
  "../convex/model.js": () => import("../model"),
  "../convex/crons.js": () => import("../crons"),
};

const t = () => convexTest(schema, modules);

// ---- identities -----------------------------------------------------------
const BUYER_A = { subject: "clerk_buyer_a" };
const BUYER_B = { subject: "clerk_buyer_b" };
const BUYER_C = { subject: "clerk_buyer_c" };
const APP_A = "app_buyer_a";
const APP_B = "app_buyer_b";
const APP_C = "app_buyer_c";

const NOW = "2026-06-22T10:00:00.000Z";
// createAlert sets nextCheckAt to the real wall clock (poll-immediately). Polling
// with a clearly-later "now" makes the just-created target due regardless of the
// machine clock — the watcher's cadence is real-time, only the watch DATE is fixed.
const POLL_NOW = "2030-01-01T00:00:00.000Z";

// ---- fixtures --------------------------------------------------------------

/** A BMS byvenue-shaped JSON payload with one open theatre. */
function openBmsJson(): string {
  return JSON.stringify({
    ShowDetails: [
      {
        VenueName: "PVR Phoenix",
        VenueCode: "BMSV01",
        Event: [
          {
            EventTitle: "Demo Movie",
            ChildEvents: [
              {
                EventDimension: "2D",
                ShowTimes: [{ ShowTime: "18:30", AvailStatus: 3 }],
              },
            ],
          },
        ],
      },
    ],
  });
}

function fetcherReturning(content: string) {
  return async (urls: string[]): Promise<ParallelExtractResponse> => ({
    results: urls.map((url) => ({ url, content })),
  });
}

// A CLEAN fetch where booking simply isn't open yet: each URL returns a result
// row with empty content (page rendered "no shows yet"). This must NOT degrade.
function emptyFetcher() {
  return async (urls: string[]): Promise<ParallelExtractResponse> => ({
    results: urls.map((url) => ({ url, content: "" })),
  });
}

// A SOURCE FAILURE: the fetch throws (block / network / Parallel down). Only this
// counts toward degrade.
function throwingFetcher() {
  return async (): Promise<ParallelExtractResponse> => {
    throw new Error("source blocked");
  };
}

// Seed: an app user (so requireAuthenticatedAppUser resolves) + a catalog movie
// carrying BMS venue codes (so platform-routing builds a BMS URL).
async function seedUser(
  tt: ReturnType<typeof t>,
  appUserId: string,
  providerSubject: string,
): Promise<void> {
  await tt.run(async (ctx) => {
    await ctx.db.insert("users", {
      appUserId,
      role: "buyer_seller",
      phoneVerified: true,
      displayName: appUserId,
    });
    await ctx.db.insert("auth_identities", {
      appUserId,
      provider: "clerk",
      providerUserId: providerSubject,
    });
  });
}

async function seedMovie(
  tt: ReturnType<typeof t>,
  catalogKey = "catalog_movie_1",
  codes: Record<string, unknown> = { bmsVenueCode: "BMSV01" },
): Promise<void> {
  await tt.run(async (ctx) => {
    await ctx.db.insert("catalog_items", {
      catalogKey,
      kind: "movie",
      externalSource: "tmdb",
      title: "Demo Movie",
      isActive: true,
      lastSyncedAt: NOW,
      ...codes,
    });
  });
}

// A curated event catalog row (kind live_event, no BMS/District codes) — events-phase2.
async function seedEvent(
  tt: ReturnType<typeof t>,
  catalogKey = "catalog_event_1",
): Promise<void> {
  await tt.run(async (ctx) => {
    await ctx.db.insert("catalog_items", {
      catalogKey,
      kind: "live_event",
      externalSource: "manual",
      title: "Demo Concert",
      city: "mumbai",
      venueOrDestination: "Manpho Convention Centre",
      startAt: "2027-02-14T19:00:00.000Z",
      isActive: true,
      lastSyncedAt: NOW,
    });
  });
}

afterEach(() => {
  __setFetcher(null);
  __setSenders(null);
});

describe("createAlert — shared monitor target collapse", () => {
  test("two buyers on the same show collapse to ONE target, subscriberCount=2", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedUser(tt, APP_B, BUYER_B.subject);
    await seedMovie(tt);

    const argsBase = {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
      alertTypes: ["availability" as const],
      channels: ["email" as const],
    };

    const r1 = await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, argsBase);
    const r2 = await tt.withIdentity(BUYER_B).mutation(api.watcher.createAlert, argsBase);

    expect(r1.collapseKey).toBe(r2.collapseKey);
    expect(r1.monitorTargetId).toBe(r2.monitorTargetId);

    const { targets, wants } = await tt.run(async (ctx) => ({
      targets: await ctx.db.query("monitor_targets").collect(),
      wants: await ctx.db.query("wants").collect(),
    }));
    expect(targets).toHaveLength(1);
    expect(targets[0].subscriberCount).toBe(2);
    expect(wants).toHaveLength(2);
    expect(wants.every((w) => w.monitorTargetId === targets[0]._id)).toBe(true);
  });

  test("same buyer re-arming does NOT inflate subscriberCount", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    const args = {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
    };
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, args);
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, args);

    const targets = await tt.run((ctx) => ctx.db.query("monitor_targets").collect());
    expect(targets).toHaveLength(1);
    expect(targets[0].subscriberCount).toBe(1);
  });

  test("rejects an unauthenticated caller (A01)", async () => {
    const tt = t();
    await seedMovie(tt);
    await expect(
      tt.mutation(api.watcher.createAlert, {
        catalogItemId: "catalog_movie_1",
        city: "mumbai",
        date: "2026-06-25",
      }),
    ).rejects.toThrow("AUTH_REQUIRED");
  });

  test("rejects an alert no official source can watch (NO_WATCHABLE_SOURCE)", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt, "catalog_no_codes", {}); // no bms/district codes → no watchable source
    await expect(
      tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
        catalogItemId: "catalog_no_codes",
        city: "mumbai",
        date: "2026-06-25",
      }),
    ).rejects.toThrow("NO_WATCHABLE_SOURCE");
    const targets = await tt.run((ctx) => ctx.db.query("monitor_targets").collect());
    expect(targets).toHaveLength(0); // no inert target persisted
  });

  test("rejects a malformed date (ALERT_DATE_INVALID)", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    await expect(
      tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
        catalogItemId: "catalog_movie_1",
        city: "mumbai",
        date: "25-06-2026",
      }),
    ).rejects.toThrow("ALERT_DATE_INVALID");
  });
});

describe("createAlert — curated live events (events-phase2 T2)", () => {
  test("a live_event alert creates a curated watching target (sources [], event_ticket) — no throw", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedEvent(tt);

    const { monitorTargetId } = await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_event_1",
      city: "mumbai",
      date: "2027-02-14",
    });

    const { target, want } = await tt.run(async (ctx) => ({
      target: (await ctx.db.query("monitor_targets").collect())[0],
      want: (await ctx.db.query("wants").collect())[0],
    }));
    expect(target.status).toBe("watching");
    expect(target.sources).toEqual([]); // curated: no pollable source
    expect(want.category).toBe("event_ticket"); // derived from catalog kind

    // Curated target is NEVER polled: excluded from dueTargets despite watching + due.
    const due = await tt.query(internal.watcher.dueTargets, { now: POLL_NOW });
    expect(due.find((d) => d._id === monitorTargetId)).toBeUndefined();
  });

  test("a live_event WITH source codes is POLLABLE, not curated (adapters can fire)", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await tt.run(async (ctx) => {
      await ctx.db.insert("catalog_items", {
        catalogKey: "catalog_event_coded_1",
        kind: "live_event",
        externalSource: "manual",
        title: "Kumar Sanu Live In Concert",
        city: "delhi",
        venueOrDestination: "Yashobhoomi Convention Center",
        startAt: "2027-01-16T14:00:00.000Z",
        isActive: true,
        lastSyncedAt: NOW,
        bmsEventCode: "ET00500437",
      });
    });

    const { monitorTargetId } = await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_event_coded_1",
      city: "delhi",
      date: "2027-01-16",
    });

    const target = (await tt.run(async (ctx) => (await ctx.db.query("monitor_targets").collect())[0]));
    expect(target.sources).toEqual(["bms"]); // routed to the BMS event detail-page adapter
    expect(target.nextCheckAt).not.toBe("9999-12-31T23:59:59.999Z");

    // Pollable: it must actually enter the due queue (CodeRabbit P1 regression).
    const due = await tt.query(internal.watcher.dueTargets, { now: POLL_NOW });
    expect(due.find((d) => d._id === monitorTargetId)).toBeDefined();
  });

  test("two buyers on the same event occurrence collapse to ONE curated target", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedUser(tt, APP_B, BUYER_B.subject);
    await seedEvent(tt);
    const args = { catalogItemId: "catalog_event_1", city: "mumbai", date: "2027-02-14" };

    const r1 = await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, args);
    const r2 = await tt.withIdentity(BUYER_B).mutation(api.watcher.createAlert, args);
    expect(r1.monitorTargetId).toBe(r2.monitorTargetId);

    const { targets, wants } = await tt.run(async (ctx) => ({
      targets: await ctx.db.query("monitor_targets").collect(),
      wants: await ctx.db.query("wants").collect(),
    }));
    expect(targets).toHaveLength(1);
    expect(targets[0].subscriberCount).toBe(2);
    expect(wants.every((w) => w.category === "event_ticket")).toBe(true);
  });

  test("curated targets never consume the poll budget — a pollable target is still due behind many curated ones", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    // Curated event targets created FIRST (would sort first by nextCheckAt and, with
    // a .take(limit)-then-filter, crowd the pollable target out of the budget).
    await seedEvent(tt, "catalog_event_a");
    await seedEvent(tt, "catalog_event_b");
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_event_a",
      city: "mumbai",
      date: "2027-02-14",
    });
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_event_b",
      city: "mumbai",
      date: "2027-02-14",
    });
    // A pollable movie target created LAST.
    await seedMovie(tt, "catalog_movie_x");
    const { monitorTargetId: movieTargetId } = await tt
      .withIdentity(BUYER_A)
      .mutation(api.watcher.createAlert, {
        catalogItemId: "catalog_movie_x",
        city: "mumbai",
        date: "2026-06-25",
        format: "2D",
      });

    // With limit 1, curated targets must NOT be selected ahead of the pollable one.
    const due = await tt.query(internal.watcher.dueTargets, { now: POLL_NOW, limit: 1 });
    expect(due).toHaveLength(1);
    expect(due[0]._id as string).toBe(movieTargetId);
  });
});

describe("markEventAvailable — curated availability → notify + deep-link OUT (events-phase2 T3)", () => {
  const EVENT_ARGS = { catalogItemId: "catalog_event_1", city: "mumbai", date: "2027-02-14" };
  const EVENT_SHOWS = [{ theatreName: "Manpho Convention Centre", showTime: "19:00", format: "GA" }];
  const OFFICIAL_URL = "https://in.bookmyshow.com/events/demo-concert";

  test("admin marks a curated event live → each subscriber notified (deep-link OUT); payoff live, owner only", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedUser(tt, APP_B, BUYER_B.subject);
    await seedEvent(tt);
    const { wantKey, monitorTargetId } = await tt
      .withIdentity(BUYER_A)
      .mutation(api.watcher.createAlert, EVENT_ARGS);
    await tt.withIdentity(BUYER_B).mutation(api.watcher.createAlert, EVENT_ARGS);

    const rec = await tt.mutation(internal.watcher.markEventAvailable, {
      monitorTargetId: monitorTargetId as never,
      shows: EVENT_SHOWS,
      bookingUrl: OFFICIAL_URL,
      detectedAt: NOW,
    });
    expect(rec.availabilityEventId).toBeTruthy();

    const { target, events, notifs } = await tt.run(async (ctx) => ({
      target: (await ctx.db.query("monitor_targets").collect())[0],
      events: await ctx.db.query("availability_events").collect(),
      notifs: await ctx.db.query("notification_queue").collect(),
    }));
    expect(target.status).toBe("live");
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("curated");
    expect(events[0].bookingUrl).toContain("bookmyshow");
    expect(notifs).toHaveLength(2); // A + B on the default email channel
    expect(new Set(notifs.map((n) => n.userId))).toEqual(new Set([APP_A, APP_B]));

    const payoff = await tt.withIdentity(BUYER_A).query(api.watcher.getAlertPayoff, { wantKey });
    expect(payoff?.isLive).toBe(true);
    expect(payoff?.status).toBe("live");
    expect(payoff?.bookingUrl).toContain("bookmyshow");
    expect(payoff?.theatres).toContain("Manpho Convention Centre");
    // A01: another user cannot read this alert.
    const leaked = await tt.withIdentity(BUYER_B).query(api.watcher.getAlertPayoff, { wantKey });
    expect(leaked).toBeNull();
  });

  test("rejects a non-official bookingUrl — no empty live link; target stays watching", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedEvent(tt);
    const { monitorTargetId } = await tt
      .withIdentity(BUYER_A)
      .mutation(api.watcher.createAlert, EVENT_ARGS);

    await expect(
      tt.mutation(internal.watcher.markEventAvailable, {
        monitorTargetId: monitorTargetId as never,
        shows: EVENT_SHOWS,
        bookingUrl: "javascript:alert(1)",
        detectedAt: NOW,
      }),
    ).rejects.toThrow("INVALID_BOOKING_URL");

    const { target, events } = await tt.run(async (ctx) => ({
      target: (await ctx.db.query("monitor_targets").collect())[0],
      events: await ctx.db.query("availability_events").collect(),
    }));
    expect(target.status).toBe("watching"); // never advanced to live with a "" link
    expect(events).toHaveLength(0);
  });

  test("rejects empty/blank shows and a non-curated (pollable) target", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedEvent(tt);
    const { monitorTargetId } = await tt
      .withIdentity(BUYER_A)
      .mutation(api.watcher.createAlert, EVENT_ARGS);

    await expect(
      tt.mutation(internal.watcher.markEventAvailable, {
        monitorTargetId: monitorTargetId as never,
        shows: [],
        bookingUrl: OFFICIAL_URL,
      }),
    ).rejects.toThrow("INVALID_CURATED_SHOWS");
    await expect(
      tt.mutation(internal.watcher.markEventAvailable, {
        monitorTargetId: monitorTargetId as never,
        shows: [{ theatreName: "  ", showTime: "19:00", format: "" }],
        bookingUrl: OFFICIAL_URL,
      }),
    ).rejects.toThrow("INVALID_CURATED_SHOWS");

    // A pollable movie target must NOT be markable via the curated path.
    await seedMovie(tt, "catalog_movie_y");
    const { monitorTargetId: movieTargetId } = await tt
      .withIdentity(BUYER_A)
      .mutation(api.watcher.createAlert, {
        catalogItemId: "catalog_movie_y",
        city: "mumbai",
        date: "2026-06-25",
        format: "2D",
      });
    await expect(
      tt.mutation(internal.watcher.markEventAvailable, {
        monitorTargetId: movieTargetId as never,
        shows: EVENT_SHOWS,
        bookingUrl: OFFICIAL_URL,
      }),
    ).rejects.toThrow("CURATED_TARGET_REQUIRED");
  });

  test("idempotent — re-marking with the same official URL + shows adds no new event", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedEvent(tt);
    const { monitorTargetId } = await tt
      .withIdentity(BUYER_A)
      .mutation(api.watcher.createAlert, EVENT_ARGS);

    await tt.mutation(internal.watcher.markEventAvailable, {
      monitorTargetId: monitorTargetId as never,
      shows: EVENT_SHOWS,
      bookingUrl: OFFICIAL_URL,
      detectedAt: NOW,
    });
    const second = await tt.mutation(internal.watcher.markEventAvailable, {
      monitorTargetId: monitorTargetId as never,
      shows: EVENT_SHOWS,
      bookingUrl: OFFICIAL_URL,
      detectedAt: NOW,
    });
    expect(second.deduped).toBe(true); // same snapshot hash → no-op

    const events = await tt.run((ctx) => ctx.db.query("availability_events").collect());
    expect(events).toHaveLength(1);
    expect(events[0].bookingUrl).toContain("bookmyshow");
  });
});

describe("recordAvailability — detection → live + snapshot dedup", () => {
  test("first open writes one event and flips target to live; identical hash is a no-op", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    const { monitorTargetId } = await tt
      .withIdentity(BUYER_A)
      .mutation(api.watcher.createAlert, {
        catalogItemId: "catalog_movie_1",
        city: "mumbai",
        date: "2026-06-25",
        format: "2D",
      });

    const normalized = [
      { source: "bms" as const, theatreName: "PVR", showTime: "18:30", format: "2D" },
    ];
    const args = {
      monitorTargetId: monitorTargetId as never,
      source: "bms" as const,
      normalized,
      bookingUrl: "https://in.bookmyshow.com/movies/demo",
      detectedAt: NOW,
      snapshotHash: "hash_open_1",
    };

    const first = await tt.mutation(internal.watcher.recordAvailability, args);
    expect(first.deduped).toBe(false);
    expect(first.availabilityEventId).toBeTruthy();

    const second = await tt.mutation(internal.watcher.recordAvailability, args);
    expect(second.deduped).toBe(true);
    expect(second.availabilityEventId).toBeNull();

    const { events, target } = await tt.run(async (ctx) => ({
      events: await ctx.db.query("availability_events").collect(),
      target: (await ctx.db.query("monitor_targets").collect())[0],
    }));
    expect(events).toHaveLength(1);
    expect(target.status).toBe("live");
  });

  test("primary-source flip (bms→district) on an UNCHANGED union hash is a no-op", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    const { monitorTargetId } = await tt
      .withIdentity(BUYER_A)
      .mutation(api.watcher.createAlert, {
        catalogItemId: "catalog_movie_1",
        city: "mumbai",
        date: "2026-06-25",
        format: "2D",
      });

    const normalized = [
      { source: "bms" as const, theatreName: "PVR", showTime: "18:30", format: "2D" },
    ];
    // SAME union hash both times — only the recorded primarySource differs.
    const unionHash = "hash_union_open";

    const first = await tt.mutation(internal.watcher.recordAvailability, {
      monitorTargetId: monitorTargetId as never,
      source: "bms" as const,
      normalized,
      bookingUrl: "https://in.bookmyshow.com/movies/demo",
      detectedAt: NOW,
      snapshotHash: unionHash,
    });
    expect(first.deduped).toBe(false);
    expect(first.availabilityEventId).toBeTruthy();

    // The primary source flips to "district" on an UNCHANGED union (same hash).
    // Dedup gates on target.lastSnapshotHash (the union hash), independent of which
    // source won → no new event, nothing to enqueue.
    const flip = await tt.mutation(internal.watcher.recordAvailability, {
      monitorTargetId: monitorTargetId as never,
      source: "district" as const,
      normalized,
      bookingUrl: "https://www.district.in/movies/demo",
      detectedAt: NOW,
      snapshotHash: unionHash,
    });
    expect(flip.deduped).toBe(true);
    expect(flip.availabilityEventId).toBeNull();

    const { events, notifs } = await tt.run(async (ctx) => ({
      events: await ctx.db.query("availability_events").collect(),
      notifs: await ctx.db.query("notification_queue").collect(),
    }));
    expect(events).toHaveLength(1); // still exactly one event after the flip
    // No new event ⇒ pollDueTargets would not enqueue; queue stays empty here.
    expect(notifs).toHaveLength(0);
  });
});

describe("enqueueNotifications — idempotent, fire-once", () => {
  test("2 subscribers → 2 pending once; rerun adds 0; late subscriber → 1 enqueued", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedUser(tt, APP_B, BUYER_B.subject);
    await seedUser(tt, APP_C, BUYER_C.subject);
    await seedMovie(tt);
    const args = {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
      alertTypes: ["availability" as const],
      channels: ["email" as const],
    };
    const { monitorTargetId } = await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, args);
    await tt.withIdentity(BUYER_B).mutation(api.watcher.createAlert, args);

    const rec = await tt.mutation(internal.watcher.recordAvailability, {
      monitorTargetId: monitorTargetId as never,
      source: "bms" as const,
      normalized: [{ source: "bms" as const, theatreName: "PVR", showTime: "18:30", format: "2D" }],
      bookingUrl: "https://in.bookmyshow.com/movies/demo",
      detectedAt: NOW,
      snapshotHash: "hash_open_1",
    });

    const enq1 = await tt.mutation(internal.watcher.enqueueNotifications, {
      availabilityEventId: rec.availabilityEventId as never,
      nowIso: NOW,
    });
    expect(enq1.inserted).toBe(2); // 2 subscribers × 1 channel × 1 delivered type

    const enq2 = await tt.mutation(internal.watcher.enqueueNotifications, {
      availabilityEventId: rec.availabilityEventId as never,
      nowIso: NOW,
    });
    expect(enq2.inserted).toBe(0); // idempotent on dedupeKey

    // Late subscriber C arms an ALREADY-live target → notified immediately.
    await tt.withIdentity(BUYER_C).mutation(api.watcher.createAlert, args);
    const pending = await tt.run((ctx) =>
      ctx.db.query("notification_queue").collect(),
    );
    expect(pending).toHaveLength(3); // A, B (from enqueue) + C (late path)
    expect(pending.filter((p) => p.userId === APP_C)).toHaveLength(1);
  });
});

describe("enqueueNotifications — fan-out per delivered alertType × channel (zwapit-46i.6)", () => {
  async function armAndOpen(
    tt: ReturnType<typeof t>,
    alertTypes: Array<"availability" | "discount" | "price_drop" | "last_minute">,
    channels: Array<"email" | "web_push">,
  ) {
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    const { monitorTargetId } = await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
      alertTypes,
      channels,
    });
    const rec = await tt.mutation(internal.watcher.recordAvailability, {
      monitorTargetId: monitorTargetId as never,
      source: "bms" as const,
      normalized: [{ source: "bms" as const, theatreName: "PVR", showTime: "18:30", format: "2D" }],
      bookingUrl: "https://in.bookmyshow.com/movies/demo",
      detectedAt: NOW,
      snapshotHash: "hash_open_1",
    });
    await tt.mutation(internal.watcher.enqueueNotifications, {
      availabilityEventId: rec.availabilityEventId as never,
      nowIso: NOW,
    });
    return tt.run((ctx) => ctx.db.query("notification_queue").collect());
  }

  test("one subscriber on 2 channels × 2 delivered types → 4 distinct pending rows", async () => {
    const notifs = await armAndOpen(t(), ["availability", "last_minute"], ["email", "web_push"]);
    expect(notifs).toHaveLength(4);
    expect(new Set(notifs.map((n) => n.dedupeKey)).size).toBe(4);
    expect(new Set(notifs.map((n) => n.channel))).toEqual(new Set(["email", "web_push"]));
    expect(new Set(notifs.map((n) => n.alertType))).toEqual(new Set(["availability", "last_minute"]));
    expect(notifs.every((n) => n.status === "pending")).toBe(true);
  });

  test("discount is captured-but-NOT-delivered (only availability enqueues)", async () => {
    const notifs = await armAndOpen(t(), ["availability", "discount"], ["email"]);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].alertType).toBe("availability");
    expect(notifs[0].channel).toBe("email");
  });

  test("a want with ONLY non-delivered types (discount/price_drop) enqueues nothing yet", async () => {
    const notifs = await armAndOpen(t(), ["discount", "price_drop"], ["email"]);
    expect(notifs).toHaveLength(0);
  });
});

describe("degrade lifecycle — K consecutive empty polls", () => {
  test("3 empty polls flip a target watching → degraded with no notifications", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
    });

    // SOURCE FAILURE (fetch throws) is what degrades — not a clean "not open yet".
    __setFetcher(throwingFetcher());

    for (let i = 0; i < 3; i++) {
      await tt.action(internal.watcher.pollDueTargets, { now: POLL_NOW });
      // reopen the window for the next poll (poll advanced nextCheckAt forward)
      await tt.run(async (ctx) => {
        const target = (await ctx.db.query("monitor_targets").collect())[0];
        if (target.status === "watching") {
          await ctx.db.patch(target._id, { nextCheckAt: POLL_NOW });
        }
      });
    }

    const { target, events, notifs } = await tt.run(async (ctx) => ({
      target: (await ctx.db.query("monitor_targets").collect())[0],
      events: await ctx.db.query("availability_events").collect(),
      notifs: await ctx.db.query("notification_queue").collect(),
    }));
    expect(target.status).toBe("degraded");
    expect(target.failCount).toBe(3);
    expect(events).toHaveLength(0);
    expect(notifs).toHaveLength(0);
  });

  test("a CLEAN not-open-yet poll does NOT degrade — stays watching, failCount 0", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
    });

    // Booking not open yet (page renders, zero shows) — the normal pre-open state
    // for an alert set days ahead. Must keep watching across many polls.
    __setFetcher(emptyFetcher());
    for (let i = 0; i < 5; i++) {
      await tt.action(internal.watcher.pollDueTargets, { now: POLL_NOW });
      await tt.run(async (ctx) => {
        const target = (await ctx.db.query("monitor_targets").collect())[0];
        if (target.status === "watching") {
          await ctx.db.patch(target._id, { nextCheckAt: POLL_NOW });
        }
      });
    }

    const target = await tt.run(
      async (ctx) => (await ctx.db.query("monitor_targets").collect())[0],
    );
    expect(target.status).toBe("watching");
    expect(target.failCount).toBe(0);
  });
});

describe("pollDueTargets — detection + platform routing", () => {
  test("an open BMS fixture flips target to live and enqueues notifications", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
      alertTypes: ["availability" as const],
      channels: ["email" as const],
    });

    __setFetcher(fetcherReturning(openBmsJson()));
    const result = await tt.action(internal.watcher.pollDueTargets, { now: POLL_NOW });
    expect(result.detected).toBe(1);

    const { target, events, notifs } = await tt.run(async (ctx) => ({
      target: (await ctx.db.query("monitor_targets").collect())[0],
      events: await ctx.db.query("availability_events").collect(),
      notifs: await ctx.db.query("notification_queue").collect(),
    }));
    expect(target.status).toBe("live");
    expect(events).toHaveLength(1);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].channel).toBe("email");
  });

  test("platform routing: a District-only catalog item polls District only (one URL)", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt, "catalog_movie_district", {
      districtMvCode: "MV12345",
      districtCitySlug: "mumbai",
    });
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_movie_district",
      city: "mumbai",
      date: "2026-06-25",
    });

    const seenUrls: string[][] = [];
    __setFetcher(async (urls: string[]) => {
      seenUrls.push(urls);
      return { results: urls.map((url) => ({ url, content: "" })) };
    });

    await tt.action(internal.watcher.pollDueTargets, { now: POLL_NOW });
    expect(seenUrls).toHaveLength(1);
    expect(seenUrls[0]).toHaveLength(1);
    expect(seenUrls[0][0]).toContain("district.in");
    expect(seenUrls[0][0]).not.toContain("bookmyshow");
  });
});

describe("dispatchNotifications — sender routing", () => {
  test("pending → sent with a mock sender; a throwing sender requeues to pending (retry)", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedUser(tt, APP_B, BUYER_B.subject);
    await seedMovie(tt);
    const args = {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
      alertTypes: ["availability" as const],
      channels: ["email" as const],
    };
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, args);
    await tt.withIdentity(BUYER_B).mutation(api.watcher.createAlert, {
      ...args,
      channels: ["web_push" as const],
    });

    __setFetcher(fetcherReturning(openBmsJson()));
    await tt.action(internal.watcher.pollDueTargets, { now: POLL_NOW });

    // email sender succeeds, web_push sender throws → one sent, one failed.
    const sentMessages: NotificationMessage[] = [];
    __setSenders({
      email: async (m): Promise<SenderResult> => {
        sentMessages.push(m);
        return { sent: true };
      },
      webpush: async (): Promise<SenderResult> => {
        throw new Error("push down");
      },
    });

    const dispatch = await tt.action(internal.watcher.dispatchNotifications, { now: POLL_NOW });
    expect(dispatch.sent).toBe(1);
    expect(dispatch.failed).toBe(1); // run-level: one send threw this wave

    const notifs = await tt.run((ctx) => ctx.db.query("notification_queue").collect());
    const byStatus = (s: string) => notifs.filter((n) => n.status === s).length;
    expect(byStatus("sent")).toBe(1);
    // A single transient throw requeues to "pending" (retry), NOT terminal "failed".
    expect(byStatus("failed")).toBe(0);
    const requeued = notifs.find((n) => n.channel === "web_push");
    expect(requeued?.status).toBe("pending");
    expect(requeued?.attempts).toBe(1);
    expect(sentMessages[0].title).toBe("Tickets are live");
    expect(sentMessages[0].url).toContain("bookmyshow");
  });
});

describe("dispatchNotifications — claim race guard + bounded retry (zwapit-46i.4)", () => {
  const ALERT = {
    catalogItemId: "catalog_movie_1",
    city: "mumbai",
    date: "2026-06-25",
    format: "2D",
    alertTypes: ["availability" as const],
    channels: ["email" as const],
  };

  async function armAndOpenOne(tt: ReturnType<typeof t>) {
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, ALERT);
    __setFetcher(fetcherReturning(openBmsJson()));
    await tt.action(internal.watcher.pollDueTargets, { now: POLL_NOW });
    return (await tt.run((ctx) => ctx.db.query("notification_queue").collect()))[0];
  }

  test("claim prevents double-send: a row already 'sending' is not dispatched again", async () => {
    const tt = t();
    const row = await armAndOpenOne(tt);

    // First claim wins (pending → sending); a second claim loses (already sending).
    // Claim at POLL_NOW so claimedAt shares the dispatch's clock — otherwise the
    // wall-clock claim would look lease-stale to the far-future POLL_NOW dispatch.
    const first = await tt.mutation(internal.watcher.claimNotification, {
      notificationId: row._id,
      now: POLL_NOW,
    });
    expect(first.claimed).toBe(true);
    const second = await tt.mutation(internal.watcher.claimNotification, {
      notificationId: row._id,
      now: POLL_NOW,
    });
    expect(second.claimed).toBe(false);

    // Dispatch (same clock) finds nothing claimable (fresh 'sending'), so never sends.
    const sent: NotificationMessage[] = [];
    __setSenders({
      email: async (m): Promise<SenderResult> => { sent.push(m); return { sent: true }; },
      webpush: async (): Promise<SenderResult> => ({ sent: true }),
    });
    const dispatch = await tt.action(internal.watcher.dispatchNotifications, { now: POLL_NOW });
    expect(dispatch.sent).toBe(0);
    expect(sent).toHaveLength(0);

    const after = await tt.run((ctx) => ctx.db.get(row._id));
    expect(after?.status).toBe("sending"); // claimed but undispatched (no double-send)
  });

  test("transient fail then success: requeued to pending, the next wave delivers it", async () => {
    const tt = t();
    const row = await armAndOpenOne(tt);

    let calls = 0;
    __setSenders({
      email: async (m): Promise<SenderResult> => {
        calls += 1;
        if (calls === 1) throw new Error("smtp blip");
        return { sent: true };
      },
      webpush: async (): Promise<SenderResult> => ({ sent: true }),
    });

    const d1 = await tt.action(internal.watcher.dispatchNotifications, { now: POLL_NOW });
    expect(d1.sent).toBe(0);
    expect(d1.failed).toBe(1);
    const afterFail = await tt.run((ctx) => ctx.db.get(row._id));
    expect(afterFail?.status).toBe("pending"); // requeued
    expect(afterFail?.attempts).toBe(1);

    const d2 = await tt.action(internal.watcher.dispatchNotifications, { now: POLL_NOW });
    expect(d2.sent).toBe(1);
    const afterOk = await tt.run((ctx) => ctx.db.get(row._id));
    expect(afterOk?.status).toBe("sent");
  });

  test("persistent fail: parked as 'failed' after 3 attempts, no infinite loop", async () => {
    const tt = t();
    const row = await armAndOpenOne(tt);

    __setSenders({
      email: async (): Promise<SenderResult> => { throw new Error("smtp down"); },
      webpush: async (): Promise<SenderResult> => ({ sent: true }),
    });

    for (let i = 0; i < 3; i++) {
      await tt.action(internal.watcher.dispatchNotifications, { now: POLL_NOW });
    }
    const parked = await tt.run((ctx) => ctx.db.get(row._id));
    expect(parked?.status).toBe("failed");
    expect(parked?.attempts).toBe(3);

    // A 4th wave finds nothing pending → no further work, no loop.
    const d4 = await tt.action(internal.watcher.dispatchNotifications, { now: POLL_NOW });
    expect(d4.dispatched).toBe(0);
  });

  test("reclaims a stale 'sending' claim (crashed worker) and delivers it on a later wave", async () => {
    const tt = t();
    const row = await armAndOpenOne(tt);
    // Simulate a worker that claimed then died: stuck "sending" with an OLD claimedAt.
    await tt.run(async (ctx) => {
      await ctx.db.patch(row._id, { status: "sending", claimedAt: "2030-01-01T00:00:00.000Z" });
    });

    const sent: NotificationMessage[] = [];
    __setSenders({
      email: async (m): Promise<SenderResult> => { sent.push(m); return { sent: true }; },
      webpush: async (): Promise<SenderResult> => ({ sent: true }),
    });

    // A wave well past the 10-min lease reclaims the orphaned row and delivers it.
    const d = await tt.action(internal.watcher.dispatchNotifications, {
      now: "2030-01-01T00:20:00.000Z",
    });
    expect(d.sent).toBe(1);
    expect(sent).toHaveLength(1);
    const after = await tt.run((ctx) => ctx.db.get(row._id));
    expect(after?.status).toBe("sent");
  });
});

describe("getAlertPayoff — live payoff with deep-link OUT", () => {
  test("live target → payoff card with theatres + bookingUrl; only the caller's own alert", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedUser(tt, APP_B, BUYER_B.subject);
    await seedMovie(tt);
    const { wantKey } = await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
    });

    __setFetcher(fetcherReturning(openBmsJson()));
    await tt.action(internal.watcher.pollDueTargets, { now: POLL_NOW });

    const payoff = await tt.withIdentity(BUYER_A).query(api.watcher.getAlertPayoff, { wantKey });
    expect(payoff?.isLive).toBe(true);
    expect(payoff?.status).toBe("live");
    expect(payoff?.bookingUrl).toContain("bookmyshow");
    expect(payoff?.theatres).toContain("PVR Phoenix");

    // A01: another buyer cannot read this alert.
    const leaked = await tt.withIdentity(BUYER_B).query(api.watcher.getAlertPayoff, { wantKey });
    expect(leaked).toBeNull();
  });

  test("not-yet-live target → waiting state (not live, no bookingUrl)", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    const { wantKey } = await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
    });

    const payoff = await tt.withIdentity(BUYER_A).query(api.watcher.getAlertPayoff, { wantKey });
    expect(payoff?.isLive).toBe(false);
    expect(payoff?.status).toBe("watching");
  });
});

describe("expireWants — close a target once every subscriber's date has passed (zwapit-46i.1)", () => {
  // Watch date is 2026-06-25; this "now" is years later so the alert is unambiguously
  // past its watch window (mirrors POLL_NOW — only the watch DATE is fixed in fixtures).
  const PAST_EXPIRY_NOW = "2030-01-01T00:00:00.000Z";

  test("the only subscriber's past-date alert → want expired + target closed", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    const { wantKey } = await tt
      .withIdentity(BUYER_A)
      .mutation(api.watcher.createAlert, {
        catalogItemId: "catalog_movie_1",
        city: "mumbai",
        date: "2026-06-25",
        format: "2D",
      });

    const res = await tt.action(internal.watcher.expireWants, { now: PAST_EXPIRY_NOW });
    expect(res.expired).toBe(1);
    expect(res.closed).toBe(1);

    const { target, want } = await tt.run(async (ctx) => ({
      target: (await ctx.db.query("monitor_targets").collect())[0],
      want: (await ctx.db.query("wants").collect()).find((w) => w.wantKey === wantKey),
    }));
    expect(target?.status).toBe("closed");
    expect(target?.subscriberCount).toBe(0);
    expect(want?.state).toBe("expired");
    expect(want?.monitorTargetId).toBeUndefined();
  });

  test("two subscribers on the same past-date target → both expired, target closed once", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedUser(tt, APP_B, BUYER_B.subject);
    await seedMovie(tt);
    const args = {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
    };
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, args);
    await tt.withIdentity(BUYER_B).mutation(api.watcher.createAlert, args);

    const res = await tt.action(internal.watcher.expireWants, { now: PAST_EXPIRY_NOW });
    expect(res.expired).toBe(2);
    expect(res.closed).toBe(1); // one shared target closes exactly once

    const { target, wants } = await tt.run(async (ctx) => ({
      target: (await ctx.db.query("monitor_targets").collect())[0],
      wants: await ctx.db.query("wants").collect(),
    }));
    expect(target.status).toBe("closed");
    expect(target.subscriberCount).toBe(0);
    expect(wants.every((w) => w.state === "expired")).toBe(true);
  });

  test("a show TODAY is NOT expired — UTC end-of-day grace keeps it watching", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
    });

    // "now" is the morning of the watch date → end-of-day is still ahead, so a
    // bare-date expiresAt must NOT lexically expire the same-day show.
    const res = await tt.action(internal.watcher.expireWants, {
      now: "2026-06-25T06:00:00.000Z",
    });
    expect(res.expired).toBe(0);

    const { target, want } = await tt.run(async (ctx) => ({
      target: (await ctx.db.query("monitor_targets").collect())[0],
      want: (await ctx.db.query("wants").collect())[0],
    }));
    expect(target.status).toBe("watching");
    expect(want.state).toBe("open");
  });

  test("idempotent — a second run expires nothing new and leaves the target closed", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
    });

    const first = await tt.action(internal.watcher.expireWants, { now: PAST_EXPIRY_NOW });
    expect(first.expired).toBe(1);
    const second = await tt.action(internal.watcher.expireWants, { now: PAST_EXPIRY_NOW });
    expect(second.expired).toBe(0);
    expect(second.closed).toBe(0);

    const target = await tt.run(
      async (ctx) => (await ctx.db.query("monitor_targets").collect())[0],
    );
    expect(target.status).toBe("closed");
  });

  test("stops past-date polling — a closed target is no longer polled", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
    });

    await tt.action(internal.watcher.expireWants, { now: PAST_EXPIRY_NOW });

    // Even with an OPEN fetcher, a closed target is excluded from dueTargets → no poll.
    __setFetcher(fetcherReturning(openBmsJson()));
    const poll = await tt.action(internal.watcher.pollDueTargets, { now: PAST_EXPIRY_NOW });
    expect(poll.polled).toBe(0);
    expect(poll.detected).toBe(0);
  });

  test("does not starve a later-created expired alert behind an older non-expiring want", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    // Oldest open want: a non-alert demand want (no monitorTargetId) with a FAR-FUTURE
    // expiry. With a createdAt-ordered take(limit) prefix this fills the only slot and
    // hides the alert behind it — the bug CodeRabbit flagged.
    await tt.run(async (ctx) => {
      await ctx.db.insert("wants", {
        wantKey: "want_demand_future",
        buyerId: APP_A,
        catalogItemId: "catalog_movie_1",
        category: "movie_ticket",
        quantity: 1,
        maxPricePerUnit: 0,
        state: "open",
        expiresAt: "2999-01-01",
        createdAt: "2000-01-01T00:00:00.000Z",
      });
    });
    // Later-created alert want with a PAST watch date (createAlert stamps createdAt ~now).
    const { wantKey } = await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, {
      catalogItemId: "catalog_movie_1",
      city: "mumbai",
      date: "2026-06-25",
      format: "2D",
    });

    // limit=1 makes the starvation observable: a take(1)+filter prefix returns the
    // future demand want → filters to empty → expired alert never reached.
    const res = await tt.action(internal.watcher.expireWants, { now: PAST_EXPIRY_NOW, limit: 1 });
    expect(res.expired).toBe(1);

    const want = await tt.run(async (ctx) =>
      (await ctx.db.query("wants").collect()).find((w) => w.wantKey === wantKey),
    );
    expect(want?.state).toBe("expired");
  });
});

describe("crons — poll job registered (Task 10)", () => {
  test("poll-availability is scheduled on an interval to watcher.pollDueTargets", () => {
    const registered = (crons as unknown as {
      crons: Record<string, { name: string; schedule: { type: string; minutes?: number } }>;
    }).crons;
    const poll = registered["poll-availability"];
    expect(poll).toBeTruthy();
    expect(poll.name).toBe("watcher:pollDueTargets");
    expect(poll.schedule.type).toBe("interval");
    expect(poll.schedule.minutes).toBeGreaterThan(0);

    const dispatch = registered["dispatch-notifications"];
    expect(dispatch?.name).toBe("watcher:dispatchNotifications");

    const expire = registered["expire-wants"];
    expect(expire?.name).toBe("watcher:expireWants");
  });
});
