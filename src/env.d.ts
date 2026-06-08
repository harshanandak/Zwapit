/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * Convex deployment URL exposed to client-side code. Astro inlines only
   * `PUBLIC_`-prefixed vars into the browser bundle, so this is the variable the
   * timeline island reads. When unset, the app falls back to the local mock flow.
   */
  readonly PUBLIC_CONVEX_URL?: string;
  /** Fallback Convex URL for Vite/server contexts. Prefer `PUBLIC_CONVEX_URL`. */
  readonly VITE_CONVEX_URL?: string;
  /**
   * Clerk publishable key exposed to client-side auth code. When unset, Zwapit
   * stays in the local no-Clerk demo flow.
   */
  readonly PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  /** Fallback Clerk key for Vite/server contexts. Prefer `PUBLIC_CLERK_PUBLISHABLE_KEY`. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
