import { afterEach, describe, expect, test } from "bun:test";

import {
  alertSelectionFrom,
  buildCreateAlertArgs,
  submitCreateAlert,
  type AlertSelection,
  type CreateAlertDeps,
} from "../createAlert";

function selection(overrides: Partial<AlertSelection> = {}): AlertSelection {
  return {
    catalogItemId: "catalog_movie_dune3",
    city: "Bengaluru",
    date: "2026-06-21",
    format: "IMAX 3D",
    alertTypes: ["availability", "discount"],
    channels: ["email", "web_push"],
    ...overrides,
  };
}

describe("buildCreateAlertArgs (alert-create payload, U-watcher)", () => {
  test("should map a full selection to the createAlert mutation args", () => {
    expect(buildCreateAlertArgs(selection())).toEqual({
      catalogItemId: "catalog_movie_dune3",
      city: "Bengaluru",
      date: "2026-06-21",
      format: "IMAX 3D",
      alertTypes: ["availability", "discount"],
      channels: ["email", "web_push"],
    });
  });

  test("should omit an empty/whitespace format rather than send a blank string", () => {
    const args = buildCreateAlertArgs(selection({ format: "   " }));
    expect("format" in args).toBe(false);
    expect(args.catalogItemId).toBe("catalog_movie_dune3");
  });

  test("should default to the availability alert + email channel when none are toggled on", () => {
    const args = buildCreateAlertArgs(selection({ alertTypes: [], channels: [] }));
    expect(args.alertTypes).toEqual(["availability"]);
    expect(args.channels).toEqual(["email"]);
  });

  test("should drop unknown alert-type / channel tokens (only the mutation's literals survive)", () => {
    const args = buildCreateAlertArgs(
      selection({
        alertTypes: ["availability", "bogus", "price_drop"] as AlertSelection["alertTypes"],
        channels: ["web_push", "sms"] as AlertSelection["channels"],
      }),
    );
    expect(args.alertTypes).toEqual(["availability", "price_drop"]);
    expect(args.channels).toEqual(["web_push"]);
  });

  test("should throw when no catalog item is selected (cannot watch nothing)", () => {
    expect(() => buildCreateAlertArgs(selection({ catalogItemId: "" }))).toThrow();
  });
});

describe("submitCreateAlert (wrapper, U-watcher)", () => {
  const ORIGINAL_DEPS: Array<() => void> = [];
  afterEach(() => {
    while (ORIGINAL_DEPS.length) ORIGINAL_DEPS.pop()!();
  });

  test("should report a mock confirmation when Convex is not configured (no client)", async () => {
    const deps: CreateAlertDeps = {
      isConfigured: () => false,
      getClient: async () => null,
    };
    const result = await submitCreateAlert(selection(), deps);
    expect(result).toEqual({ ok: true, status: "mock" });
  });

  test("should call the createAlert mutation with the built args and return its wantKey", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const fakeClient = {
      mutation: async (ref: { toString?: () => string } | string, args: unknown) => {
        const name = typeof ref === "string" ? ref : String(ref);
        calls.push({ name, args });
        return { wantKey: "want_alert_x", monitorTargetId: "mt_1", collapseKey: "ck_1" };
      },
    };
    const deps: CreateAlertDeps = {
      isConfigured: () => true,
      getClient: async () => fakeClient as unknown as Parameters<CreateAlertDeps["getClient"]> extends never ? never : Awaited<ReturnType<CreateAlertDeps["getClient"]>>,
    };
    const result = await submitCreateAlert(selection(), deps);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("created");
    expect(result.wantKey).toBe("want_alert_x");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).toEqual({
      catalogItemId: "catalog_movie_dune3",
      city: "Bengaluru",
      date: "2026-06-21",
      format: "IMAX 3D",
      alertTypes: ["availability", "discount"],
      channels: ["email", "web_push"],
    });
  });

  test("should fall back to a mock confirmation when the mutation throws (never breaks the screen)", async () => {
    const fakeClient = {
      mutation: async () => {
        throw new Error("AUTH_REQUIRED");
      },
    };
    const deps: CreateAlertDeps = {
      isConfigured: () => true,
      getClient: async () => fakeClient as never,
    };
    const result = await submitCreateAlert(selection(), deps);
    expect(result).toEqual({ ok: true, status: "mock" });
  });
});

describe("alertSelectionFrom (screen DOM → selection, U-watcher Task 12)", () => {
  test("maps the selected catalog row's data-* + on-toggle keys to a selection", () => {
    expect(
      alertSelectionFrom({
        catalogItemId: "catalog_movie_dune3",
        city: "Bengaluru",
        date: "2026-06-21",
        format: "IMAX 3D",
        alertKeys: ["availability", "discount"],
        channelKeys: ["email"],
      }),
    ).toEqual({
      catalogItemId: "catalog_movie_dune3",
      city: "Bengaluru",
      date: "2026-06-21",
      format: "IMAX 3D",
      alertTypes: ["availability", "discount"],
      channels: ["email"],
    });
  });

  test("drops unknown alert/channel keys (only mutation literals survive)", () => {
    const sel = alertSelectionFrom({
      catalogItemId: "c1",
      city: "BLR",
      date: "2026-06-21",
      alertKeys: ["availability", "bogus"],
      channelKeys: ["email", "sms"],
    });
    expect(sel.alertTypes).toEqual(["availability"]);
    expect(sel.channels).toEqual(["email"]);
  });

  test("coalesces missing/blank fields and omits a blank format", () => {
    const sel = alertSelectionFrom({
      catalogItemId: "  c1  ",
      city: null,
      date: undefined,
      format: "   ",
      alertKeys: [],
      channelKeys: [],
    });
    expect(sel).toEqual({ catalogItemId: "c1", city: "", date: "", alertTypes: [], channels: [] });
    expect("format" in sel).toBe(false);
  });

  test("its output feeds buildCreateAlertArgs (defaults apply when nothing is on)", () => {
    const args = buildCreateAlertArgs(
      alertSelectionFrom({ catalogItemId: "c1", city: "BLR", date: "2026-06-21", alertKeys: [], channelKeys: [] }),
    );
    expect(args.alertTypes).toEqual(["availability"]);
    expect(args.channels).toEqual(["email"]);
  });
});
