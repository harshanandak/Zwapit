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
import type { Doc, Id } from "./_generated/dataModel";
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
  wantByKey,
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
  buildAlertWantKey,
  collapseKeyForWant,
  computeCollapseKey,
  eventShowMatchesTargetDate,
  extractSaleOpensAt,
  isPastAlertDate,
  looksLikeEventPage,
  parseBmsByVenue,
  parseBmsEventPage,
  parseDistrictEventPage,
  parseDistrictMovieCity,
  officialBookingUrl,
  snapshotHash,
  unionAndDedupe,
  type UnionResult,
  type VenueMap,
} from "./watcher/parse";
import {
  nextCheckWithBackoff,
  nextCheckWithSaleWindow,
  saleWindowApplies,
} from "./watcher/schedule";
import {
  buildLiveMessage,
  defaultSenders,
  type Senders,
} from "./watcher/senders";
import type { NormalizedShow, ShowSource } from "./watcher/types";

// Degrade threshold: K consecutive empty/blocked polls → "degraded" (design §Edge).
const DEGRADE_AFTER = 3;
// Max delivery attempts before a notification is parked as permanently "failed".
const MAX_NOTIFICATION_ATTEMPTS = 3;
// How long a "sending" claim is honored before a later dispatch wave may reclaim
// it. Sized well above a dispatch wave's runtime: if a wave dies mid-send, the
// next wave reclaims the row rather than dropping it. Comfortably under the poll
// cadence so reclaim is timely.
const NOTIFICATION_CLAIM_LEASE_MS = 10 * 60_000;
// Curated (admin-driven) targets are never polled. nextCheckAt is set on every
// target insert, so curated targets get a far-future sentinel that the dueTargets
// index range (nextCheckAt <= now) can NEVER select — keeping them out of the poll
// budget entirely, not merely filtered out after `.take()` (which would let them
// crowd real targets out of a wave). `sources.length > 0` in dueTargets stays as
// defense-in-depth.
const NEVER_POLL_AT = "9999-12-31T23:59:59.999Z";
// Want category mirrors the catalog kind. A lookup map (not a nested ternary, S3358).
const KIND_TO_CATEGORY = {
  movie: "movie_ticket",
  live_event: "event_ticket",
  bus_route: "bus_travel",
} as const;
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
const sourceV = v.union(v.literal("bms"), v.literal("district"), v.literal("curated"));

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

/**
 * Audit a notification status transition. All are system-driven and entityType
 * "notification", keyed by the row's dedupeKey; fromState is omitted for the
 * initial enqueue (no prior state).
 */
async function auditNotification(
  ctx: MutationCtx,
  dedupeKey: string,
  action: string,
  toState: string,
  nowIso: string,
  fromState?: string,
): Promise<void> {
  await appendWatcherAuditLog(ctx, {
    actorId: "system",
    action,
    entityType: "notification",
    entityId: dedupeKey,
    ...(fromState ? { fromState } : {}),
    toState,
    createdAt: nowIso,
  });
}

// ===========================================================================
// CLIENT mutation: createAlert (Task 4)
// ===========================================================================

/** Validate + normalize createAlert's client input (trim; reject empty city /
 * malformed date) so semantically-identical alerts collapse and malformed ones are
 * never persisted. Extracted to keep createAlert's cognitive complexity down. */
