// Notification senders for the official-availability watcher.
//
// PURE TS — no Convex-runtime imports. The Convex action (watcher.ts) imports
// `defaultSenders` and calls them; tests import this file directly and inject a
// mock `Senders` object, so no real network and no secrets are needed to test.
//
// Design contract (design.md §Constraints, §A05):
//   - Email uses Resend (RESEND_API_KEY); web push uses VAPID (VAPID_*).
//   - BOTH default senders are ENV-GATED: when their env is unset they NO-OP and
//     return { skipped:true } — never throw, never send. This is the state in
//     tests (secrets are env-only, never committed) and the safe default before
//     keys are configured.
//   - The message is a deep-link OUT to the official BMS/District page only —
//     Zwapit never books or holds inventory.
//
// The `resend` / `web-push` packages are NOT yet in package.json (adding them is
// the audited notify-task step, design §A06). To keep this file importable and
// tsc-clean with neither package installed, the real-send branches use a LAZY
// dynamic import via a NON-LITERAL specifier. Because the env check returns
// before that branch whenever a key is unset, the import is never reached in
// tests or in any unconfigured environment.

/**
 * The wire shape every sender transmits. The caller (watcher.ts) assembles the
 * copy via `buildLiveMessage`; a sender just delivers `{ title, body, url }`.
 * `url` is always the official deep-link OUT.
 */
export interface NotificationMessage {
  /** Approved copy, e.g. "Tickets are live". */
  title: string;
  /** "<movie> · <theatre> · <time> — book now". */
  body: string;
  /** Official BMS/District booking URL (deep-link OUT only). */
  url: string;
}

/**
 * Result of a send attempt.
 * - { sent: true }     — delivered (or handed to the provider).
 * - { skipped: true }  — env unset, intentional no-op (default sender, no key).
 * A throwing sender (network failure) is surfaced to the caller so the queue can
 * mark the row `failed` and retry — senders do not swallow real errors.
 */
export interface SenderResult {
  sent?: boolean;
  skipped?: boolean;
  /** Human-readable note, mainly why a send was skipped. */
  reason?: string;
}

/** A single channel sender. */
export type Sender = (message: NotificationMessage) => Promise<SenderResult>;

/** The injectable sender set: one per live channel (Email + Web Push). */
export interface Senders {
  email: Sender;
  webpush: Sender;
}

/**
 * Build the "Tickets are live" notification message from its parts. Kept here so
 * the approved copy lives in exactly one place. Uses only approved user-facing
 * words (design §User-Facing Language).
 */
export function buildLiveMessage(parts: {
  movie: string;
  theatre: string;
  time: string;
  url: string;
}): NotificationMessage {
  return {
    title: "Tickets are live",
    body: `${parts.movie} · ${parts.theatre} · ${parts.time} — book now`,
    url: parts.url,
  };
}

/**
 * Lazily resolve a dynamic module by name without a literal import specifier, so
 * `tsc` does not try to resolve an uninstalled package at build time. Returns
 * `null` if the module is absent at runtime. This is only ever reached when a
 * sender's env key IS set (i.e. someone configured real credentials).
 */
async function loadOptionalModule(name: string): Promise<unknown | null> {
  // Indirection: a non-literal specifier types as `any` and is not statically
  // resolved by tsc, so this file stays clean with `resend`/`web-push` absent.
  const specifier: string = name;
  try {
    return await import(/* @vite-ignore */ specifier);
  } catch {
    return null;
  }
}

/**
 * Default email sender via Resend. NO-OP + { skipped:true } when RESEND_API_KEY
 * is unset (the env check comes FIRST — no package is touched in that case).
 */
const emailSender: Sender = async (message) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "RESEND_API_KEY unset — email no-op" };
  }
  // Real-send branch (only with a configured key; never exercised in tests).
  const mod = (await loadOptionalModule("resend")) as
    | { Resend?: new (key: string) => unknown }
    | null;
  if (!mod || typeof mod.Resend !== "function") {
    return { skipped: true, reason: "resend package not installed" };
  }
  const client = new mod.Resend(apiKey) as {
    emails: { send: (args: Record<string, unknown>) => Promise<unknown> };
  };
  await client.emails.send({
    from: process.env.RESEND_FROM ?? "alerts@zwapit.app",
    subject: message.title,
    text: `${message.body}\n\n${message.url}`,
  });
  return { sent: true };
};

/**
 * Default web-push sender via VAPID. NO-OP + { skipped:true } when the VAPID env
 * keys are unset (env check FIRST — no package touched in that case).
 */
const webpushSender: Sender = async (message) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return { skipped: true, reason: "VAPID keys unset — web push no-op" };
  }
  // Real-send branch (only with configured keys; never exercised in tests).
  const mod = (await loadOptionalModule("web-push")) as
    | {
        setVapidDetails?: (subject: string, pub: string, priv: string) => void;
        sendNotification?: (sub: unknown, payload: string) => Promise<unknown>;
      }
    | null;
  if (!mod || typeof mod.sendNotification !== "function") {
    return { skipped: true, reason: "web-push package not installed" };
  }
  mod.setVapidDetails?.(
    process.env.VAPID_SUBJECT ?? "mailto:alerts@zwapit.app",
    publicKey,
    privateKey,
  );
  // The actual push subscription is supplied by the caller per recipient; this
  // default is the wiring point. With no subscription wired yet we no-op rather
  // than fabricate one.
  return { skipped: true, reason: "no push subscription wired" };
};

/**
 * Default injectable sender set. Both channels no-op safely until their env is
 * configured. watcher.ts uses these by default and tests inject mocks.
 */
export const defaultSenders: Senders = {
  email: emailSender,
  webpush: webpushSender,
};
