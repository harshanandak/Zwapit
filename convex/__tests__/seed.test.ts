import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";

import { api } from "../_generated/api";
import schema from "../schema";

// convex-test globs the module tree; Bun has no import.meta.glob, so we hand it
// an explicit map of every function module the test touches (transitively). The
// seed mutation pulls in the watcher parse/model helpers, but those are imported
// as plain modules (not via api/internal), so only the function modules invoked
// through `api`/`internal` need listing here.
const modules = {
  "../convex/_generated/api.js": () => import("../_generated/api.js"),
  "../convex/seed.js": () => import("../seed"),
};

const t = () => convexTest(schema, modules);

describe("seedDemoFixture — watcher demo slice", () => {
  test("seeds ONE watcher target + its linked want (idempotently)", async () => {
    const tt = t();

    await tt.mutation(api.seed.seedDemoFixture, {});

    const { catalog, targets, want } = await tt.run(async (ctx) => {
      const catalog = await ctx.db
        .query("catalog_items")
        .withIndex("by_key", (q) => q.eq("catalogKey", "catalog_movie_watcher_demo"))
        .unique();
      const targets = await ctx.db
        .query("monitor_targets")
        .withIndex("by_collapse_key", (q) =>
          q.eq("collapseKey", "catalog_movie_watcher_demo|mumbai|2026-12-19|IMAX 3D"),
        )
        .collect();
      const want = targets[0]
        ? await ctx.db
            .query("wants")
            .withIndex("by_monitor_target", (q) => q.eq("monitorTargetId", targets[0]._id))
            .unique()
        : null;
      return { catalog, targets, want };
    });

    // Catalog row carries BOTH BMS codes AND District codes.
    expect(catalog).toBeTruthy();
    expect(catalog?.kind).toBe("movie");
    expect(catalog?.bmsEventCode).toBeTruthy();
    expect(catalog?.bmsRegionCode).toBeTruthy();
    expect(catalog?.bmsVenueCode).toBeTruthy();
    expect(catalog?.districtMvCode).toBeTruthy();
    expect(catalog?.districtCdCode).toBeTruthy();
    expect(catalog?.districtCitySlug).toBeTruthy();

    // Exactly ONE shared monitor target on the exact collapseKey, watching, 1 sub.
    expect(targets).toHaveLength(1);
    expect(targets[0].status).toBe("watching");
    expect(targets[0].subscriberCount).toBe(1);
    expect(targets[0].sources).toEqual(["bms", "district"]);

    // ONE linked want carrying the watcher alert fields.
    expect(want).toBeTruthy();
    expect(want?.monitorTargetId).toBe(targets[0]._id);
    expect(want?.catalogItemId).toBe("catalog_movie_watcher_demo");
    expect(want?.alertTypes).toEqual(["availability"]);
    expect(want?.channels).toEqual(["email"]);
    expect(want?.watchCity).toBe("mumbai");
    expect(want?.watchDate).toBe("2026-12-19");
    expect(want?.watchFormat).toBe("IMAX 3D");
    expect(want?.wantKey).toStartWith("want_alert_v2~");
    expect(want?.collapseKey).toBe(
      "catalog_movie_watcher_demo|mumbai|2026-12-19|IMAX 3D",
    );
  });

  test("re-running seedDemoFixture does NOT duplicate the target or inflate subscriberCount", async () => {
    const tt = t();

    await tt.mutation(api.seed.seedDemoFixture, {});
    await tt.mutation(api.seed.seedDemoFixture, {});

    const { catalogCount, targets, wants } = await tt.run(async (ctx) => {
      const catalog = await ctx.db
        .query("catalog_items")
        .withIndex("by_key", (q) => q.eq("catalogKey", "catalog_movie_watcher_demo"))
        .collect();
      const targets = await ctx.db
        .query("monitor_targets")
        .withIndex("by_collapse_key", (q) =>
          q.eq("collapseKey", "catalog_movie_watcher_demo|mumbai|2026-12-19|IMAX 3D"),
        )
        .collect();
      const wants = targets[0]
        ? await ctx.db
            .query("wants")
            .withIndex("by_monitor_target", (q) => q.eq("monitorTargetId", targets[0]._id))
            .collect()
        : [];
      return { catalogCount: catalog.length, targets, wants };
    });

    expect(catalogCount).toBe(1);
    expect(targets).toHaveLength(1);
    expect(targets[0].subscriberCount).toBe(1);
    expect(wants).toHaveLength(1);
  });

  test("re-running preserves an exact legacy seed want regardless of its old key format", async () => {
    for (const legacy of [
      { key: "want_alert_legacy_hashed", keepCollapseKey: true },
      { key: "want_alert_legacy_sanitized", keepCollapseKey: false },
    ]) {
      const tt = t();
      await tt.mutation(api.seed.seedDemoFixture, {});
      await tt.run(async (ctx) => {
        const want = (await ctx.db.query("wants").collect()).find(
          (row) => row.catalogItemId === "catalog_movie_watcher_demo",
        )!;
        await ctx.db.patch(want._id, {
          wantKey: legacy.key,
          ...(legacy.keepCollapseKey ? {} : { collapseKey: undefined }),
        });
      });

      await tt.mutation(api.seed.seedDemoFixture, {});

      const state = await tt.run(async (ctx) => ({
        wants: (await ctx.db.query("wants").collect()).filter(
          (row) => row.catalogItemId === "catalog_movie_watcher_demo",
        ),
        target: (
          await ctx.db
            .query("monitor_targets")
            .withIndex("by_collapse_key", (q) =>
              q.eq(
                "collapseKey",
                "catalog_movie_watcher_demo|mumbai|2026-12-19|IMAX 3D",
              ),
            )
            .unique()
        )!,
      }));
      expect(state.wants).toHaveLength(1);
      expect(state.wants[0].wantKey).toBe(legacy.key);
      expect(state.target.subscriberCount).toBe(1);
    }
  });

  // events-phase2 T4: the events watcher relies on curated live_event catalog rows
  // (no BMS/District codes → createAlert yields a curated, sources:[] target). Lock
  // that contract so a later edit (e.g. adding source codes) can't silently break
  // the curated path.
  test("seeds curated live_event rows that stay alert-ready (no source codes)", async () => {
    const tt = t();
    await tt.mutation(api.seed.seedDemoFixture, {});

    const events = await tt.run((ctx) =>
      ctx.db
        .query("catalog_items")
        .withIndex("by_kind_active", (q) => q.eq("kind", "live_event").eq("isActive", true))
        .collect(),
    );

    expect(events.length).toBeGreaterThanOrEqual(2); // Alan Walker + Coldplay
    for (const e of events) {
      expect(e.city).toBeTruthy();
      expect(e.startAt).toBeTruthy();
      // Curated: NO pollable source codes, so the watcher never polls these.
      expect(e.bmsEventCode).toBeUndefined();
      expect(e.bmsVenueCode).toBeUndefined();
      expect(e.districtMvCode).toBeUndefined();
      expect(e.districtCdCode).toBeUndefined();
    }
  });
});