function normalizeAlertInput(
  args: {
    city: string;
    date: string;
    format?: string;
  },
  nowIso?: string,
): { city: string; date: string; format?: string } {
  const city = args.city.trim();
  const date = args.date.trim();
  const format = args.format?.trim() || undefined;
  if (!city) throw new Error("ALERT_CITY_REQUIRED");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new Error("ALERT_DATE_INVALID");
  }
  if (isPastAlertDate(date, nowIso)) {
    throw new Error("WATCH_DATE_IN_PAST");
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

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    // Validate + normalize client input before it flows into the collapse key,
    // monitor_targets, wants.expiresAt and source URLs (coding guideline: validate
    // all user input). See normalizeAlertInput. Clock passed in so the past-date
    // check is deterministic under test.
    const { city, date, format } = normalizeAlertInput(args, nowIso);
    const collapseKey = computeCollapseKey({
      catalogItemId: args.catalogItemId,
      city,
      date,
      format,
    });

    // Platform routing: a target only watches sources whose codes the catalog row
    // actually has (design §Edge: one source has the show). A row is CURATED only
    // when it is a curated-capable kind (live_event) with NO pollable source —
    // availability is then admin-driven, so the target carries sources: [] and is
    // never polled (dueTargets skips empty-source targets). A live_event WITH codes
    // is a pollable target like a movie (its BMS/District detail pages are routed
    // by the event adapters) and must NOT get the never-poll sentinel, or the
    // adapters could never fire (CodeRabbit P1).
    const sources: Array<"bms" | "district"> = [];
    if (buildBmsUrl(catalogItem, date) !== null) sources.push("bms");
    if (buildDistrictUrl(catalogItem, date) !== null) sources.push("district");
    const isCurated = catalogItem.kind === "live_event" && sources.length === 0;
    // A pollable kind with no source is inert (pollDueTargets fetches nothing and
    // reschedules forever); reject it. Curated rows are allowed with no source.
    if (!isCurated && sources.length === 0) throw new Error("NO_WATCHABLE_SOURCE");

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
        // Curated targets are never polled → far-future sentinel keeps them out of
        // the dueTargets index range (not just the post-take filter).
        nextCheckAt: isCurated ? NEVER_POLL_AT : nowIso,
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
    // Want category mirrors the catalog kind (movie → movie_ticket, live_event →
    // event_ticket, bus_route → bus_travel) instead of a hardcoded movie value.
    const category = KIND_TO_CATEGORY[catalogItem.kind];

    // ---- find-or-create THIS buyer's want for the target (dedupe per buyer) ----
    // The v2 key losslessly encodes the exact buyer/occurrence tuple. Old keys
    // remain valid and are recovered by exact occurrence below.
    const wantCandidateKey = buildAlertWantKey(buyerId, collapseKey);
    const subscribers = await subscribersForTarget(ctx, targetId);
    const byKeyRows = await ctx.db
      .query("wants")
      .withIndex("by_key", (q) => q.eq("wantKey", wantCandidateKey))
      .collect();
    let existingForBuyer: Doc<"wants"> | undefined =
      subscribers.find((w) => w.buyerId === buyerId) ??
      byKeyRows.find(
        (w) => w.buyerId === buyerId && collapseKeyForWant(w) === collapseKey,
      );
    if (!existingForBuyer) {
      const buyerWants = await ctx.db
        .query("wants")
        .withIndex("by_buyer", (q) => q.eq("buyerId", buyerId))
        .order("asc")
        .collect();
      existingForBuyer = buyerWants.find((want) => collapseKeyForWant(want) === collapseKey);
    }

    let wantKey: string;
    let newlyAttached = false;
    let reattachedWantId: Id<"wants"> | undefined;
    let effectiveTargetStatus = target.status;
    if (existingForBuyer) {
      const wasAttachedToThisTarget = existingForBuyer.monitorTargetId === targetId;
      await ctx.db.patch(existingForBuyer._id, {
        state: "open",
        watchCity: city,
        watchDate: date,
        ...(format ? { watchFormat: format } : {}),
        alertTypes: [...alertTypes],
        channels: [...channels],
        monitorTargetId: targetId,
        collapseKey,
        expiresAt: date,
      });
      wantKey = existingForBuyer.wantKey;
      // Want-effect audit (AGENTS rule 4): re-arm mutates want fields.
      await appendWatcherAuditLog(ctx, {
        actorId: buyerId,
        actorRole: "buyer",
        action: "want_rearmed",
        entityType: "want",
        entityId: wantKey,
        createdAt: nowIso,
      });
      if (!wasAttachedToThisTarget) {
        // Reattached after expiry/detachment: the count must come back, and a
        // target that CLOSED must reopen — dueTargets only polls watching.
        // A closed target that had already gone LIVE keeps its snapshot hash:
        // reopening it as watching would let the next identical poll dedupe
        // before restoring live, stranding the buyer (Codex P1 cahmH) — so
        // restore live directly and let the late-subscriber enqueue deliver
        // the known payoff.
        newlyAttached = true;
        reattachedWantId = existingForBuyer._id;
        const reopen = target.status === "closed";
        const reopenToLive = reopen && Boolean(target.lastSnapshotHash);
        effectiveTargetStatus = reopenToLive ? "live" : reopen ? "watching" : target.status;
        await ctx.db.patch(target._id, {
          subscriberCount: target.subscriberCount + 1,
          ...(reopen
            ? {
                status: reopenToLive ? ("live" as const) : ("watching" as const),
                nextCheckAt: nowIso,
                failCount: 0,
              }
            : {}),
        });
        await appendWatcherAuditLog(ctx, {
          actorId: buyerId,
          actorRole: "buyer",
          action: "monitor_target_subscriber_count_changed",
          entityType: "monitor_target",
          entityId: collapseKey,
          fromState: String(target.subscriberCount),
          toState: String(target.subscriberCount + 1),
          createdAt: nowIso,
        });
        if (reopen) {
          await appendWatcherAuditLog(ctx, {
            actorId: buyerId,
            actorRole: "buyer",
            action: "monitor_target_reopened",
            entityType: "monitor_target",
            entityId: collapseKey,
            fromState: "closed",
            toState: reopenToLive ? "live" : "watching",
            createdAt: nowIso,
          });
        }
      }
    } else {
      newlyAttached = true;
      wantKey = wantCandidateKey;
      await ctx.db.insert("wants", {
        wantKey,
        buyerId,
        catalogItemId: args.catalogItemId,
        category,
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
        collapseKey,
      });
      // Want-effect audit: subscription created (gh#41 — previously unaudited).
      await appendWatcherAuditLog(ctx, {
        actorId: buyerId,
        actorRole: "buyer",
        action: "want_created",
        entityType: "want",
        entityId: wantKey,
        toState: "open",
        createdAt: nowIso,
      });
      await ctx.db.patch(target._id, { subscriberCount: target.subscriberCount + 1 });
      // Monitor-effect audit: subscriber count is a monitored field.
      await appendWatcherAuditLog(ctx, {
        actorId: buyerId,
        actorRole: "buyer",
        action: "monitor_target_subscriber_count_changed",
        entityType: "monitor_target",
        entityId: collapseKey,
        fromState: String(target.subscriberCount),
        toState: String(target.subscriberCount + 1),
        createdAt: nowIso,
      });
    }

    // Late subscriber on an already-live target → notify immediately from last event.
    if (newlyAttached && effectiveTargetStatus === "live") {
      const lastEvent = await latestAvailabilityEvent(ctx, targetId);
      if (lastEvent) {
        await enqueueForEvent(ctx, lastEvent._id, nowIso, { reattachedWantId });
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
/**
 * Core of recordAvailability, shared with the curated markEventAvailable path:
 * snapshot-hash dedup → write the availability_event (allowlisted deep-link OUT)
 * → audit → advance the target to live (stop-on-detect). Does NOT touch the
 * per-(target, source) snapshot cache — that is a polling-only concern, so
 * recordAvailability adds it and the curated path skips it.
 */
async function recordAvailabilityCore(
  ctx: MutationCtx,
  args: {
    monitorTargetId: Id<"monitor_targets">;
    source: NormalizedShow["source"];
    normalized: NormalizedShow[];
    bookingUrl: string;
    detectedAt: string;
    snapshotHash: string;
  },
): Promise<{ availabilityEventId: Id<"availability_events"> | null; deduped: boolean }> {
  const target = await ctx.db.get(args.monitorTargetId);
  if (!target) throw new Error("MONITOR_TARGET_NOT_FOUND");

  // Dedup against the TARGET UNION hash (target.lastSnapshotHash), NOT the
  // per-(target, source) cache. pollDueTargets hashes the whole cross-source
  // union and records under whichever source won the booking URL, so the primary
  // source can flip (bms→district) on an UNCHANGED union. Gating on the per-source
  // cache would miss that flip and re-fire; gating on the union hash is
  // independent of which source won, so an unchanged union is a true no-op.
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
}

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
    const result = await recordAvailabilityCore(ctx, args);
    if (!result.deduped && args.source !== "curated") {
      // Polling-only: cache the per-(target, source) snapshot so an unchanged
      // poll is a no-op. The curated path has no source cache to maintain.
      await upsertSourceSnapshot(ctx, {
        monitorTargetId: args.monitorTargetId,
        source: args.source,
        snapshotHash: args.snapshotHash,
        fetchedAt: args.detectedAt,
      });
    }
    return result;
  },
});

