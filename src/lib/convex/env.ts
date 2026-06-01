// Convex configuration boundary.
//
// The app must stay bootable when Convex is NOT configured in a local shell
// (no VITE_CONVEX_URL). Every Convex code path checks `isConvexConfigured()`
// first and falls back to the existing local mock flow when it returns false.

export function getConvexUrl(): string | undefined {
  // Astro inlines ONLY `PUBLIC_`-prefixed vars into client-side code, so the
  // browser island reads `PUBLIC_CONVEX_URL`. `VITE_CONVEX_URL` is kept as a
  // fallback for Vite/server contexts, and `process.env` covers Node/bun
  // (tests, SSR). All three resolve to "" / undefined when not configured, in
  // which case the app uses the local mock flow.
  const fromClient = readClientEnv();
  if (fromClient) return fromClient;

  if (typeof process !== "undefined" && process.env) {
    const fromProcess = process.env.PUBLIC_CONVEX_URL ?? process.env.VITE_CONVEX_URL;
    if (typeof fromProcess === "string" && fromProcess.length > 0) return fromProcess;
  }
  return undefined;
}

function readClientEnv(): string | undefined {
  try {
    // Direct literal access so Astro/Vite statically inlines the value into the
    // client bundle. `import.meta.env` is undefined in some runtimes (e.g. bun
    // test); the try/catch makes that a clean fall-through.
    const publicUrl = import.meta.env.PUBLIC_CONVEX_URL;
    if (typeof publicUrl === "string" && publicUrl.length > 0) return publicUrl;
    const viteUrl = import.meta.env.VITE_CONVEX_URL;
    if (typeof viteUrl === "string" && viteUrl.length > 0) return viteUrl;
  } catch {
    // import.meta.env not available in this context — fall through.
  }
  return undefined;
}

export function isConvexConfigured(): boolean {
  return getConvexUrl() !== undefined;
}
