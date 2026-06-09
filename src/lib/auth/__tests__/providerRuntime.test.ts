import { afterEach, describe, expect, test } from "bun:test";

import {
  CLERK_JS_SCRIPT_ID,
  CLERK_JS_SCRIPT_URL,
  CLERK_UI_SCRIPT_ID,
  getBrowserClerk,
  getClerkUiScriptUrl,
  isClerkSignedIn,
  loadClerkRuntime,
} from "../providerRuntime";

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

const TEST_PUBLISHABLE_KEY = "pk_test_Y2xlcmsuZXhhbXBsZSQ=";

function installFakeBrowser(browserWindow: Record<string, unknown> = {}): {
  scriptById: Map<string, FakeScript>;
  scripts: FakeScript[];
  window: Record<string, unknown>;
} {
  const scripts: FakeScript[] = [];
  const scriptById = new Map<string, FakeScript>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: browserWindow });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => {
        const script = createFakeScript();
        scripts.push(script);
        return script;
      },
      getElementById: (id: string) => {
        const script = scriptById.get(id);
        return script?.removed ? null : script;
      },
      head: {
        append: (script: FakeScript) => {
          scriptById.set(script.id, script);
        },
      },
    },
  });

  return { scriptById, scripts, window: browserWindow };
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

  test("derives the Clerk UI bundle URL from the publishable key", () => {
    expect(getClerkUiScriptUrl(TEST_PUBLISHABLE_KEY)).toBe("https://clerk.example/npm/@clerk/ui@1/dist/ui.browser.js");
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
    const { scriptById, scripts } = installFakeBrowser();

    const firstLoad = loadClerkRuntime(TEST_PUBLISHABLE_KEY);
    scripts[0]?.emit("load");
    await Promise.resolve();
    expect(scripts[0]?.id).toBe(CLERK_UI_SCRIPT_ID);
    expect(scripts[1]?.id).toBe(CLERK_JS_SCRIPT_ID);
    scripts[1]?.emit("error");
    expect(await firstLoad).toBeNull();
    expect(scripts[1]?.removed).toBe(true);

    const secondLoad = loadClerkRuntime(TEST_PUBLISHABLE_KEY);
    expect(scripts[0]?.removed).toBe(true);
    scripts[2]?.emit("load");
    await Promise.resolve();
    expect(scriptById.get(CLERK_UI_SCRIPT_ID)).toBe(scripts[2]);
    expect(scripts).toHaveLength(4);
    scripts[3]?.emit("error");
    expect(await secondLoad).toBeNull();
  });

  test("clears failed Clerk runtime when Clerk load rejects", async () => {
    const { scripts, window: browserWindow } = installFakeBrowser({ __internal_ClerkUICtor: {} });

    const firstLoad = loadClerkRuntime(TEST_PUBLISHABLE_KEY);
    scripts[0]?.emit("load");
    await Promise.resolve();
    Object.assign(browserWindow, {
      Clerk: {
        load: async () => {
          throw new Error("load failed");
        },
      },
    });
    scripts[1]?.emit("load");

    expect(await firstLoad).toBeNull();
    expect(getBrowserClerk()).toBeNull();
    expect(scripts[1]?.removed).toBe(true);

    const secondLoad = loadClerkRuntime(TEST_PUBLISHABLE_KEY);
    scripts[2]?.emit("load");
    await Promise.resolve();
    expect(scripts).toHaveLength(4);
    scripts[3]?.emit("error");
    expect(await secondLoad).toBeNull();
  });
});
