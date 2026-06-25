// Official-availability watcher engine (design 2026-06-22).
//
// Architecture — thin action / fat mutation:
//   - All DB work lives in internal mutations/queries (use ctx.db).
//   - Actions (pollDueTargets / dispatchNotifications) are THIN: they call the
//     injected fetcher/senders, run the PURE parse helpers, then hand results to
//     internal mutations via runMutation. Convex actions have no ctx.db, so this
//     is the only correct seam (and it makes the mutations testable injection-free).
//
// Constraints (design §Constraints):
//   - matching/monitor/availability/notification mutations are internal* — never
//     client-callable. Only createAlert (mutation) + getAlertPayoff (query) face
//     the client, and both authorize via the existing identity helper (A01).
//   - Every state transition writes an audit_logs row (A09).
//   - Deep-link OUT only: bookingUrl is always the official BMS/District page.
//   - No secrets in code: PARALLEL_API_KEY etc. via env; tests inject mocks.

import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAuthenticatedAppUser } from "./identity";
import {
  appendWatcherAuditLog,
  catalogItemByKey,
  latestAvailabilityEvent,
  monitorTargetByCollapseKey,
  subscribersForTarget,
  upsertSourceSnapshot,
} from "./model";
import {
  buildBmsUrl,
  buildDistrictUrl,
  type ParallelFetcher,
  type ParallelResult,
  type SourceUrl,
  defaultParallelFetch,
} from "./watcher/adapters";
import {
  computeCollapseKey,
  parseBmsByVenue,
  parseDistrictMovieCity,
  officialBookingUrl,
  snapshotHash,
  unionAndDedupe,
  type UnionResult,
  type VenueMap,
} from "./watcher/parse";
import {
  buildLiveMessage,
  defaultSenders,
  type Senders,
} from "./watcher/senders";
import type { NormalizedShow } from "./watcher/types";

// Degrade threshold: K consecutive empty/blocked polls → "degraded" (design §Edge).
const DEGRADE_AFTER = 3;
// Delivered alert types in this slice (design §Out of scope): Discount / Price-drop
// are captured on the want but NOT delivered yet.
const DELIVERED_ALERT_TYPES = ["availability", "last_minute"] as const;
type DeliveredAlertType = (typeof DELIVERED_ALERT_TYPES)[number];

// ---------------------------------------------------------------------------
// Injectable seams (module-scoped). Production uses the env-gated defaults;
// tests call __setFetcher / __setSenders and reset in afterEach. This is the
// only seam an action needs — the mutations/queries are injection-free.
// ---------------------------------------------------------------------------

let activeFetcher: ParallelFetcher = defaultParallelFetch;
let activeSenders: Senders = defaultSenders;

/** TEST-ONLY: swap the Parallel fetcher. */
export function __setFetcher(fetcher: ParallelFetcher | null): void {
  activeFetcher = fetcher ?? defaultParallelFetch;
}
/** TEST-ONLY: swap the notification senders. */
export function __setSenders(senders: Senders | null): void {
  activeSenders = senders ?? defaultSenders;
}

// ---------------------------------------------------------------------------
// Validators (shared shapes)
// ---------------------------------------------------------------------------

const alertTypeV = v.union(
  v.literal("availability"),
  v.literal("discount"),
  v.literal("price_drop"),
  v.literal("last_minute"),
);
const channelV = v.union(v.literal("email"), v.literal("web_push"));
const sourceV = v.union(v.literal("bms"), v.literal("district"));

const normalizedShowV = v.object({
  source: sourceV,
  theatreName: v.string(),
  venueCode: v.optional(v.string()),
  showTime: v.string(),
  format: v.string(),
  status: v.optional(
    v.union(
      v.literal("sold_out"),
      v.literal("almost_full"),
      v.literal("filling_fast"),
      v.literal("available"),
    ),
  ),
  bookingUrl: v.optional(v.string()),
});

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Default windowed cadence: re-check a still-watching target in N minutes. */
function nextCheckAfter(nowMs: number, minutes = 5): string {
  return new Date(nowMs + minutes * 60_000).toISOString();
}

