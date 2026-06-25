// Alert-payoff view mapper for the "Set an alert" payoff card (Task 13, watcher
// design 2026-06-22). PURE: maps the union return shape of `getAlertPayoff`
// (convex/watcher.ts) into a render-ready view model the alerts/payoff card
// consumes — no DOM, no network, unit-testable with `bun test`.
//
// Zwapit watches official platforms and, when a show is live, deep-links the
// buyer OUT to the official site to book (we never resell official inventory).
// The deep-link is only ever emitted for a safe http(s) bookingUrl — the
// watcher's A03/A10 guard carried to the render boundary so the card can never
// produce a javascript:/data:/other-scheme href.

/** One decoded show on a live payoff. */
export interface AlertPayoffShowtime {
  theatre: string;
  time: string;
  format: string;
}

/** A live target: at least one official show is open. */
export interface LiveAlertPayoff {
  status: "live";
  isLive: true;
  title: string;
  theatres: string[];
  showtimes: AlertPayoffShowtime[];
  /** Official booking URL; may be absent/unsafe — the mapper guards it. */
  bookingUrl?: string | null;
}

/** A non-live target (still watching, or closed/degraded). */
export interface PendingAlertPayoff {
  status: "watching" | "closed" | "degraded";
  isLive: false;
  title?: string | null;
}

/**
 * `getAlertPayoff`'s shape: a live payoff, a non-live payoff, or `null` when the
 * caller has no alert on this target (or it isn't theirs).
 */
export type AlertPayoffResult = LiveAlertPayoff | PendingAlertPayoff | null;

/** The "Tickets are live" card. */
export interface LiveAlertCard {
  kind: "live";
  title: string;
  heading: "Tickets are live";
  theatres: string[];
  showtimes: AlertPayoffShowtime[];
  /** Safe http(s) deep-link OUT, or null when no usable link exists. */
  bookingHref: string | null;
  ctaLabel: "Open booking";
}

/** The "We'll notify you" waiting card. */
export interface WaitingAlertCard {
  kind: "waiting";
  title: string | null;
  heading: "We'll notify you";
  message: string;
}

export type AlertPayoffView = LiveAlertCard | WaitingAlertCard;

/**
 * Return the bookingUrl only if it is a safe, well-formed http(s) URL; otherwise
 * null. Drops empty/whitespace, malformed, and non-http(s) schemes
 * (javascript:, data:, ftp:, …) so the card never renders an unsafe href.
 */
function safeBookingHref(bookingUrl: string | null | undefined): string | null {
  if (typeof bookingUrl !== "string") return null;
  const trimmed = bookingUrl.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return trimmed;
}

/**
 * PURE: map a (possibly null) `getAlertPayoff` result to the card the screen
 * renders. A live target → the "Tickets are live" card (with a safe deep-link
 * OUT when available); anything else (watching / closed / degraded / no alert)
 * → the "We'll notify you" waiting card. Never fabricates a live card.
 */
export function alertPayoffView(result: AlertPayoffResult): AlertPayoffView {
  if (result && result.status === "live") {
    return {
      kind: "live",
      title: result.title,
      heading: "Tickets are live",
      theatres: result.theatres,
      showtimes: result.showtimes,
      bookingHref: safeBookingHref(result.bookingUrl),
      ctaLabel: "Open booking",
    };
  }

  return {
    kind: "waiting",
    title: result?.title ?? null,
    heading: "We'll notify you",
    message: "We'll notify you the moment tickets are live.",
  };
}
