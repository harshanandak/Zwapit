// Pure parse + decode + dedupe library for the official-availability watcher.
//
// PURE TS — NO Convex-runtime imports. The Convex action in watcher.ts imports
// these and calls them; keeping this file runtime-free lets every function be
// unit-tested with `bun test` without codegen.
//
// Sources (empirically validated this session — do not re-derive):
//   docs/work/2026-06-20-catalog-data-maps-research/bms-oss-reuse-execution.md
//   docs/work/2026-06-20-catalog-data-maps-research/district-reuse-execution.md
//
// BMS gives clean JSON (ShowDetails model) with a per-show AvailStatus (0-3).
// District gives rendered TEXT (no JSON, no per-show fill-status, no venue code):
// `* <Theatre>` then `+ HH:MM AM/PM <format>` lines.

import {
  AVAIL_STATUS_MAP,
  type NormalizedShow,
  type ShowStatus,
} from "./types";

// Re-export so callers (and tests) get the decode constant from one entry point.
export { AVAIL_STATUS_MAP };

// ---------------------------------------------------------------------------
// BMS — clean JSON (ShowDetails[0].Event[].ChildEvents[].ShowTimes[])
// ---------------------------------------------------------------------------

// Loose shapes: source bytes are untrusted (A03/A10). We never `eval`; we read
// only the fields we need and tolerate missing/extra keys.
interface BmsShowTime {
  ShowTime?: string;
  AvailStatus?: number | string;
}
interface BmsChildEvent {
  EventDimension?: string;
  ShowTimes?: BmsShowTime[];
}
interface BmsEvent {
  EventTitle?: string;
  ChildEvents?: BmsChildEvent[];
}
interface BmsShowDetail {
  Event?: BmsEvent[];
  VenueCode?: string;
  VenueName?: string;
}
interface BmsPayload {
  ShowDetails?: BmsShowDetail[];
}

/**
 * Decode a BMS `AvailStatus` into a ShowStatus. Only a valid 0-3 maps; blank,
 * absent, or out-of-range leaves status undefined. (Live test saw `AvailStatus`
 * blank — coercing with `Number(x) || 0` would wrongly mark it sold_out, so we
 * decode strictly.)
 */
function decodeAvailStatus(raw: number | string | undefined): ShowStatus | undefined {
  if (typeof raw !== "number") return undefined;
  if (!Number.isInteger(raw)) return undefined;
  return AVAIL_STATUS_MAP[raw];
}

/**
 * Shared BMS parser. `byvenue` and `byevent` both return the same ShowDetails
 * model (per bms execution doc §2), so one walker serves both. Flattens
 * ShowDetails[] x Event[] x ChildEvents[] x ShowTimes[] into NormalizedShow[].
 */
function parseBmsShowDetails(payload: BmsPayload): NormalizedShow[] {
  const details = Array.isArray(payload?.ShowDetails) ? payload.ShowDetails : [];
  const shows: NormalizedShow[] = [];

  for (const detail of details) {
    const theatreName = detail?.VenueName ?? "";
    const venueCode = detail?.VenueCode;
    const events = Array.isArray(detail?.Event) ? detail.Event : [];

    for (const event of events) {
      const children = Array.isArray(event?.ChildEvents) ? event.ChildEvents : [];
      for (const child of children) {
        const format = child?.EventDimension ?? "";
        const showTimes = Array.isArray(child?.ShowTimes) ? child.ShowTimes : [];
        for (const st of showTimes) {
          const showTime = st?.ShowTime;
          if (!showTime) continue;
          const status = decodeAvailStatus(st?.AvailStatus);
          shows.push({
            source: "bms",
            theatreName,
            ...(venueCode ? { venueCode } : {}),
            showTime,
            format,
            ...(status !== undefined ? { status } : {}),
          });
        }
      }
    }
  }

  return shows;
}

/** Parse the proven `/api/v2/mobile/showtimes/byvenue` JSON payload. */
export function parseBmsByVenue(payload: unknown): NormalizedShow[] {
  return parseBmsShowDetails((payload ?? {}) as BmsPayload);
}