/** Narrow the delivered alert types from a want's captured alertTypes. */
function deliveredAlertTypesFor(want: { alertTypes?: string[] }): DeliveredAlertType[] {
  const captured = want.alertTypes ?? ["availability"];
  return DELIVERED_ALERT_TYPES.filter((t) => captured.includes(t));
}

/** The channels a want subscribed to (defaults to email if none captured). */
function channelsFor(want: { channels?: string[] }): Array<"email" | "web_push"> {
  const channels = want.channels ?? ["email"];
  return channels.filter((c): c is "email" | "web_push" => c === "email" || c === "web_push");
}

function dedupeKey(parts: {
  userId: string;
  monitorTargetId: string;
  availabilityEventId: string;
  alertType: string;
  channel: string;
}): string {
  return [
    parts.userId,
    parts.monitorTargetId,
    parts.availabilityEventId,
    parts.alertType,
    parts.channel,
  ].join("|");
}

// ===========================================================================
// CLIENT mutation: createAlert (Task 4)
// ===========================================================================

/** Validate + normalize createAlert's client input (trim; reject empty city /
 * malformed date) so semantically-identical alerts collapse and malformed ones are
 * never persisted. Extracted to keep createAlert's cognitive complexity down. */
function normalizeAlertInput(args: {
  city: string;
  date: string;
  format?: string;
}): { city: string; date: string; format?: string } {
  const city = args.city.trim();
  const date = args.date.trim();
  const format = args.format?.trim() || undefined;
  if (!city) throw new Error("ALERT_CITY_REQUIRED");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error("ALERT_DATE_INVALID");
  }
  return { city, date, ...(format ? { format } : {}) };
}

/**
 * Create (or update) the caller's alert for a movie + city + date [+ format] and
 * find-or-create the shared monitor_targets row. Idempotent on collapseKey: two
 * DIFFERENT buyers on the same show → ONE target, subscriberCount = 2. The SAME
 * buyer re-arming the same show updates their want without inflating the count.
 *
 * Late-subscriber: if the target is already `live`, the new subscriber is
 * enqueued immediately from the last availability_event (design §Edge cases) —
 * no re-poll. authorize via the existing identity helper (A01).
 */
