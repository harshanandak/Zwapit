// Scheduled jobs for the official-availability watcher (design 2026-06-22).
//
// pollDueTargets runs every few minutes: it polls only IN-WINDOW, still-watching
// targets (real-user-triggered — a target exists only because someone set an
// alert), stops on detect, and is idempotent. dispatchNotifications drains the
// pending notification outbox. Both are internalActions (never client-callable);
// the cron is the only trigger in this slice. Source fetch + senders read their
// secrets from Convex env and no-op safely when unset (design §Constraints).

import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Poll cadence. Kept modest in v1 (cost lever: shared targets + stop-on-detect
// already cap fan-out); tune per Parallel budget at /verify.
crons.interval(
  "poll-availability",
  { minutes: 5 },
  internal.watcher.pollDueTargets,
  {},
);

// Drain the notification outbox shortly after each poll wave.
crons.interval(
  "dispatch-notifications",
  { minutes: 5 },
  internal.watcher.dispatchNotifications,
  {},
);

// Expire alert wants once their watch date is fully past: detach each from its
// shared target and close the target when its subscriber count hits 0 — which
// also stops past-date polling. Hourly is ample (expiry is date-granular).
crons.interval(
  "expire-wants",
  { hours: 1 },
  internal.watcher.expireWants,
  {},
);

export default crons;