/**
 * Parse the `/api/movies-data/showtimes-by-event` JSON payload. Same ShowDetails
 * model as byvenue. NOTE: the live byevent shape (region params) is Task 8/9's
 * validation job — this parser is tolerant of the empty-ShowDetails case the
 * live probe returned, and reuses the byvenue walker.
 */
export function parseBmsByEvent(payload: unknown): NormalizedShow[] {
  return parseBmsShowDetails((payload ?? {}) as BmsPayload);
}

// ---------------------------------------------------------------------------
// District — rendered text (`* <Theatre>` / `+ HH:MM AM/PM <format>`)
// ---------------------------------------------------------------------------

// Greedy capture + `$` (no lazy `(.+?)\s*$`, which Sonar flags as super-linear).
// Lines are pre-trimmed (loop) and captures are .trim()'d below, so this is
// behavior-identical without the backtracking risk.
const DISTRICT_THEATRE = /^\*\s+(.+)$/;
// `+ 09:00 AM PXL 3D` -> [time+meridiem, format]; `+ 13:45` / `+ 09:00 AM` ->
// [time+meridiem, undefined]. The meridiem binds to the TIME group and the format
// group is optional, so a meridiem-last or format-less line keeps its AM/PM
// instead of swallowing it into `format`.
const DISTRICT_SHOW = /^\+\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)(?:\s+(.+))?$/i;

/**
 * Parse the District movie-in-city rendered text into NormalizedShow[].
 * District text carries booking-open + theatre + showtime + format only — no
 * per-show fill-status (colour-coded, lost in text) and no venue code. Each
 * `+ ...` show line attaches to the most recent `* <Theatre>` line; all other
 * lines (date strip, status legend, cancellation policy) are ignored.
 * Empty result === booking not open.
 */
export function parseDistrictMovieCity(text: string): NormalizedShow[] {
  const shows: NormalizedShow[] = [];
  if (!text) return shows;

  let currentTheatre: string | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const theatreMatch = DISTRICT_THEATRE.exec(line);
    if (theatreMatch) {
      currentTheatre = theatreMatch[1].trim();
      continue;
    }

    const showMatch = DISTRICT_SHOW.exec(line);
    if (showMatch && currentTheatre) {
      const showTime = showMatch[1].replace(/\s+/g, " ").trim();
      const format = showMatch[2]?.trim() ?? "";
      shows.push({
        source: "district",
        theatreName: currentTheatre,
        showTime,
        format,
      });
    }
    // any other line (legend, date strip, "Allows cancellation") is ignored
  }

  return shows;
}

// ---------------------------------------------------------------------------
// EVENT detail pages (probed 2026-08-21 — events-phase2 decisions.md).
//
// BMS and District event availability lives on the rendered DETAIL PAGE as
// text, not in the movie JSON APIs (showtimes-by-event never populates
// ShowDetails for events). Both parsers read Parallel's markdown conversion.
// ---------------------------------------------------------------------------

/** Severity order: the most restrictive bookable state wins when several
 * markers co-occur on one page (BMS pages show "Filling Fast" AND "Book Now"). */
const EVENT_STATUS_PRIORITY: ReadonlyArray<ShowStatus> = [
  "sold_out",
  "almost_full",
  "filling_fast",
  "available",
];

/** Text markers → status, scanned case-insensitively. From live probes:
 * BMS "Filling Fast"/"Book Now"; District "General Sale is live now"/"Live". */
const BMS_EVENT_STATUS_MARKERS: ReadonlyArray<readonly [string, ShowStatus]> = [
  ["sold out", "sold_out"],
  ["filling fast", "filling_fast"],
  ["almost full", "almost_full"],
  ["book now", "available"],
];

const DISTRICT_EVENT_STATUS_MARKERS: ReadonlyArray<readonly [string, ShowStatus]> = [
  ["sold out", "sold_out"],
  ["general sale is live now", "available"],
  ["book tickets", "available"],
];

/** Highest-severity status whose marker appears in `lower`-cased page text. */
function eventStatusFromMarkers(
  lower: string,
  markers: ReadonlyArray<readonly [string, ShowStatus]>,
): ShowStatus | undefined {
  let best: ShowStatus | undefined;
  for (const [, status] of markers) {
    const found = markers.some(([m, s]) => s === status && lower.includes(m));
    if (found && (!best || EVENT_STATUS_PRIORITY.indexOf(status) < EVENT_STATUS_PRIORITY.indexOf(best))) {
      best = status;
    }
  }
  return best;
}