export const createAlert = mutation({
  args: {
    catalogItemId: v.string(),
    city: v.string(),
    date: v.string(),
    format: v.optional(v.string()),
    alertTypes: v.optional(v.array(alertTypeV)),
    channels: v.optional(v.array(channelV)),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedAppUser(ctx);
    const buyerId = user.appUserId;

    const catalogItem = await catalogItemByKey(ctx, args.catalogItemId);
    if (!catalogItem) throw new Error("CATALOG_ITEM_NOT_FOUND");

    // Validate + normalize client input before it flows into the collapse key,
    // monitor_targets, wants.expiresAt and source URLs (coding guideline: validate
    // all user input). See normalizeAlertInput.
    const { city, date, format } = normalizeAlertInput(args);

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const collapseKey = computeCollapseKey({
      catalogItemId: args.catalogItemId,
      city,
      date,
      format,
    });

    // Platform routing: a target only watches sources whose codes the catalog row
    // actually has (design §Edge: one source has the show).
    const sources: Array<"bms" | "district"> = [];
    if (buildBmsUrl(catalogItem, date) !== null) sources.push("bms");
    if (buildDistrictUrl(catalogItem, date) !== null) sources.push("district");
    // Reject alerts that no official source can watch — otherwise pollDueTargets
    // fetches nothing and reschedules forever, leaving the user an inert alert.
    if (sources.length === 0) throw new Error("NO_WATCHABLE_SOURCE");

    // ---- find-or-create the shared monitor target ----
    let target = await monitorTargetByCollapseKey(ctx, collapseKey);
    let targetId: string;
    if (!target) {
      const insertedId = await ctx.db.insert("monitor_targets", {
        collapseKey,
        catalogItemId: args.catalogItemId,
        city,
        date,
        ...(format ? { format } : {}),
        sources,
        status: "watching",
        subscriberCount: 0,
        failCount: 0,
        nextCheckAt: nowIso,
      });
      target = (await ctx.db.get(insertedId))!;
      targetId = insertedId;
      await appendWatcherAuditLog(ctx, {
        actorId: "system",
        action: "monitor_target_created",
        entityType: "monitor_target",
        entityId: collapseKey,
        toState: "watching",
        createdAt: nowIso,
      });
    } else {
      targetId = target._id;
    }

    const alertTypes = args.alertTypes ?? (["availability"] as const);
    const channels = args.channels ?? (["email"] as const);

    // ---- find-or-create THIS buyer's want for the target (dedupe per buyer) ----
    const existingForBuyer = (await subscribersForTarget(ctx, targetId)).find(
      (w) => w.buyerId === buyerId,
    );

    let wantKey: string;
    let isNewSubscriber = false;
    if (existingForBuyer) {
      await ctx.db.patch(existingForBuyer._id, {
        watchCity: city,
        watchDate: date,
        ...(format ? { watchFormat: format } : {}),
        alertTypes: [...alertTypes],
        channels: [...channels],
        monitorTargetId: targetId,
      });
      wantKey = existingForBuyer.wantKey;
    } else {
      isNewSubscriber = true;
      wantKey = `want_alert_${buyerId}_${collapseKey}`.replace(/[^a-zA-Z0-9_]/g, "_");
      await ctx.db.insert("wants", {
        wantKey,
        buyerId,
        catalogItemId: args.catalogItemId,
        category: "movie_ticket",
        quantity: 1,
        maxPricePerUnit: 0,
        state: "open",
        expiresAt: date,
        createdAt: nowIso,
        watchCity: city,
        watchDate: date,
        ...(format ? { watchFormat: format } : {}),
        alertTypes: [...alertTypes],
        channels: [...channels],
        monitorTargetId: targetId,
      });
      await ctx.db.patch(target._id, { subscriberCount: target.subscriberCount + 1 });
    }

    // Late subscriber on an already-live target → notify immediately from last event.
    if (isNewSubscriber && target.status === "live") {
      const lastEvent = await latestAvailabilityEvent(ctx, targetId);
      if (lastEvent) {
        await enqueueForEvent(ctx, lastEvent._id, nowIso);
      }
    }

    return { wantKey, monitorTargetId: targetId, collapseKey };
  },
});

// ===========================================================================
// INTERNAL mutation: recordAvailability (Task 5)
// ===========================================================================

/**
 * Record a detected open for a target. Snapshot-hash dedup: if the hash matches
 * the cached source_snapshots row, it's a no-op (no new event, no re-fire). Else
 * writes an availability_events row, upserts the snapshot cache, and advances the
 * target watching → live on the first open. Returns the new event id (or null).
 */
export const recordAvailability = internalMutation({
  args: {
    monitorTargetId: v.id("monitor_targets"),
    source: sourceV,
    normalized: v.array(normalizedShowV),
    bookingUrl: v.string(),
    detectedAt: v.string(),
    snapshotHash: v.string(),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.monitorTargetId);
    if (!target) throw new Error("MONITOR_TARGET_NOT_FOUND");

    // Dedup against the TARGET UNION hash (target.lastSnapshotHash), NOT the
    // per-(target, source) cache. pollDueTargets hashes the whole cross-source
    // union and records under whichever source won the booking URL, so the
    // primary source can flip (bms→district) on an UNCHANGED union. Gating on the
    // per-source cache would miss that flip and re-fire; gating on the union hash
    // is independent of which source won, so an unchanged union is a true no-op.
    if (target.lastSnapshotHash === args.snapshotHash) {
      return { availabilityEventId: null, deduped: true };
    }

    const eventId = await ctx.db.insert("availability_events", {
      monitorTargetId: args.monitorTargetId,
      source: args.source,
      detectedAt: args.detectedAt,
      theatresJson: JSON.stringify(args.normalized),
      // Allowlist the deep-link before persisting — only official https BMS/District
      // URLs survive; anything unsafe collapses to "" (defense-in-depth, A03/A10).
      bookingUrl: officialBookingUrl(args.bookingUrl),
      snapshotHash: args.snapshotHash,
    });

    await upsertSourceSnapshot(ctx, {
      monitorTargetId: args.monitorTargetId,
      source: args.source,
      snapshotHash: args.snapshotHash,
      fetchedAt: args.detectedAt,
    });

    await appendWatcherAuditLog(ctx, {
      actorId: "system",
      action: "availability_detected",
      entityType: "availability_event",
      entityId: eventId,
      createdAt: args.detectedAt,
    });

    // Advance to live on the first open (stop-on-detect).
    if (target.status !== "live") {
      await ctx.db.patch(args.monitorTargetId, {
        status: "live",
        lastSnapshotHash: args.snapshotHash,
        failCount: 0,
        lastCheckedAt: args.detectedAt,
      });
      await appendWatcherAuditLog(ctx, {
        actorId: "system",
        action: "monitor_target_live",
        entityType: "monitor_target",
        entityId: target.collapseKey,
        fromState: target.status,
        toState: "live",
        createdAt: args.detectedAt,
      });
    } else {
      await ctx.db.patch(args.monitorTargetId, {
        lastSnapshotHash: args.snapshotHash,
        lastCheckedAt: args.detectedAt,
      });
    }

    return { availabilityEventId: eventId, deduped: false };
  },
});

