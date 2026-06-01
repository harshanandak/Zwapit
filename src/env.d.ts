/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Convex deployment URL. When unset, the app falls back to the local mock flow. */
  readonly VITE_CONVEX_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
