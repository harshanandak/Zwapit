// Shared TypeScript types for the official-availability watcher.
//
// PURE TS — no Convex-runtime imports. parse.ts / adapters.ts / senders.ts and
// the watcher Convex functions all import from here so the normalized shape and
// the source-status decode are defined in exactly one place. Keeping this file
// runtime-free lets every pure unit test import it without Convex codegen.
//
// Naming note: `monitor_target`, `availability_event`, etc. are INTERNAL table /
// type names. They never surface to users; user-facing copy uses approved terms
// ("Tickets are live", "Notify me"). See design.md §Constraints.

/** Which official platform a normalized show was read from. "curated" = an
 *  admin-marked live-event availability (no automated source). */
export type ShowSource = "bms" | "district" | "curated";

/**
 * Decoded per-show fill status. BMS supplies this via `AVAIL_STATUS_MAP`;
 * District's rendered text carries booking-open only, so District shows leave
 * `status` undefined (design §Out of scope: District has no fill-status).
 */
export type ShowStatus = "sold_out" | "almost_full" | "filling_fast" | "available";

/**
 * The single normalized shape every source parser emits. `unionAndDedupe`
 * merges BMS + District lists of these into one deduped set keyed by canonical
 * venue. `bookingUrl` is always the official deep-link OUT — Zwapit never books.
 */
export interface NormalizedShow {
  source: ShowSource;
  theatreName: string;
  /** Source-native venue code (BMS venueCode / District CD code) when present. */
  venueCode?: string;
  /** ISO-8601 instant, or the source-native "HH:MM" showtime label. */
  showTime: string;
  /** e.g. "2D", "3D", "IMAX 2D" — source-native format string. */
  format: string;
  status?: ShowStatus;
  /** Official BMS/District booking URL for this show (deep-link OUT only). */
  bookingUrl?: string;
}

/**
 * Lifecycle of a shared `monitor_targets` row.
 * - watching: polling in-window, not yet open
 * - live: booking detected open on at least one source (stop-on-detect)
 * - closed: no subscribers left
 * - degraded: K consecutive empty/blocked polls — suppress, keep deep-link CTA
 */
export type MonitorTargetStatus = "watching" | "live" | "closed" | "degraded";

/**
 * Alert types a request can carry. Only Availability + Last-minute are
 * DELIVERED in this slice (design §Out of scope); Discount / Price-drop are
 * captured now, delivered later.
 */
export type AlertType = "availability" | "discount" | "price_drop" | "last_minute";

/** Notification channels live in this slice. WhatsApp/Telegram are deferred. */
export type Channel = "email" | "web_push";

/**
 * BMS availability-status decode (validated this session; see
 * docs/work/2026-06-20-catalog-data-maps-research/bms-oss-reuse-execution.md).
 * Depend on these numeric codes, not on BMS's JSON card nesting (which reshapes).
 */
export const AVAIL_STATUS_MAP: Record<number, ShowStatus> = {
  0: "sold_out",
  1: "almost_full",
  2: "filling_fast",
  3: "available",
};