// ===========================================================================
// INTERNAL mutation: enqueueNotifications (Task 6)
// ===========================================================================

/**
 * Shared enqueue core (used by enqueueNotifications + the createAlert late-subscriber
 * path). For a live availability_event, fan out one pending notification_queue row
 * per subscriber × channel × DELIVERED alertType, idempotent on dedupeKey. Returns
 * how many NEW rows were inserted.
 */
async function enqueueForEvent(
  ctx: MutationCtx,
  availabilityEventId: Id<"availability_events"> | string,
  nowIso: string,
): Promise<number> {
  const event = await ctx.db.get(availabilityEventId as Id<"availability_events">);
  if (!event) return 0;
  const monitorTargetId = event.monitorTargetId;

  const subscribers = await ctx.db
    .query("wants")
    .withIndex("by_monitor_target", (q) => q.eq("monitorTargetId", monitorTargetId))
    .collect();

  let inserted = 0;
  for (const want of subscribers) {
    const alertTypes = deliveredAlertTypesFor(want);
    const channels = channelsFor(want);
    for (const alertType of alertTypes) {
      for (const channel of channels) {
        const key = dedupeKey({
          userId: want.buyerId,
          monitorTargetId,
          availabilityEventId,
          alertType,
          channel,
        });
        const existing = await ctx.db
          .query("notification_queue")
          .withIndex("by_dedupe", (q) => q.eq("dedupeKey", key))
          .unique();
        if (existing) continue;
        await ctx.db.insert("notification_queue", {
          userId: want.buyerId,
          monitorTargetId,
          availabilityEventId,
          alertType,
          channel,
          status: "pending",
          dedupeKey: key,
          createdAt: nowIso,
        });
        await appendWatcherAuditLog(ctx, {
          actorId: "system",
          action: "notification_enqueued",
          entityType: "notification",
          entityId: key,
          toState: "pending",
          createdAt: nowIso,
        });
        inserted += 1;
      }
    }
  }
  return inserted;
}

export const enqueueNotifications = internalMutation({
  args: {
    availabilityEventId: v.id("availability_events"),
    nowIso: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const nowIso = args.nowIso ?? new Date().toISOString();
    const inserted = await enqueueForEvent(ctx, args.availabilityEventId, nowIso);
    return { inserted };
  },
});

// ===========================================================================
// INTERNAL mutation: bumpFailCounter + degrade/close lifecycle (Task 7)
// ===========================================================================

/**
 * Increment a target's consecutive SOURCE-FAILURE counter (fetch threw / was
 * blocked / the page shape no longer parses). After K in a row → watching →
 * degraded (suppress; keep the deep-link CTA). A live target is never degraded.
 *
 * IMPORTANT (design intent): this is for source breakage, NOT "booking hasn't
 * opened yet". Alerts are set days before a show opens — a clean fetch that
 * simply has no shows yet must NOT count toward degrade (it would self-degrade
 * every real alert before it ever fires). That clean-not-open path calls
 * `rescheduleTarget` instead, which resets failCount and keeps watching.
 */