// Admin/curated availability input: an event has a venue + time (+ optional
// section/tier as `format`); no per-show source (it is all "curated").
const eventShowV = v.object({
  theatreName: v.string(),
  showTime: v.string(),
  format: v.optional(v.string()),
});

/**
 * Curated/admin availability for a live event — the manual analog of
 * pollDueTargets→recordAvailability for catalog kinds with no pollable source.
 * Records the official deep-link OUT + advances the target to live (reusing
 * recordAvailabilityCore: snapshot dedup, audit, stop-on-detect), then fans out
 * notifications via enqueueForEvent. Internal-only; never client-callable. Zero
 * external egress.
 */
export const markEventAvailable = internalMutation({
  args: {
    monitorTargetId: v.id("monitor_targets"),
    shows: v.array(eventShowV),
    bookingUrl: v.string(),
    detectedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.monitorTargetId);
    if (!target) throw new Error("MONITOR_TARGET_NOT_FOUND");
    // Only curated (non-pollable) targets may be marked available by this admin
    // path — never flip a pollable bms/district target to a "curated" event.
    if (target.sources.length !== 0) throw new Error("CURATED_TARGET_REQUIRED");
    // Require real show data — no empty list, no blank venue/time.
    if (
      args.shows.length === 0 ||
      args.shows.some((s) => s.theatreName.trim() === "" || s.showTime.trim() === "")
    ) {
      throw new Error("INVALID_CURATED_SHOWS");
    }
    // Deep-link OUT only: the booking URL MUST be an official link. Reject rather
    // than advance to live with a sanitised-empty link (the whole payoff is the
    // deep-link OUT). A target with a not-yet-official URL stays watching.
    const bookingUrl = officialBookingUrl(args.bookingUrl);
    if (!bookingUrl) throw new Error("INVALID_BOOKING_URL");

    const nowIso = args.detectedAt ?? new Date().toISOString();
    const normalized: NormalizedShow[] = args.shows.map((s) => ({
      source: "curated" as const,
      theatreName: s.theatreName,
      showTime: s.showTime,
      format: s.format ?? "",
    }));
    const result = await recordAvailabilityCore(ctx, {
      monitorTargetId: args.monitorTargetId,
      source: "curated",
      normalized,
      bookingUrl,
      detectedAt: nowIso,
      snapshotHash: snapshotHash(normalized),
    });
    if (result.availabilityEventId) {
      await enqueueForEvent(ctx, result.availabilityEventId, nowIso);
    }
    return result;
  },
});

