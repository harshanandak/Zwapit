// Resilient Convex client boundary.
//
// The client is created lazily and ONLY when `PUBLIC_CONVEX_URL` (or the legacy
// `VITE_CONVEX_URL` fallback) is set. The
// `convex/browser` module is loaded via dynamic import so it is never evaluated
// during SSG/build/tests when Convex is not configured. If construction fails,
// callers receive `null` and fall back to the local mock flow.

import type { ConvexClient } from "convex/browser";
import { isClerkAuthConfigured } from "../auth/authAdapter";
import { getClerkConvexToken } from "../auth/providerRuntime";
import { getConvexUrl } from "./env";

let clientPromise: Promise<ConvexClient | null> | null = null;
let forceFreshTokenOnce = false;

function configureClientAuth(client: ConvexClient): ConvexClient {
  if (!isClerkAuthConfigured()) return client;
  client.setAuth(async () => {
    const skipCache = forceFreshTokenOnce;
    forceFreshTokenOnce = false;
    return await getClerkConvexToken({ skipCache });
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
