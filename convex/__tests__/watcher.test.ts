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
  test("pending → sent with a mock sender; a throwing sender → failed", async () => {
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
    expect(dispatch.failed).toBe(1);

    const notifs = await tt.run((ctx) => ctx.db.query("notification_queue").collect());
    const byStatus = (s: string) => notifs.filter((n) => n.status === s).length;
    expect(byStatus("sent")).toBe(1);
    expect(byStatus("failed")).toBe(1);
    expect(sentMessages[0].title).toBe("Tickets are live");
    expect(sentMessages[0].url).toContain("bookmyshow");
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
  });
});