/**
 * Parse a BMS EVENT detail page (markdown via Parallel) into NormalizedShow[].
 * Emits a single show ONLY in a bookable state — sold-out and not-open-yet
 * pages return [] so the target keeps watching instead of firing "tickets are
 * live" for an unbuyable event. `format` is "event" (events sell by section,
 * not showtime — the collapse key's format segment stays empty via callers).
 */
export function parseBmsEventPage(text: string): NormalizedShow[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const status = eventStatusFromMarkers(lower, BMS_EVENT_STATUS_MARKERS);
  // Only BOOKABLE states open the alert; sold_out keeps watching (another
  // source/city may still have tickets) and no markers means not-open-yet.
  if (!status || status === "sold_out") return [];

  // Venue line shape from probes: "Yashobhoomi Convention Center: Delhi".
  // The page header city is the READER's location — parse the venue line only.
  const venueMatch = text.match(/\n([^\n:]{3,80}):\s*([A-Za-z][A-Za-z .&'-]{1,40})\s*\n/);
  const theatreName = venueMatch?.[1]?.trim() || "Venue";

  // Date+time from probes: "Sat 16 Jan 2027" + "7:30 PM".
  const date = text.match(/\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s+\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/)?.[0];
  const time = text.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i)?.[0];
  const showTime = [date?.trim(), time?.trim()].filter(Boolean).join(" ");

  return [{ source: "bms", theatreName, showTime, format: "event", status }];
}

/**
 * Parse a District EVENT detail page (markdown via Parallel) into
 * NormalizedShow[]. Same bookable-only contract as parseBmsEventPage. District
 * pages carry the strongest signal: a sales timeline with pre-sale/general-sale
 * windows and a Live state marker.
 */
export function parseDistrictEventPage(text: string): NormalizedShow[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const status = eventStatusFromMarkers(lower, DISTRICT_EVENT_STATUS_MARKERS);
  if (!status || status === "sold_out") return [];

  // Venue line from probes: "District Arena @ Terraform, Bengaluru … km away"
  // or "Venue to be announced, Mumbai".
  const venueLine =
    text.match(/\n([^\n]+?)\s*\d+(?:\.\d+)?\s*km away\s*\n/)?.[1] ??
    text.match(/\n(Venue to be announced,[^\n]+)\n/i)?.[1];
  const theatreName = venueLine?.trim() || "Venue";

  // Datetime from probes: "Sat, 23 Jan, 6:00 PM".
  const showTime = text.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*\d{1,2}\s*[A-Za-z]{3},?\s*\d{1,2}:\d{2}\s*(?:AM|PM)\b/i)?.[0] ?? "";

  return [{ source: "district", theatreName, showTime, format: "event", status }];
}

/** True when `content` looks like an EVENT detail page rather than a movie
 * payload. Used by pollDueTargets to pick the District parser (District serves
 * two markdown shapes); BMS dispatch is by JSON-vs-markdown instead. Markers
 * are event-page-specific ON PURPOSE — District MOVIE pages carry a status
 * legend line ("Available Filling Fast Almost Full Sold Out") that would
 * otherwise misfire. */
export function looksLikeEventPage(content: string): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  return (
    lower.includes("book tickets") ||
    lower.includes("general sale") ||
    lower.includes("sales timeline")
  );
}

// ---------------------------------------------------------------------------
// Collapse key + snapshot hash (narrow, stable projections)
// ---------------------------------------------------------------------------

/**
 * The shared-watcher collapse key: many requests for the same movie+city+date
 * (+format) collapse to ONE monitor_targets row. Byte-identical across callers
 * is critical for find-or-create idempotency (Task 4), so this is the single
 * source of truth. Missing format -> empty trailing segment (`…|date|`). City
 * is assumed already canonical (caller passes the slug); not transformed here.
 */
export function computeCollapseKey(input: {
  catalogItemId: string;
  city: string;
  date: string;
  format?: string;
}): string {
  return [input.catalogItemId, input.city, input.date, input.format ?? ""].join("|");
}

const OFFICIAL_BOOKING_HOSTS = ["bookmyshow.com", "district.in"];

