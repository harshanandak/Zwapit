import { afterEach, describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";

import { api, internal } from "../_generated/api";
import schema from "../schema";
import { __setFetcher, __setSenders } from "../watcher";
import type { ParallelExtractResponse } from "../watcher/adapters";

// convex-test globs the module tree; Bun has no import.meta.glob, so we hand it an
// explicit map of every function module the tests touch (transitively). Mirrors
// watcher.test.ts so the e2e path runs the SAME real functions, not a fake DB.
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
const APP_A = "app_buyer_a";

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

const ALERT_ARGS = {
  catalogItemId: "catalog_movie_1",
  city: "mumbai",
  date: "2026-06-25",
  format: "2D",
  alertTypes: ["availability" as const],
  channels: ["email" as const],
};

afterEach(() => {
  __setFetcher(null);
  __setSenders(null);
});

describe("watcher e2e — full happy path through the real poll", () => {
  test("seed → createAlert → open poll → live + event + notification → live payoff with deep-link OUT", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);

    // Arm the alert as the authenticated buyer (the only client mutation).
    const { wantKey, monitorTargetId } = await tt
      .withIdentity(BUYER_A)
      .mutation(api.watcher.createAlert, ALERT_ARGS);
    expect(wantKey).toBeTruthy();
    expect(monitorTargetId).toBeTruthy();

    // Before the poll the target is still watching (payoff not yet live).
    const pre = await tt.withIdentity(BUYER_A).query(api.watcher.getAlertPayoff, { wantKey });
    expect(pre?.isLive).toBe(false);
    expect(pre?.status).toBe("watching");

    // Inject an OPEN fetcher and run the REAL poll loop (not hand-inserted state).
    __setFetcher(fetcherReturning(openBmsJson()));
    const poll = await tt.action(internal.watcher.pollDueTargets, { now: POLL_NOW });
    expect(poll.detected).toBe(1);

    const { target, events, notifs } = await tt.run(async (ctx) => ({
      target: (await ctx.db.query("monitor_targets").collect())[0],
      events: await ctx.db.query("availability_events").collect(),
      notifs: await ctx.db.query("notification_queue").collect(),
    }));

    // Target flipped live, exactly one availability event, one pending notification
    // for the subscriber on their email channel.
    expect(target.status).toBe("live");
    expect(events).toHaveLength(1);
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    const pending = notifs.filter((n) => n.status === "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0].userId).toBe(APP_A);
    expect(pending[0].channel).toBe("email");
    expect(pending[0].monitorTargetId).toBe(target._id);

    // getAlertPayoff returns the LIVE shape with a correct http(s) BMS deep-link.
    const payoff = await tt.withIdentity(BUYER_A).query(api.watcher.getAlertPayoff, { wantKey });
    expect(payoff?.status).toBe("live");
    expect(payoff?.isLive).toBe(true);
    expect(payoff?.theatres).toContain("PVR Phoenix");
    expect(payoff?.showtimes?.length).toBeGreaterThanOrEqual(1);
    expect(payoff?.showtimes?.[0]).toMatchObject({ theatre: "PVR Phoenix", time: "18:30" });
    expect(typeof payoff?.bookingUrl).toBe("string");
    expect(payoff?.bookingUrl).toMatch(/^https?:\/\//);
    expect(payoff?.bookingUrl).toContain("bookmyshow");
  });

  test("a second identical poll (same snapshotHash) adds NO new availability event", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, ALERT_ARGS);

    __setFetcher(fetcherReturning(openBmsJson()));
    await tt.action(internal.watcher.pollDueTargets, { now: POLL_NOW });

    const notifsBefore = await tt.run((ctx) => ctx.db.query("notification_queue").collect());

    // Reopen the poll window and poll again with the SAME fixture (same hash).
    await tt.run(async (ctx) => {
      const target = (await ctx.db.query("monitor_targets").collect())[0];
      await ctx.db.patch(target._id, { status: "watching", nextCheckAt: POLL_NOW });
    });
    await tt.action(internal.watcher.pollDueTargets, { now: POLL_NOW });

    const { events, notifsAfter } = await tt.run(async (ctx) => ({
      events: await ctx.db.query("availability_events").collect(),
      notifsAfter: await ctx.db.query("notification_queue").collect(),
    }));
    expect(events).toHaveLength(1); // snapshot dedup: identical hash is a no-op
    // No new event ⇒ no new notification enqueued on the re-poll.
    expect(notifsAfter).toHaveLength(notifsBefore.length);
  });
});

describe("watcher e2e — by-event BMS routing", () => {
  test("a movie row (eventCode+regionCode, NO venueCode) takes the byevent URL branch → detection", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    // No bmsVenueCode → buildBmsUrl/targetSourceUrls routes to the byevent URL.
    await seedMovie(tt, "catalog_movie_1", {
      bmsEventCode: "ET00000001",
      bmsRegionCode: "BANG",
    });
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, ALERT_ARGS);

    // The injected fetcher echoes the SAME open ShowDetails fixture for whatever
    // URL is requested — here that URL is the byevent endpoint.
    __setFetcher(fetcherReturning(openBmsJson()));
    const poll = await tt.action(internal.watcher.pollDueTargets, { now: POLL_NOW });
    expect(poll.detected).toBe(1);

    const { target, events } = await tt.run(async (ctx) => ({
      target: (await ctx.db.query("monitor_targets").collect())[0],
      events: await ctx.db.query("availability_events").collect(),
    }));
    expect(target.status).toBe("live");
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("bms");
  });
});

describe("watcher e2e — degrade path", () => {
  test("3 consecutive throwing polls → degraded with NO notifications", async () => {
    const tt = t();
    await seedUser(tt, APP_A, BUYER_A.subject);
    await seedMovie(tt);
    await tt.withIdentity(BUYER_A).mutation(api.watcher.createAlert, ALERT_ARGS);

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
});