// ===========================================================================
// INTERNAL mutation: enqueueNotifications (Task 6)
// ===========================================================================

/**
 * Shared enqueue core (used by enqueueNotifications + the createAlert late-subscriber
 * path). For a live availability_event, fan out one pending notification_queue row
 * per subscriber × channel × DELIVERED alertType, idempotent on dedupeKey. An
 * explicit reattachment may requeue terminal rows for that want only. Returns how
 * many NEW rows were inserted (requeues are not counted).
 */
async function enqueueForEvent(
  ctx: MutationCtx,
  availabilityEventId: Id<"availability_events"> | string,
  nowIso: string,
  options?: { reattachedWantId?: Id<"wants"> },
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
        if (existing) {
          const canRequeue = options?.reattachedWantId === want._id;
          if (canRequeue && (existing.status === "sent" || existing.status === "failed")) {
            await ctx.db.patch(existing._id, {
              status: "pending",
              attempts: 0,
              sentAt: undefined,
              claimedAt: undefined,
            });
            await appendWatcherAuditLog(ctx, {
              actorId: want.buyerId,
              actorRole: "buyer",
              action: "notification_requeued",
              entityType: "notification",
              entityId: key,
              fromState: existing.status,
              toState: "pending",
              createdAt: nowIso,
            });
          }
          continue;
        }
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
        await auditNotification(ctx, key, "notification_enqueued", "pending", nowIso);
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
    // Parsed District sale-open instant to persist for future reschedules
    // (kernel 9b317bb9). Absent → leave any stored value untouched.
    saleOpensAt: v.optional(v.string()),
    // True when nextCheckAt was computed FROM a sale window (fresh or stored) —
    // drives the deduped audit trail for window-driven scheduling effects.
    saleWindowDriven: v.optional(v.boolean()),
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
      ...(args.saleOpensAt ? { saleOpensAt: args.saleOpensAt } : {}),
    });
    // Sale-window knowledge acquisition is audited once per distinct instant
    // (the _set row); the recurring scheduling effect gets its own row, deduped
    // to once per 6h per target so the post-open 5-min chase can't flood
    // audit_logs while still leaving a trail (Codex P1 on #46).
    if (args.saleOpensAt && args.saleOpensAt !== target.saleOpensAt) {
      await appendWatcherAuditLog(ctx, {
        actorId: "system",
        action: "monitor_target_sale_window_set",
        entityType: "monitor_target",
        entityId: target.collapseKey,
        createdAt: nowIso,
      });
    } else if (args.saleWindowDriven === true && args.nextCheckAt !== target.nextCheckAt) {
      // Dedupe against the latest SCHEDULING audit, not the latest row of any
      // action: an interleaved sale_window_set (a changed instant between
      // chase polls) must not reset the once-per-6h bound (CodeRabbit on #46,
      // kernel ff3e0a5a). by_entity_action_time orders scheduling rows by
      // their action clock, so no insertion-ordered page can hide the true
      // latest row behind interleaved actions or replay-stamped rows (Codex
      // P2 + CodeRabbit on #52). Audit createdAt is always toISOString()
      // UTC, whose lexicographic order is chronological.
      const latestScheduled = await ctx.db
        .query("audit_logs")
        .withIndex("by_entity_action_time", (q) =>
          q
            .eq("entityType", "monitor_target")
            .eq("entityId", target.collapseKey)
            .eq("action", "monitor_target_sale_window_scheduled"),
        )
        .order("desc")
        .first();
      const isDuplicate =
        latestScheduled !== null &&
        // Compare against the ACTION clock (args.now), not the host —
        // deterministic replays stamp rows with a past `now` (Codex P2).
        Date.parse(latestScheduled.createdAt) >= Date.parse(nowIso) - 6 * 3_600_000;
      if (!isDuplicate) {
        await appendWatcherAuditLog(ctx, {
          actorId: "system",
          action: "monitor_target_sale_window_scheduled",
          entityType: "monitor_target",
          entityId: target.collapseKey,
          createdAt: nowIso,
        });
      }
    }
    return { status: "watching" as const };
  },
});