/**
 * Allowlist a deep-link OUT before it is persisted or returned: only an https URL
 * on an official BookMyShow/District host survives; any other host, non-https
 * scheme (javascript:/data:/…), or malformed value collapses to "" — so we never
 * store or hand a client an arbitrary/unsafe URL. Defense-in-depth: the render
 * side (alertPayoff.safeBookingHref) guards too.
 */
export function officialBookingUrl(url: string | null | undefined): string {
  if (!url) return "";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }
  if (parsed.protocol !== "https:") return "";
  const host = parsed.hostname.toLowerCase();
  const ok = OFFICIAL_BOOKING_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  return ok ? url : "";
}

/**
 * Stable hash of a NARROW projection of the shows (source + theatre + showtime +
 * format + open-flag) — NOT the raw NormalizedShow[]. Excludes `bookingUrl`
 * (carries a cache-bust `_cb=timestamp` that changes every poll) and `status`
 * so we only fire on real availability transitions, not churn. Tuples are
 * sorted so source/order changes do not alter the hash (design §Edge cases).
 */
export function snapshotHash(shows: NormalizedShow[]): string {
  const tuples = shows
    .map((s) => [s.source, s.theatreName, s.showTime, s.format].join(""))
    // Explicit code-point comparator (S2871): deterministic + environment-
    // independent, unlike localeCompare. Matches default sort order exactly, so
    // the hash value is unchanged — we only need a STABLE order for hashing.
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const serialized = tuples.join("");

  // Deterministic 32-bit FNV-1a-ish hash -> hex. No crypto needed (not a
  // security boundary; just change-detection), and stays pure/runtime-free.
  let hash = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// Union + dedupe across sources (Task 3)
// ---------------------------------------------------------------------------

/**
 * Maps a source-qualified venue key (`"bms:<venueCode>"` /
 * `"district:<normalized-theatre-name>"`) to a canonical venue id, so a theatre
 * present on BOTH sources collapses to one entry. Built by Task 9 from catalog /
 * venue rows; pure parse just consumes it.
 */
export type VenueMap = Record<string, string>;

export interface UnionResult {
  /** True iff at least one show is present on any source. */
  isOpen: boolean;
  /** Deduped shows; a venue+showtime+format present on both sources appears once. */
  shows: NormalizedShow[];
  /** One official deep-link-OUT booking URL when open, else undefined. */
  bookingUrl?: string;
}

function normalizeTheatreName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Canonical venue id for a show: venueMap hit first, else normalized name. */
function canonicalVenue(show: NormalizedShow, venueMap: VenueMap): string {
  const key = show.venueCode
    ? `${show.source}:${show.venueCode}`
    : `${show.source}:${normalizeTheatreName(show.theatreName)}`;
  const mapped = venueMap[key];
  if (mapped) return mapped;
  // Fallback: normalized theatre name bridges sources when no venueMap entry.
  return `name:${normalizeTheatreName(show.theatreName)}`;
}

/** Dedup identity: canonical venue + showtime + format. */
function dedupeIdentity(show: NormalizedShow, venueMap: VenueMap): string {
  return [canonicalVenue(show, venueMap), show.showTime, show.format].join("");
}

/**
 * Union BMS + District shows into one deduped set. A theatre present on both
 * sources (matched via venueMap canonical id, or normalized name fallback) for
 * the same showtime+format appears once. `isOpen` = any show present. Picks the
 * first available bookingUrl (BMS first by input order, then District) as the
 * deep-link OUT.
 */
export function unionAndDedupe(
  bmsShows: NormalizedShow[],
  districtShows: NormalizedShow[],
  venueMap: VenueMap = {},
): UnionResult {
  const seen = new Map<string, NormalizedShow>();
  let bookingUrl: string | undefined;

  for (const show of [...bmsShows, ...districtShows]) {
    if (!bookingUrl && show.bookingUrl) bookingUrl = show.bookingUrl;
    const id = dedupeIdentity(show, venueMap);
    if (!seen.has(id)) {
      seen.set(id, show);
    }
  }

  const shows = [...seen.values()];
  return {
    isOpen: shows.length > 0,
    shows,
    ...(bookingUrl ? { bookingUrl } : {}),
  };
}
