// Resilient Convex client boundary.
//
// The client is created lazily and ONLY when `PUBLIC_CONVEX_URL` (or the legacy
// `VITE_CONVEX_URL` fallback) is set. The
// `convex/browser` module is loaded via dynamic import so it is never evaluated
// during SSG/build/tests when Convex is not configured. If construction fails,
// callers receive `null` and fall back to the local mock flow.

import type { ConvexClient } from "convex/browser";
import { isClerkAuthConfigured } from "../auth/authAdapter";
import { getConvexUrl } from "./env";

let clientPromise: Promise<ConvexClient | null> | null = null;

type ClerkRuntime = {
  session?: {
    getToken: (options: { template: "convex" }) => Promise<string | null>;
  } | null;
};

function getBrowserClerk(): ClerkRuntime | null {
  if (typeof window === "undefined") return null;
  return (window as typeof window & { Clerk?: ClerkRuntime }).Clerk ?? null;
}

function configureClientAuth(client: ConvexClient): ConvexClient {
  if (!isClerkAuthConfigured()) return client;
  client.setAuth(async () => {
    const clerk = getBrowserClerk();
    return (await clerk?.session?.getToken({ template: "convex" })) ?? null;
  });
  return client;
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
