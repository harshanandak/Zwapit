import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  buildLiveMessage,
  defaultSenders,
  type NotificationMessage,
  type Sender,
  type SenderResult,
  type Senders,
} from "../watcher/senders";

// ---------------------------------------------------------------------------
// Env hygiene: senders read process.env lazily. Snapshot + restore the keys we
// touch so one test's env can never leak into another (and so a developer's
// real .env can't make these tests send for real).
// ---------------------------------------------------------------------------
const ENV_KEYS = [
  "RESEND_API_KEY",
  "RESEND_FROM",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

const sampleMessage: NotificationMessage = {
  title: "Tickets are live",
  body: "Inception · PVR Phoenix · 19:30 — book now",
  url: "https://in.bookmyshow.com/movies/inception/ET00000000",
};

describe("buildLiveMessage", () => {
  test("produces the approved title + body + deep-link URL", () => {
    const msg = buildLiveMessage({
      movie: "Inception",
      theatre: "PVR Phoenix",
      time: "19:30",
      url: "https://in.bookmyshow.com/movies/inception/ET00000000",
    });
    expect(msg.title).toBe("Tickets are live");
    expect(msg.body).toBe("Inception · PVR Phoenix · 19:30 — book now");
    expect(msg.url).toBe("https://in.bookmyshow.com/movies/inception/ET00000000");
  });

  test("uses no banned user-facing words in the copy", () => {
    const banned = [
      "escrow",
      "settlement",
      "dispute",
      "merchant",
      "fulfilment",
      "entitlement",
      "queue",
    ];
    const msg = buildLiveMessage({
      movie: "Inception",
      theatre: "PVR Phoenix",
      time: "19:30",
      url: "https://example.com",
    });
    const blob = `${msg.title} ${msg.body}`.toLowerCase();
    for (const word of banned) expect(blob.includes(word)).toBe(false);
  });
});

describe("defaultSenders — env-gated no-op", () => {
  test("email no-ops and returns {skipped:true} when RESEND_API_KEY is unset", async () => {
    const result = await defaultSenders.email(sampleMessage);
    expect(result.skipped).toBe(true);
    expect(result.sent).not.toBe(true);
  });

  test("webpush no-ops and returns {skipped:true} when VAPID keys are unset", async () => {
    const result = await defaultSenders.webpush(sampleMessage);
    expect(result.skipped).toBe(true);
    expect(result.sent).not.toBe(true);
  });

  test("default senders never throw when env is unset", async () => {
    await expect(defaultSenders.email(sampleMessage)).resolves.toBeDefined();
    await expect(defaultSenders.webpush(sampleMessage)).resolves.toBeDefined();
  });

  test("email reports a reason explaining why it skipped", async () => {
    const result = await defaultSenders.email(sampleMessage);
    expect(result.skipped).toBe(true);
    expect(typeof result.reason).toBe("string");
    expect((result.reason ?? "").length).toBeGreaterThan(0);
  });
});

describe("injected senders — no real network", () => {
  test("a mock sender receives the exact message and records the call", async () => {
    const calls: NotificationMessage[] = [];
    const mock: Sender = async (msg) => {
      calls.push(msg);
      return { sent: true };
    };
    const senders: Senders = { email: mock, webpush: mock };

    const r1 = await senders.email(sampleMessage);
    const r2 = await senders.webpush(sampleMessage);

    expect(r1.sent).toBe(true);
    expect(r2.sent).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(sampleMessage);
    expect(calls[1]).toEqual(sampleMessage);
  });

  test("a throwing sender surfaces the error to the caller (retryable upstream)", async () => {
    const boom: Sender = async () => {
      throw new Error("network down");
    };
    await expect(boom(sampleMessage)).rejects.toThrow("network down");
  });

  test("SenderResult shape is usable as a discriminated result", () => {
    const ok: SenderResult = { sent: true };
    const skip: SenderResult = { skipped: true, reason: "no key" };
    expect(ok.sent).toBe(true);
    expect(skip.skipped).toBe(true);
  });
});