/**
 * Detach a want from its monitor target: clear the link and decrement
 * subscriberCount. When the count reaches 0 the target → closed (design §Edge:
 * out-of-window / expired alert) and we audit the transition. Live targets still
 * close when empty (no one left to notify). The CALLER decides the want's own
 * terminal state (cancelled vs expired), so this core never touches want.state.
 * Shared by removeSubscriber (cancel path) and expireWant (expiry path).
 */
async function detachSubscriberCore(
  ctx: MutationCtx,
  want: Doc<"wants">,
  nowIso: string,
): Promise<{ closed: boolean }> {
  if (!want.monitorTargetId) return { closed: false };

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
}

/**
 * Remove a subscriber (cancelled want) from a target: clears the link and
 * decrements subscriberCount, closing the target at 0. Kept as the generic
 * detach entry point (e.g. a future cancel-alert flow); expiry uses expireWant.
 */
export const removeSubscriber = internalMutation({
  args: { wantKey: v.string(), now: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const nowIso = args.now ?? new Date().toISOString();
    const want = await wantByKey(ctx, args.wantKey);
    if (!want) return { closed: false };
    return await detachSubscriberCore(ctx, want, nowIso);
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
    // Curated/admin-driven targets (sources []) have nothing to fetch, so they are
    // never polled — their availability is set by markEventAvailable, not the cron.
    return candidates.filter(
      (t) =>
        t.sources.length > 0 &&
        (!t.windowEnd || t.windowEnd >= nowIso) &&
        (!t.windowStart || t.windowStart <= nowIso),
    );
  },
});

// ===========================================================================
// INTERNAL expiry/close: expireWants (zwapit-46i.1)
// ===========================================================================

