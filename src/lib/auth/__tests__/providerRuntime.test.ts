import { afterEach, describe, expect, test } from "bun:test";

import { CLERK_JS_SCRIPT_URL, getBrowserClerk, isClerkSignedIn, loadClerkRuntime } from "../providerRuntime";

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");

function restoreGlobalProperty(name: "document" | "window", descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, name);
}

type FakeScript = HTMLScriptElement & {
  emit: (type: "error" | "load") => void;
  listeners: Map<string, EventListenerOrEventListenerObject>;
  removed: boolean;
};

function createFakeScript(): FakeScript {
  const listeners = new Map<string, EventListenerOrEventListenerObject>();
  return {
    dataset: {},
    removed: false,
    emit(type: "error" | "load") {
      const listener = listeners.get(type);
      if (typeof listener === "function") {
        listener(new Event(type));
        return;
      }
      listener?.handleEvent(new Event(type));
    },
    listeners,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      listeners.set(type, listener);
    },
    remove: function (this: FakeScript) {
      this.removed = true;
    },
  } as unknown as FakeScript;
}

describe("Clerk runtime wrapper", () => {
  afterEach(() => {
    restoreGlobalProperty("window", originalWindowDescriptor);
    restoreGlobalProperty("document", originalDocumentDescriptor);
  });

  test("pins ClerkJS instead of loading the drifting latest build", () => {
    expect(CLERK_JS_SCRIPT_URL).toContain("@clerk/clerk-js@6/");
    expect(CLERK_JS_SCRIPT_URL).not.toContain("@latest");
  });

  test("returns null outside the browser/runtime boundary", async () => {
    expect(getBrowserClerk()).toBeNull();
    expect(await loadClerkRuntime()).toBeNull();
  });

  test("reports signed-in state through the provider wrapper boundary", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { Clerk: { user: { id: "user_clerk_1" } } },
    });

    expect(isClerkSignedIn()).toBe(true);
  });

  test("retries Clerk loading after a script error", async () => {
    const scripts: FakeScript[] = [];
    let currentScript: FakeScript | null = null;
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        createElement: () => {
          const script = createFakeScript();
          scripts.push(script);
          currentScript = script;
          return script;
        },
        getElementById: () => (currentScript?.removed ? null : currentScript),
        head: { append: () => undefined },
      },
    });

    const firstLoad = loadClerkRuntime("pk_test_retry");
    scripts[0]?.emit("error");
    expect(await firstLoad).toBeNull();
    expect(scripts[0]?.removed).toBe(true);

    const secondLoad = loadClerkRuntime("pk_test_retry");
    expect(scripts).toHaveLength(2);
    scripts[1]?.emit("error");
    expect(await secondLoad).toBeNull();
  });
});