export const bumpFailCounter = internalMutation({
  args: {
    monitorTargetId: v.id("monitor_targets"),
    now: v.optional(v.string()),
    nextCheckAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.monitorTargetId);
    if (!target) throw new Error("MONITOR_TARGET_NOT_FOUND");
    const nowIso = args.now ?? new Date().toISOString();
    if (target.status !== "watching") {
      return { status: target.status, failCount: target.failCount ?? 0 };
    }

    const failCount = (target.failCount ?? 0) + 1;
    const nextCheckAt = args.nextCheckAt ?? nextCheckAfter(Date.now());

    if (failCount >= DEGRADE_AFTER) {
      await ctx.db.patch(args.monitorTargetId, {
        status: "degraded",
        failCount,
        lastCheckedAt: nowIso,
        nextCheckAt,
      });
      await appendWatcherAuditLog(ctx, {
        actorId: "system",
        action: "monitor_target_degraded",
        entityType: "monitor_target",
        entityId: target.collapseKey,
        fromState: "watching",
        toState: "degraded",
        createdAt: nowIso,
      });
      return { status: "degraded" as const, failCount };
    }

    await ctx.db.patch(args.monitorTargetId, {
      failCount,
      lastCheckedAt: nowIso,
      nextCheckAt,
    });
    return { status: "watching" as const, failCount };
  },
});

/**
 * A clean poll that found booking simply NOT OPEN yet (fetch succeeded, parsed
 * fine, zero shows). This is the normal pre-open state for an alert set days
 * ahead, so it must NOT degrade the target: reset the source-failure counter and
 * just advance nextCheckAt so the cron re-checks next cadence. Keeps `watching`.
 */
export const rescheduleTarget = internalMutation({
  args: {
    monitorTargetId: v.id("monitor_targets"),
    now: v.optional(v.string()),
    nextCheckAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.monitorTargetId);
    if (!target) throw new Error("MONITOR_TARGET_NOT_FOUND");
    if (target.status !== "watching") {
      return { status: target.status };
    }
    const nowIso = args.now ?? new Date().toISOString();
    await ctx.db.patch(args.monitorTargetId, {
      failCount: 0,
      lastCheckedAt: nowIso,
      nextCheckAt: args.nextCheckAt ?? nextCheckAfter(Date.now()),
    });
    return { status: "watching" as const };
  },
});

/**
 * Remove a subscriber (expired/cancelled want) from a target: clears the link and
 * decrements subscriberCount. When the count reaches 0 the target → closed
 * (design §Edge: out-of-window / expired alert). Live targets still close when
 * empty (no one left to notify).
 */
export const removeSubscriber = internalMutation({
  args: { wantKey: v.string(), now: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const nowIso = args.now ?? new Date().toISOString();
    const want = await ctx.db
      .query("wants")
      .withIndex("by_key", (q) => q.eq("wantKey", args.wantKey))
      .unique();
    if (!want || !want.monitorTargetId) return { closed: false };

    const targetId = want.monitorTargetId as Id<"monitor_targets">;
    const target = await ctx.db.get(targetId);
    await ctx.db.patch(want._id, { monitorTargetId: undefined });
    if (!target) return { closed: false };

    const subscriberCount = Math.max(0, target.subscriberCount - 1);
    if (subscriberCount === 0 && target.status !== "closed") {
      await ctx.db.patch(target._id, { subscriberCount, status: "closed", lastCheckedAt: nowIso });
      await appendWatcherAuditLog(ctx, {
        actorId: "system",
        action: "monitor_target_closed",
        entityType: "monitor_target",
        entityId: target.collapseKey,
        fromState: target.status,
        toState: "closed",
        createdAt: nowIso,
      });
      return { closed: true };
    }
    await ctx.db.patch(target._id, { subscriberCount });
    return { closed: false };
  },
});