/**
 * The instant a watch date is fully past. A want's `expiresAt` on the alert path
 * is the bare watch DATE (YYYY-MM-DD); comparing that string directly against an
 * ISO `now` would lexically expire a same-day show ("2026-06-25" < "2026-06-25T..").
 * So a bare date becomes end-of-day. The UTC end-of-day is intentionally ~5.5h
 * LATER than IST midnight — it errs toward keeping a same-day alert alive so a
 * last-minute open can still fire; do NOT "fix" this into early IST expiry.
 * A value that is already a full timestamp is compared as-is.
 */
function endOfWatchDay(expiresAt: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(expiresAt) ? `${expiresAt}T23:59:59.999Z` : expiresAt;
}

/**
 * Open ALERT wants (monitorTargetId set) whose watch date has fully passed.
 * Scans the expiry-ordered index bounded to past-due rows (expiresAt before
 * today's UTC date — which matches endOfWatchDay's same-day grace), so EVERY
 * expired alert is a candidate regardless of when it was created; the `limit`
 * slice then keeps the soonest-expiring. This avoids the creation-ordered-prefix
 * trap where older future or non-alert wants could permanently hide later-created
 * expired alerts. Non-alert demand wants in the range are filtered out (separate
 * lifecycle).
 */
export const expiredAlertWants = internalQuery({
  args: { now: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const nowIso = args.now ?? new Date().toISOString();
    const limit = args.limit ?? 100;
    // A bare-date alert is expired once its end-of-day is past, i.e. the next
    // calendar day — so bounding at expiresAt < today's UTC date matches
    // endOfWatchDay exactly while only touching past-due rows.
    const todayUtc = nowIso.slice(0, 10);
    const candidates = await ctx.db
      .query("wants")
      .withIndex("by_state_expires", (q) => q.eq("state", "open").lt("expiresAt", todayUtc))
      .collect();
    return candidates
      .filter((w) => Boolean(w.monitorTargetId) && endOfWatchDay(w.expiresAt) < nowIso)
      .slice(0, limit)
      .map((w) => ({ wantKey: w.wantKey }));
  },
});

/**
 * Expire one alert want: mark it `expired` and detach it from its shared target
 * (closing the target when its subscriber count hits 0). Idempotent — a want that
 * is not `open` is a no-op, so re-runs neither double-decrement nor reopen a
 * closed target. Atomic: state + detach commit in one mutation.
 */
export const expireWant = internalMutation({
  args: { wantKey: v.string(), now: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const nowIso = args.now ?? new Date().toISOString();
    const want = await wantByKey(ctx, args.wantKey);
    if (want?.state !== "open") return { expired: false, closed: false };
    const { closed } = await detachSubscriberCore(ctx, want, nowIso);
    await ctx.db.patch(want._id, { state: "expired" });
    return { expired: true, closed };
  },
});

/**
 * Cron entry point: expire every alert want past its watch date and close the
 * targets that empty out — which also STOPS past-date polling, since dueTargets
 * only returns `watching` targets. Thin action over the query + per-want mutation
 * (actions have no ctx.db), matching pollDueTargets/dispatchNotifications.
 */
export const expireWants = internalAction({
  args: { now: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ expired: number; closed: number }> => {
    const nowIso = args.now ?? new Date().toISOString();
    const stale = await ctx.runQuery(internal.watcher.expiredAlertWants, {
      now: nowIso,
      ...(args.limit === undefined ? {} : { limit: args.limit }),
    });
    let expired = 0;
    let closed = 0;
    for (const { wantKey } of stale) {
      const r = await ctx.runMutation(internal.watcher.expireWant, { wantKey, now: nowIso });
      if (r.expired) expired += 1;
      if (r.closed) closed += 1;
    }
    return { expired, closed };
  },
});

// ===========================================================================
// INTERNAL action: pollDueTargets (the loop, Task 9)
// ===========================================================================

