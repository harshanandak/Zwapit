// Catalog read model. The Search screen's "Official" results come from active
// catalog_items (movies/live events/bus routes). Read-only — arming an availability
// alert ("Notify me") is an internal-only/audited mutation and is not exposed here.

import { query } from "./_generated/server";
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
