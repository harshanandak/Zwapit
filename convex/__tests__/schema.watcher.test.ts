import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../schema";

// convex-test resolves Convex functions by globbing the module tree. Bun's test
// runner has no `import.meta.glob`, so we hand it an explicit modules map that
// includes a `_generated` path (which is all `findModulesRoot` needs). This
// schema test only uses `t.run` + `ctx.db`, so no function modules are required.
const modules = {
  "../convex/_generated/api.js": () => import("../_generated/api.js"),
};

const testDb = () => convexTest(schema, modules);

describe("watcher schema migration", () => {
  test("monitor_targets accepts a new doc", async () => {
    const t = testDb();
    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("monitor_targets", {
        collapseKey: "catalog_movie_1|mumbai|2026-06-25|2D",
        catalogItemId: "catalog_movie_1",
        city: "mumbai",
        date: "2026-06-25",
        format: "2D",
        sources: ["bms", "district"],
        status: "watching",
        subscriberCount: 1,
        nextCheckAt: "2026-06-22T10:00:00.000Z",
      });
    });
    expect(id).toBeTruthy();

    const doc = await t.run(async (ctx) => ctx.db.get(id));
    expect(doc?.status).toBe("watching");
    expect(doc?.subscriberCount).toBe(1);
  });

  test("catalog_items accepts the new source-code + geo fields", async () => {
    const t = testDb();
    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("catalog_items", {
        catalogKey: "catalog_movie_1",
        kind: "movie",
        externalSource: "tmdb",
        externalId: "tmdb_123",
        title: "Demo Movie",
        isActive: true,
        lastSyncedAt: "2026-06-22T09:00:00.000Z",
        // new additive watcher fields:
        bmsEventCode: "ET00123456",
        bmsRegionCode: "MUMBAI",
        bmsVenueCode: "BMSV01",
        districtMvCode: "MV12345",
        districtCdCode: "CD678",
        districtCitySlug: "mumbai",
        lat: 19.076,
        long: 72.8777,
      });
    });
    expect(id).toBeTruthy();

    const doc = await t.run(async (ctx) => ctx.db.get(id));
    expect(doc?.bmsEventCode).toBe("ET00123456");
    expect(doc?.districtMvCode).toBe("MV12345");
  });

  test("catalog_items still accepts a doc WITHOUT the new fields (additive)", async () => {
    const t = testDb();
    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("catalog_items", {
        catalogKey: "catalog_movie_legacy",
        kind: "movie",
        externalSource: "tmdb",
        title: "Legacy Movie",
        isActive: true,
        lastSyncedAt: "2026-06-22T09:00:00.000Z",
      });
    });
    expect(id).toBeTruthy();
  });

  test("wants accepts the new alert fields", async () => {
    const t = testDb();
    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("wants", {
        wantKey: "want_alert_1",
        buyerId: "user_demo_1",
        catalogItemId: "catalog_movie_1",
        category: "movie_ticket",
        quantity: 2,
        maxPricePerUnit: 300,
        state: "open",
        expiresAt: "2026-06-30T00:00:00.000Z",
        createdAt: "2026-06-22T09:00:00.000Z",
        // new additive alert fields:
        watchCity: "mumbai",
        watchDate: "2026-06-25",
        watchFormat: "2D",
        alertTypes: ["availability", "last_minute"],
        channels: ["email", "web_push"],
        monitorTargetId: "monitor_target_1",
      });
    });
    expect(id).toBeTruthy();
  });

  test("availability_events, notification_queue, source_snapshots accept docs", async () => {
    const t = testDb();
    await t.run(async (ctx) => {
      const eventId = await ctx.db.insert("availability_events", {
        monitorTargetId: "monitor_target_1",
        source: "bms",
        detectedAt: "2026-06-22T10:05:00.000Z",
        theatresJson: JSON.stringify([{ theatreName: "PVR", showTime: "18:00" }]),
        bookingUrl: "https://in.bookmyshow.com/movies/demo",
        snapshotHash: "hash_abc123",
      });
      expect(eventId).toBeTruthy();

      const notifId = await ctx.db.insert("notification_queue", {
        userId: "user_demo_1",
        monitorTargetId: "monitor_target_1",
        availabilityEventId: "availability_event_1",
        alertType: "availability",
        channel: "email",
        status: "pending",
        dedupeKey: "user_demo_1|monitor_target_1|availability_event_1|availability|email",
        createdAt: "2026-06-22T10:05:00.000Z",
      });
      expect(notifId).toBeTruthy();

      const snapId = await ctx.db.insert("source_snapshots", {
        monitorTargetId: "monitor_target_1",
        source: "bms",
        snapshotHash: "hash_abc123",
        fetchedAt: "2026-06-22T10:05:00.000Z",
      });
      expect(snapId).toBeTruthy();
    });
  });

  test("audit_logs accepts the new watcher entity types", async () => {
    const t = testDb();
    await t.run(async (ctx) => {
      for (const entityType of ["monitor_target", "availability_event", "notification"] as const) {
        const id = await ctx.db.insert("audit_logs", {
          actorId: "system",
          actorRole: "system",
          action: "created",
          entityType,
          entityId: `${entityType}_1`,
          seq: 1,
          createdAt: "2026-06-22T10:05:00.000Z",
        });
        expect(id).toBeTruthy();
      }
    });
  });

  test("existing tables still accept existing docs (non-breaking)", async () => {
    const t = testDb();
    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        appUserId: "user_demo_1",
        role: "buyer_seller",
        phoneVerified: false,
        displayName: "Demo",
      });
    });
    expect(id).toBeTruthy();
  });

  test("curated (non-polled) availability: empty sources + source 'curated' (events)", async () => {
    const t = testDb();
    await t.run(async (ctx) => {
      // A curated event target carries NO pollable source — it is admin-driven.
      const targetId = await ctx.db.insert("monitor_targets", {
        collapseKey: "catalog_event_1|mumbai|2027-02-14",
        catalogItemId: "catalog_event_1",
        city: "mumbai",
        date: "2027-02-14",
        sources: [],
        status: "watching",
        subscriberCount: 1,
        nextCheckAt: "2026-06-26T10:00:00.000Z",
      });
      expect(targetId).toBeTruthy();

      // Availability recorded by the curated/admin path uses source "curated".
      const eventId = await ctx.db.insert("availability_events", {
        monitorTargetId: "monitor_target_event_1",
        source: "curated",
        detectedAt: "2026-06-26T10:05:00.000Z",
        theatresJson: JSON.stringify([
          { theatreName: "Manpho Convention Centre", showTime: "19:00" },
        ]),
        bookingUrl: "https://in.bookmyshow.com/events/demo",
        snapshotHash: "hash_curated_1",
      });
      expect(eventId).toBeTruthy();
    });
  });
});
