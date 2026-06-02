// Resilient Convex client boundary.
//
// The client is created lazily and ONLY when `PUBLIC_CONVEX_URL` (or the legacy
// `VITE_CONVEX_URL` fallback) is set. The
// `convex/browser` module is loaded via dynamic import so it is never evaluated
// during SSG/build/tests when Convex is not configured. If construction fails,
// callers receive `null` and fall back to the local mock flow.

import type { ConvexClient } from "convex/browser";
import { getClerkPublishableKey, isClerkAuthConfigured } from "../auth/authAdapter";
import { getConvexUrl } from "./env";

let clientPromise: Promise<ConvexClient | null> | null = null;
let clerkPromise: Promise<ClerkRuntime | null> | null = null;
let forceFreshTokenOnce = false;

const CLERK_SCRIPT_ID = "zwapit-clerk-js";
const CLERK_JS_URL = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js";

type ClerkRuntime = {
  load?: () => Promise<void>;
  session?: {
    getToken: (options: { template: "convex"; skipCache?: boolean }) => Promise<string | null>;
  } | null;
};

function getBrowserClerk(): ClerkRuntime | null {
  if (typeof window === "undefined") return null;
  return (window as typeof window & { Clerk?: ClerkRuntime }).Clerk ?? null;
}

function loadBrowserClerk(): Promise<ClerkRuntime | null> {
  const publishableKey = getClerkPublishableKey();
  if (!publishableKey || typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(null);
  }
  const existingClerk = getBrowserClerk();
  if (existingClerk) return Promise.resolve(existingClerk);
  if (clerkPromise) return clerkPromise;

  clerkPromise = new Promise((resolve) => {
    const existingScript = document.getElementById(CLERK_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");
    script.id = CLERK_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.clerkPublishableKey = publishableKey;
    script.src = CLERK_JS_URL;

    const finish = async () => {
      const clerk = getBrowserClerk();
      try {
        await clerk?.load?.();
      } catch {
        resolve(null);
        return;
      }
      resolve(clerk ?? null);
    };

    script.addEventListener("load", () => void finish(), { once: true });
    script.addEventListener("error", () => resolve(null), { once: true });
    if (!existingScript) document.head.append(script);
  });

  return clerkPromise;
}

function configureClientAuth(client: ConvexClient): ConvexClient {
  if (!isClerkAuthConfigured()) return client;
  client.setAuth(async () => {
    const clerk = getBrowserClerk() ?? (await loadBrowserClerk());
    const skipCache = forceFreshTokenOnce;
    forceFreshTokenOnce = false;
    return (await clerk?.session?.getToken({ template: "convex", skipCache })) ?? null;
  });
  return client;
}

export function refreshConvexAuthTokenOnNextRequest(): void {
  forceFreshTokenOnce = true;
}

export function getConvexClient(): Promise<ConvexClient | null> {
  const url = getConvexUrl();
  if (!url) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("convex/browser")
      .then(({ ConvexClient }) => configureClientAuth(new ConvexClient(url)))
      .catch(() => null);
  }
  return clientPromise;
}
