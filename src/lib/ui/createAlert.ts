// Alert-create wiring for the "Set an alert" screen (Task 12, watcher design
// 2026-06-22). The screen's submit collects the buyer's catalog pick + city +
// date + format + alert toggles + channels and calls the client-facing
// `createAlert` mutation, then shows a confirmation.
//
// Two layers, both unit-testable with `bun test` (no DOM, no network):
//   - buildCreateAlertArgs(): PURE selection -> mutation args. Normalizes the
//     toggles to the exact literals the mutation validates, drops a blank format,
//     and defaults to the availability alert + email channel when nothing is on.
//   - submitCreateAlert(): the resilient wrapper. When Convex is configured it
//     calls the real mutation through the existing client boundary; otherwise
//     (or on any error) it returns a mock confirmation so the screen never
//     breaks — mirroring the dataAdapter mutation wrappers.
//
// The function reference is built locally by name (module:export) so this stays
// independent of Convex codegen, exactly like src/lib/convex/functionRefs.ts.
// We intentionally do NOT extend the shared functionRefs/dataAdapter registries
// here — this screen owns its own alert-create seam.

import { makeFunctionReference } from "convex/server";

import { getConvexClient } from "../convex/client";
import { isConvexConfigured } from "../convex/env";

// Mirrors the createAlert validator unions in convex/watcher.ts. Keep in sync if
// the mutation's accepted alert types / channels change.
export const ALERT_TYPES = ["availability", "discount", "price_drop", "last_minute"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const CHANNELS = ["email", "web_push"] as const;
export type Channel = (typeof CHANNELS)[number];

/** The buyer's selections collected from the create-alert screen. */
export interface AlertSelection {
  catalogItemId: string;
  city: string;
  date: string;
  /** Optional show format (e.g. "IMAX 3D"); blank/whitespace is treated as absent. */
  format?: string;
  alertTypes: AlertType[];
  channels: Channel[];
}

/** Exactly the argument shape of the `createAlert` mutation (convex/watcher.ts). */
export interface CreateAlertArgs {
  catalogItemId: string;
  city: string;
  date: string;
  format?: string;
  alertTypes: AlertType[];
  channels: Channel[];
}

/** Outcome surfaced to the screen so it can render a confirmation. */
export interface CreateAlertResult {
  ok: boolean;
  /** "created" = real Convex write; "mock" = no-Convex / fallback confirmation. */
  status: "created" | "mock";
  wantKey?: string;
  monitorTargetId?: string;
}

/** Injectable seams so the wrapper is testable without a real client / env. */
export interface CreateAlertDeps {
  isConfigured: () => boolean;
  getClient: () => Promise<{ mutation: (ref: unknown, args: unknown) => Promise<unknown> } | null>;
}

const createAlertRef = makeFunctionReference<"mutation">("watcher:createAlert");

function uniqueKnown<T extends string>(values: readonly string[], allowed: readonly T[]): T[] {
  const out: T[] = [];
  for (const value of values) {
    if ((allowed as readonly string[]).includes(value) && !out.includes(value as T)) {
      out.push(value as T);
    }
  }
  return out;
}

/**
 * PURE: turn the screen's selection into the createAlert mutation args.
 * - drops unknown alert-type / channel tokens (only the mutation's literals survive);
 * - defaults to ["availability"] / ["email"] when nothing is toggled on, matching
 *   the mutation's own server-side defaults so the no-toggle case still arms a usable alert;
 * - omits a blank/whitespace format rather than sending an empty string;
 * - throws when no catalog item is selected (you cannot watch nothing).
 */
export function buildCreateAlertArgs(selection: AlertSelection): CreateAlertArgs {
  const catalogItemId = selection.catalogItemId.trim();
  if (!catalogItemId) throw new Error("ALERT_NO_CATALOG_ITEM");

  const alertTypes = uniqueKnown(selection.alertTypes, ALERT_TYPES);
  const channels = uniqueKnown(selection.channels, CHANNELS);
  const format = selection.format?.trim();

  return {
    catalogItemId,
    city: selection.city.trim(),
    date: selection.date.trim(),
    ...(format ? { format } : {}),
    alertTypes: alertTypes.length > 0 ? alertTypes : ["availability"],
    channels: channels.length > 0 ? channels : ["email"],
  };
}

/**
 * PURE: build an {@link AlertSelection} from the raw values read off the
 * create-alert screen DOM — the selected catalog row's `data-*` attributes plus
 * the `key`s of the alert/channel toggles that are switched on. Unknown tokens
 * are dropped here; blank/whitespace fields collapse to "" (and a blank format is
 * omitted) so {@link buildCreateAlertArgs} applies its defaults downstream. This
 * is the screen↔mutation mapping the "Set an alert" form relies on (Task 12).
 */
export function alertSelectionFrom(raw: {
  catalogItemId?: string | null;
  city?: string | null;
  date?: string | null;
  format?: string | null;
  alertKeys?: readonly string[];
  channelKeys?: readonly string[];
}): AlertSelection {
  const format = raw.format?.trim();
  return {
    catalogItemId: (raw.catalogItemId ?? "").trim(),
    city: (raw.city ?? "").trim(),
    date: (raw.date ?? "").trim(),
    ...(format ? { format } : {}),
    alertTypes: uniqueKnown(raw.alertKeys ?? [], ALERT_TYPES),
    channels: uniqueKnown(raw.channelKeys ?? [], CHANNELS),
  };
}

const defaultDeps: CreateAlertDeps = {
  isConfigured: isConvexConfigured,
  // The shared ConvexClient's `mutation` is generically typed — narrower than this
  // structural seam (which only needs "something callable with (ref, args)").
  // submitCreateAlert only ever calls it with a FunctionReference + plain args, so
  // adapt the real client to the seam explicitly (TS can't prove the generic match).
  getClient: getConvexClient as unknown as CreateAlertDeps["getClient"],
};

/**
 * Resilient submit: build args, then call the real `createAlert` mutation when
 * Convex is configured; otherwise (or on any error) return a mock confirmation
 * so the screen always confirms to the buyer. Never throws to the caller for a
 * transport/auth failure — the screen shows the friendly "we'll alert you" copy
 * either way (the alert is genuinely persisted only on the "created" path).
 */
export async function submitCreateAlert(
  selection: AlertSelection,
  deps: CreateAlertDeps = defaultDeps,
): Promise<CreateAlertResult> {
  const args = buildCreateAlertArgs(selection);

  if (!deps.isConfigured()) return { ok: true, status: "mock" };

  const client = await deps.getClient();
  if (!client) return { ok: true, status: "mock" };

  // Mutation errors PROPAGATE (e.g. WATCH_DATE_IN_PAST): masking them as a
  // mock confirmation told the buyer "we'll alert you" while nothing was
  // persisted — the exact silent-failure Codex flagged on PR #49.
  const res = (await client.mutation(createAlertRef, args)) as
    | { wantKey?: string; monitorTargetId?: string }
    | null;
  return {
    ok: true,
    status: "created",
    ...(res?.wantKey ? { wantKey: res.wantKey } : {}),
    ...(res?.monitorTargetId ? { monitorTargetId: res.monitorTargetId } : {}),
  };
}