// ===========================================================================
// INTERNAL query: dueTargets (Task 9)
// ===========================================================================

/**
 * Targets due for a poll: status `watching`, nextCheckAt <= now, and in-window
 * (windowEnd absent or in the future). Real-user-triggered only — a target exists
 * only because someone set an alert (design §Constraints: no blanket cron).
 */
export const dueTargets = internalQuery({
  args: { now: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const nowIso = args.now ?? new Date().toISOString();
    const limit = args.limit ?? 50;
    const candidates = await ctx.db
      .query("monitor_targets")
      .withIndex("by_status_next_check", (q) =>
        q.eq("status", "watching").lte("nextCheckAt", nowIso),
      )
      .take(limit);
    // In-window on BOTH sides: not past windowEnd, and not before windowStart.
    return candidates.filter(
      (t) =>
        (!t.windowEnd || t.windowEnd >= nowIso) &&
        (!t.windowStart || t.windowStart <= nowIso),
    );
  },
});

// ===========================================================================
// INTERNAL action: pollDueTargets (the loop, Task 9)
// ===========================================================================

/** Parse one Parallel result row per its source into NormalizedShow[]. */
function parseResultForSource(source: "bms" | "district", content: string): NormalizedShow[] {
  if (source === "district") return parseDistrictMovieCity(content);
  // BMS: content is raw JSON. Tolerate parse failure (untrusted bytes, A03).
  let json: unknown = {};
  try {
    json = JSON.parse(content);
  } catch {
    return [];
  }
  // byvenue + byevent share the ShowDetails model, so a single walker reads both
  // shapes; the byVenue/byEvent ternary fallback was dead (both delegate to the
  // same parseBmsShowDetails walker and can never differ).
  return parseBmsByVenue(json);
}

/**
 * Match Parallel results back to the source they were requested for (results are
 * keyed by URL), parse each, and union+dedupe into one normalized open/closed view.
 */
function buildUnionFromResults(
  sourceUrls: SourceUrl[],
  results: ParallelResult[],
  venueMap: VenueMap,
): UnionResult {
  const byUrl = new Map(results.map((r) => [r.url, r]));
  let bms: NormalizedShow[] = [];
  let district: NormalizedShow[] = [];
  let bookingUrl: string | undefined;

  for (const { source, url } of sourceUrls) {
    const result = byUrl.get(url);
    const content = result?.content ?? "";
    const shows = parseResultForSource(source, content);
    // Tag each show with the official deep-link OUT for its source.
    const withUrl = shows.map((s) => ({ ...s, bookingUrl: s.bookingUrl ?? url }));
    if (source === "bms") bms = withUrl;
    else district = withUrl;
    if (!bookingUrl && shows.length > 0) bookingUrl = url;
  }

  const union = unionAndDedupe(bms, district, venueMap);
  return { ...union, ...(union.bookingUrl ? {} : bookingUrl ? { bookingUrl } : {}) };
}

