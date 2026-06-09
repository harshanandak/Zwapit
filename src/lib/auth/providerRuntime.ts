import { getClerkPublishableKey } from "./authAdapter";

export const CLERK_JS_SCRIPT_ID = "zwapit-clerk-js";
export const CLERK_JS_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@6/dist/clerk.browser.js";

type ClerkTokenTemplate = "convex";

export type ClerkRuntime = {
  load?: () => Promise<void>;
  openSignIn?: (options: { afterSignInUrl: string; afterSignUpUrl: string; redirectUrl: string }) => Promise<void>;
  openUserProfile?: () => Promise<void> | void;
  session?: {
    getToken: (options: { template: ClerkTokenTemplate; skipCache?: boolean }) => Promise<string | null>;
  } | null;
  user?: unknown;
};

let clerkPromise: Promise<ClerkRuntime | null> | null = null;

export function getBrowserClerk(): ClerkRuntime | null {
  if (typeof globalThis.window === "undefined") return null;
  return (globalThis.window as typeof globalThis.window & { Clerk?: ClerkRuntime }).Clerk ?? null;
}

export function isClerkSignedIn(): boolean {
  return getBrowserClerk()?.user != null;
}

export function loadClerkRuntime(publishableKey: string | undefined = getClerkPublishableKey()): Promise<ClerkRuntime | null> {
  if (!publishableKey || typeof globalThis.window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(null);
  }

  const existingClerk = getBrowserClerk();
  if (existingClerk) return Promise.resolve(existingClerk);
  if (clerkPromise !== null) return clerkPromise;

  clerkPromise = new Promise((resolve) => {
    const existingScript = document.getElementById(CLERK_JS_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");
    script.id = CLERK_JS_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.clerkPublishableKey = publishableKey;
    script.src = CLERK_JS_SCRIPT_URL;

    const finish = async () => {
      const clerk = getBrowserClerk();
      try {
        await clerk?.load?.();
      } catch {
        clerkPromise = null;
        script.remove();
        resolve(null);
        return;
      }
      resolve(clerk ?? null);
    };

    script.addEventListener("load", () => void finish(), { once: true });
    script.addEventListener(
      "error",
      () => {
        clerkPromise = null;
        script.remove();
        resolve(null);
      },
      { once: true },
    );
    if (!existingScript) document.head.append(script);
  });

  return clerkPromise;
}

export async function getClerkConvexToken(options: { skipCache?: boolean } = {}): Promise<string | null> {
  const clerk = getBrowserClerk() ?? (await loadClerkRuntime());
  return (await clerk?.session?.getToken({ template: "convex", skipCache: options.skipCache })) ?? null;
}

export async function openClerkSignIn(options: {
  afterSignInUrl: string;
  afterSignUpUrl: string;
  redirectUrl: string;
}): Promise<void> {
  const clerk = await loadClerkRuntime();
  await clerk?.openSignIn?.(options);
}

export async function openClerkUserProfile(): Promise<void> {
  const clerk = await loadClerkRuntime();
  await clerk?.openUserProfile?.();
}
