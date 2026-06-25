// Catalog read model. The Search screen's "Official" results come from active
// catalog_items (movies/live events/bus routes). Read-only — arming an availability
// alert ("Notify me") is an internal-only/audited mutation and is not exposed here.

import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

// Keep this shape in sync with the identical OfficialCatalogItem in
// src/lib/convex/dataAdapter.ts — the client can't import Convex types across the
// boundary, so the two declarations are intentionally duplicated. Update both together.
export interface OfficialCatalogItem {
  /** catalogKey — the stable public id. */
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  city: string | null;
  venueOrDestination: string | null;
  startAt: string | null;
}

function catalogDocToMock(doc: Doc<"catalog_items">): OfficialCatalogItem {
  return {
    id: doc.catalogKey,
    kind: doc.kind,
    title: doc.title,
    subtitle: doc.subtitle ?? null,
    city: doc.city ?? null,
    venueOrDestination: doc.venueOrDestination ?? null,
    startAt: doc.startAt ?? null,
  };
}

// Active catalog items for the Search official rail.
export const getOfficialCatalog = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("catalog_items").collect();
    return docs.filter((d) => d.isActive).map(catalogDocToMock);
  },
});

// INTERNAL — catalog ingestion from a crawled source (BMS/District). Not client-exposed
// (per CLAUDE.md "internal functions for sensitive operations"): the external crawler — which runs
// the residential/Parallel egress because BMS 403s datacenter (incl. Convex) — calls this via an
// admin-authed client / `convex run` after fetching + parsing + hydrating. Idempotent upsert by
// (externalSource, externalId); unchanged rows are simply patched to the same values.
export const upsertMoviesFromSource = internalMutation({
  args: {
    source: v.union(v.literal("bookmyshow"), v.literal("district")),
    syncedAt: v.string(),
    movies: v.array(
      v.object({
        externalId: v.string(), // BMS ET code (stable key)
        catalogKey: v.string(), // e.g. bms_ET00000652
        title: v.string(),
        subtitle: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        sourceLastmod: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({ created: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    let created = 0;
    let updated = 0;
    for (const m of args.movies) {
      const existing = await ctx.db
        .query("catalog_items")
        .withIndex("by_external", (q) => q.eq("externalSource", args.source).eq("externalId", m.externalId))
        .unique();
      const row = {
        catalogKey: m.catalogKey,
        kind: "movie" as const,
        externalSource: args.source,
        externalId: m.externalId,
        title: m.title,
        subtitle: m.subtitle,
        imageUrl: m.imageUrl,
        isActive: true,
        lastSyncedAt: args.syncedAt,
        sourceLastmod: m.sourceLastmod,
      };
      if (existing) {
        await ctx.db.patch(existing._id, row);
        updated += 1;
      } else {
        await ctx.db.insert("catalog_items", row);
        created += 1;
      }
    }
    return { created, updated };
  },
});