export const pollDueTargets = internalAction({
  args: { now: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<{ polled: number; detected: number; failed: number }> => {
    const nowIso = args.now ?? new Date().toISOString();
    const nowMs = Date.parse(nowIso) || Date.now();
    const targets = await ctx.runQuery(internal.watcher.dueTargets, { now: nowIso });

    let detected = 0;
    let failed = 0;

    for (const target of targets) {
      const catalogItem = await ctx.runQuery(internal.watcher.catalogItemForTarget, {
        catalogItemId: target.catalogItemId,
      });
      if (!catalogItem) {
        await ctx.runMutation(internal.watcher.bumpFailCounter, {
          monitorTargetId: target._id,
          now: nowIso,
        });
        failed += 1;
        continue;
      }

      // Platform routing: build only the URLs whose codes exist.
      const sourceUrls: SourceUrl[] = [];
      const bms = buildBmsUrl(catalogItem, target.date);
      if (bms) sourceUrls.push({ source: "bms", url: bms });
      const district = buildDistrictUrl(catalogItem, target.date);
      if (district) sourceUrls.push({ source: "district", url: district });

      let results: ParallelResult[] = [];
      // Distinguish a SOURCE FAILURE (threw / blocked) from a CLEAN not-open-yet
      // fetch: only the former degrades. Alerts are set days before booking opens,
      // so a clean "no shows yet" must keep watching, not self-degrade (advisor).
      let fetchFailed = false;
      try {
        const { results: r } = await activeFetcher(sourceUrls.map((s) => s.url));
        results = r;
      } catch {
        fetchFailed = true; // network error / block / Parallel down
        results = [];
      }
      // Even without a throw, a requested URL that returns no usable result row
      // (missing entry, or content undefined) is a block/shape-failure, not a
      // clean empty page. A returned `content: ""` IS a clean fetch (page renders
      // "no shows yet"), so it does not count as a failure.
      if (!fetchFailed && sourceUrls.length > 0) {
        const byUrl = new Map(results.map((r) => [r.url, r]));
        const everyUrlBlocked = sourceUrls.every((s) => {
          const row = byUrl.get(s.url);
          return !row || typeof row.content !== "string";
        });
        if (everyUrlBlocked) fetchFailed = true;
      }

      const union = buildUnionFromResults(sourceUrls, results, {});

      if (union.isOpen) {
        // Record on the first source that has the booking URL (union picks it).
        const primarySource = sourceUrls.find((s) => s.url === union.bookingUrl)?.source
          ?? sourceUrls[0]?.source
          ?? "bms";
        const hash = snapshotHash(union.shows);
        const record = await ctx.runMutation(internal.watcher.recordAvailability, {
          monitorTargetId: target._id,
          source: primarySource,
          normalized: union.shows,
          bookingUrl: union.bookingUrl ?? sourceUrls[0]?.url ?? "",
          detectedAt: nowIso,
          snapshotHash: hash,
        });
        if (record.availabilityEventId) {
          await ctx.runMutation(internal.watcher.enqueueNotifications, {
            availabilityEventId: record.availabilityEventId,
            nowIso,
          });
        }
        detected += 1;
      } else if (fetchFailed) {
        // Source breakage → count toward degrade (K in a row → degraded).
        await ctx.runMutation(internal.watcher.bumpFailCounter, {
          monitorTargetId: target._id,
          now: nowIso,
          nextCheckAt: nextCheckAfter(nowMs),
        });
        failed += 1;
      } else {
        // Clean fetch, booking not open yet → reschedule, reset fail counter.
        await ctx.runMutation(internal.watcher.rescheduleTarget, {
          monitorTargetId: target._id,
          now: nowIso,
          nextCheckAt: nextCheckAfter(nowMs),
        });
      }
    }

    return { polled: targets.length, detected, failed };
  },
});

/** Internal helper query so the action can read a catalog row (actions lack ctx.db). */
export const catalogItemForTarget = internalQuery({
  args: { catalogItemId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("catalog_items")
      .withIndex("by_key", (q) => q.eq("catalogKey", args.catalogItemId))
      .unique();
  },
});

// ===========================================================================
// INTERNAL action: dispatchNotifications (Task 11 dispatch)
// ===========================================================================

/** Drain a batch of pending notifications (internal query feeding the dispatch action). */
export const pendingNotifications = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notification_queue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(args.limit ?? 100);
  },
});

