// Convex configuration boundary.
//
// The app must stay bootable when Convex is NOT configured in a local shell
// (no VITE_CONVEX_URL). Every Convex code path checks `isConvexConfigured()`
// first and falls back to the existing local mock flow when it returns false.

export function getConvexUrl(): string | undefined {
  // Vite/Astro statically replaces `import.meta.env.VITE_*` on the client and at
  // build time. Fall back to `process.env` for Node/bun contexts (tests, SSR).
  let url: unknown;
  try {
    url = (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_CONVEX_URL;
  } catch {
    url = undefined;
  }
  if (typeof url !== "string" || url.length === 0) {
    if (typeof process !== "undefined" && process.env) {
      url = process.env.VITE_CONVEX_URL;
    }
  }
  return typeof url === "string" && url.length > 0 ? url : undefined;
}

export function isConvexConfigured(): boolean {
  return getConvexUrl() !== undefined;
}