/** Parse one Parallel result row per its source into NormalizedShow[]. */
function parseResultForSource(source: ShowSource, content: string): NormalizedShow[] {
  if (source === "curated") return []; // curated availability is admin-set, never polled
  // EVENT detail pages (markdown + sales markers) vs MOVIE payloads (BMS JSON /
  // District `* Theatre` text). District serves two markdown shapes → sniff by
  // event-specific markers (movie pages carry a status legend that would
  // misfire). BMS: JSON-with-ShowDetails is a movie payload; ANY non-JSON body
  // goes to the event parser, whose own markers decide open vs not-open-yet
  // (events-phase2 decisions.md, probe 2026-08-21).
  if (source === "district") {
    return looksLikeEventPage(content)
      ? parseDistrictEventPage(content)
      : parseDistrictMovieCity(content);
  }
  // BMS: movie APIs return raw JSON; event pages are markdown. Tolerate parse
  // failure (untrusted bytes, A03) — non-JSON falls through to the event page.
  let json: unknown = {};
  let parsedJson = false;
  try {
    json = JSON.parse(content);
    parsedJson = true;
  } catch {
    json = {};
  }
  if (!parsedJson || typeof json !== "object" || json === null || !("ShowDetails" in json)) {
    return parseBmsEventPage(content);
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
  // Event detail pages can cover several occurrences of a tour; a page-level
  // booking marker must belong to THIS target's date before it counts
  // (kernel 0ebd2562). Movie shows arrive from date-keyed API URLs and are
  // exempt — only format:"event" rows are filtered.
  matchTargetDate?: string,
): UnionResult {
  const byUrl = new Map(results.map((r) => [r.url, r]));
  let bms: NormalizedShow[] = [];
  let district: NormalizedShow[] = [];
  let bookingUrl: string | undefined;

  const keepForTarget = (shows: NormalizedShow[]): NormalizedShow[] =>
    matchTargetDate
      ? shows.filter(
          (s) => s.format !== "event" || eventShowMatchesTargetDate(s.showTime, matchTargetDate),
        )
      : shows;

  for (const { source, url } of sourceUrls) {
    const result = byUrl.get(url);
    const content = result?.content ?? "";
    const shows = keepForTarget(parseResultForSource(source, content));
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

      const union = buildUnionFromResults(sourceUrls, results, {}, target.date);

      // Sale-window scheduling (kernel 9b317bb9): a District EVENT page's
      // timeline carries the exact sale-open instant — capture it so the
      // clean-reschedule below can wake at the open instead of sleeping
      // through it. Movie pages and BMS pages have no such signal.
      let saleOpensAt: string | undefined;
      if (catalogItem.kind === "live_event") {
        const districtUrl = sourceUrls.find((s) => s.source === "district")?.url;
        const districtRow = districtUrl
          ? results.find((r) => r.url === districtUrl)
          : undefined;
        if (typeof districtRow?.content === "string" && looksLikeEventPage(districtRow.content)) {
          saleOpensAt = extractSaleOpensAt(districtRow.content, nowIso) ?? undefined;
        }
      }

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
        // Clean fetch, booking not open yet — reschedule with distance-based
        // backoff (far-future targets poll slowly; egress constraint), refined
        // to wake at a known sale-open instant when District published one.
        // A fresh parse wins; otherwise reuse the persisted instant so one
        // timeline-less poll doesn't drop back to the 24h tier (Codex P2).
        // Only windows the scheduler will actually honor are persisted or
        // marked window-driven (Codex P2: rejected values stay out of both).
        // Reset fail counter.
        const effectiveSaleOpens = saleOpensAt ?? target.saleOpensAt;
        const applies = saleWindowApplies(effectiveSaleOpens, target.date);
        await ctx.runMutation(internal.watcher.rescheduleTarget, {
          monitorTargetId: target._id,
          now: nowIso,
          nextCheckAt: nextCheckWithSaleWindow(nowMs, applies ? effectiveSaleOpens : undefined, target.date),
          ...(saleOpensAt && applies ? { saleOpensAt } : {}),
          saleWindowDriven: applies,
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

/**
 * Notifications a dispatch wave may claim: every "pending" row, plus "sending"
 * rows whose claim lease has expired (orphaned by a crashed wave). Bounded by
 * `limit`. claimNotification re-checks claimability atomically, so two waves that
 * both surface the same stale row still deliver it at most once.
 */
export const claimableNotifications = internalQuery({
  args: { now: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const nowIso = args.now ?? new Date().toISOString();
    const limit = args.limit ?? 100;
    const pending = await ctx.db
      .query("notification_queue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(limit);
    const sending = await ctx.db
      .query("notification_queue")
      .withIndex("by_status", (q) => q.eq("status", "sending"))
      .take(limit);
    const stale = sending.filter((r) => isClaimExpired(r.claimedAt, nowIso));
    return [...pending, ...stale].slice(0, limit);
  },
});

/** True when a "sending" claim is stale (older than the lease) and may be reclaimed. */
function isClaimExpired(claimedAt: string | undefined, nowIso: string): boolean {
  if (!claimedAt) return true; // missing timestamp ⇒ reclaimable (defensive)
  return Date.parse(claimedAt) + NOTIFICATION_CLAIM_LEASE_MS <= Date.parse(nowIso);
}

/**
 * Atomically claim a notification for delivery. Convex mutations are
 * serializable, so this read-then-write is the atomic gate: a row is claimable if
 * it is "pending", OR it is "sending" but its claim lease has expired — meaning a
 * prior dispatch wave claimed it then died before mark/fail, so reclaiming it
 * keeps the notification from being lost forever. The winner flips it to
 * "sending" and stamps claimedAt; an overlapping wave that loses the race gets
 * { claimed: false }, so a row reaches a sender at most once per active lease.
 */
export const claimNotification = internalMutation({
  args: { notificationId: v.id("notification_queue"), now: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const nowIso = args.now ?? new Date().toISOString();
    const row = await ctx.db.get(args.notificationId);
    if (!row) return { claimed: false };
    const claimable =
      row.status === "pending" ||
      (row.status === "sending" && isClaimExpired(row.claimedAt, nowIso));
    if (!claimable) return { claimed: false };
    await ctx.db.patch(args.notificationId, { status: "sending", claimedAt: nowIso });
    return { claimed: true };
  },
});

/** Mark a notification row sent (internal mutation, audited). */
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
    await auditNotification(
      ctx,
      row.dedupeKey,
      args.status === "sent" ? "notification_sent" : "notification_failed",
      args.status,
      nowIso,
      row.status,
    );
  },
});

/**
 * Record a failed delivery attempt: increment `attempts` and decide the next
 * state. Under the cap → requeue to "pending" (a later wave retries it). At the
 * cap → "failed" (terminal), so a persistently-broken send cannot loop forever.
 * claimableNotifications surfaces "pending" rows, so the requeue IS the retry.
 */
export const failNotification = internalMutation({
  args: {
    notificationId: v.id("notification_queue"),
    now: v.optional(v.string()),
    maxAttempts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const nowIso = args.now ?? new Date().toISOString();
    const max = args.maxAttempts ?? MAX_NOTIFICATION_ATTEMPTS;
    const row = await ctx.db.get(args.notificationId);
    if (!row) return { status: "failed" as const, attempts: 0 };
    const attempts = (row.attempts ?? 0) + 1;
    const status = attempts >= max ? ("failed" as const) : ("pending" as const);
    await ctx.db.patch(args.notificationId, { status, attempts });
    await auditNotification(
      ctx,
      row.dedupeKey,
      status === "failed" ? "notification_failed" : "notification_retry",
      status,
      nowIso,
      row.status,
    );
    return { status, attempts };
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
    const batch = await ctx.runQuery(internal.watcher.claimableNotifications, {
      now: nowIso,
      limit: args.limit,
    });

    let sent = 0;
    let failed = 0;
    for (const row of batch) {
      // Claim first (pending → sending). If a concurrent wave already claimed it,
      // skip — never hand the same row to a sender twice.
      const claim = await ctx.runMutation(internal.watcher.claimNotification, {
        notificationId: row._id,
        now: nowIso,
      });
      if (!claim.claimed) continue;

      const parts = await ctx.runQuery(internal.watcher.notificationMessageParts, {
        notificationId: row._id,
      });
      if (!parts) {
        // Message parts vanished (event/target gone) — count the attempt; the
        // retry cap keeps this bounded rather than leaving the row stuck "sending".
        await ctx.runMutation(internal.watcher.failNotification, {
          notificationId: row._id,
          now: nowIso,
        });
        failed += 1;
        continue;
      }
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
        // Transient failure → increment attempts; requeue to "pending" under the
        // cap, else park "failed". The cap makes the retry loop terminate.
        await ctx.runMutation(internal.watcher.failNotification, {
          notificationId: row._id,
          now: nowIso,
        });
        failed += 1;
      }
    }
    return { dispatched: batch.length, sent, failed };
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