/** Mark a notification row sent or failed (internal mutation, audited). */
export const markNotification = internalMutation({
  args: {
    notificationId: v.id("notification_queue"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    now: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const nowIso = args.now ?? new Date().toISOString();
    const row = await ctx.db.get(args.notificationId);
    if (!row) return;
    await ctx.db.patch(args.notificationId, {
      status: args.status,
      ...(args.status === "sent" ? { sentAt: nowIso } : {}),
    });
    await appendWatcherAuditLog(ctx, {
      actorId: "system",
      action: args.status === "sent" ? "notification_sent" : "notification_failed",
      entityType: "notification",
      entityId: row.dedupeKey,
      fromState: "pending",
      toState: args.status,
      createdAt: nowIso,
    });
  },
});

/** Resolve the deep-link OUT message parts for a pending notification (action read). */
export const notificationMessageParts = internalQuery({
  args: { notificationId: v.id("notification_queue") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.notificationId);
    if (!row) return null;
    // Use the notification's OWN event (it was enqueued for a specific
    // availability_event), not the latest event on the target — otherwise a later
    // detection would rewrite this notification's deep-link / theatre / time.
    const event = await ctx.db.get(row.availabilityEventId as Id<"availability_events">);
    const target = await ctx.db.get(row.monitorTargetId as Id<"monitor_targets">);
    const catalogItem = target
      ? await ctx.db
          .query("catalog_items")
          .withIndex("by_key", (q) => q.eq("catalogKey", target.catalogItemId))
          .unique()
      : null;
    const shows: NormalizedShow[] = event ? JSON.parse(event.theatresJson) : [];
    const first = shows[0];
    return {
      channel: row.channel,
      movie: catalogItem?.title ?? "Your movie",
      theatre: first?.theatreName ?? "a theatre near you",
      time: first?.showTime ?? "today",
      url: event?.bookingUrl ?? "",
    };
  },
});

export const dispatchNotifications = internalAction({
  args: { now: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (
    ctx,
    args,
  ): Promise<{ dispatched: number; sent: number; failed: number }> => {
    const nowIso = args.now ?? new Date().toISOString();
    const pending = await ctx.runQuery(internal.watcher.pendingNotifications, {
      limit: args.limit,
    });

    let sent = 0;
    let failed = 0;
    for (const row of pending) {
      const parts = await ctx.runQuery(internal.watcher.notificationMessageParts, {
        notificationId: row._id,
      });
      if (!parts) continue;
      const message = buildLiveMessage({
        movie: parts.movie,
        theatre: parts.theatre,
        time: parts.time,
        url: parts.url,
      });
      const sender = parts.channel === "email" ? activeSenders.email : activeSenders.webpush;
      try {
        await sender(message);
        await ctx.runMutation(internal.watcher.markNotification, {
          notificationId: row._id,
          status: "sent",
          now: nowIso,
        });
        sent += 1;
      } catch {
        await ctx.runMutation(internal.watcher.markNotification, {
          notificationId: row._id,
          status: "failed",
          now: nowIso,
        });
        failed += 1;
      }
    }
    return { dispatched: pending.length, sent, failed };
  },
});

// ===========================================================================
// CLIENT query: getAlertPayoff (Task — payoff)
// ===========================================================================

/**
 * The "Tickets are live" payoff for the caller's own alert (A01 — only the
 * authenticated user's alert). Returns live state + theatres + the deep-link OUT
 * bookingUrl when the target is live, else a waiting state.
 */
export const getAlertPayoff = query({
  args: { wantKey: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedAppUser(ctx);

    const want = await ctx.db
      .query("wants")
      .withIndex("by_key", (q) => q.eq("wantKey", args.wantKey))
      .unique();
    // A01: never reveal another user's alert.
    if (!want || want.buyerId !== user.appUserId) return null;
    if (!want.monitorTargetId) return { status: "watching" as const, isLive: false };

    const target = await ctx.db.get(want.monitorTargetId as Id<"monitor_targets">);

    const catalogItem = await ctx.db
      .query("catalog_items")
      .withIndex("by_key", (q) => q.eq("catalogKey", want.catalogItemId))
      .unique();

    if (!target || target.status !== "live") {
      return {
        status: (target?.status ?? "watching") as "watching" | "closed" | "degraded",
        isLive: false,
        title: catalogItem?.title ?? null,
      };
    }

    const event = await ctx.db
      .query("availability_events")
      .withIndex("by_target", (q) => q.eq("monitorTargetId", target._id))
      .order("desc")
      .first();
    const shows: NormalizedShow[] = event ? JSON.parse(event.theatresJson) : [];
    const theatres = [...new Set(shows.map((s) => s.theatreName))];

    return {
      status: "live" as const,
      isLive: true,
      title: catalogItem?.title ?? null,
      theatres,
      showtimes: shows.map((s) => ({
        theatre: s.theatreName,
        time: s.showTime,
        format: s.format,
      })),
      bookingUrl: event?.bookingUrl ?? null,
    };
  },
});
