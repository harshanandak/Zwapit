import { getClerkPublishableKey } from "./authAdapter";

export const CLERK_JS_SCRIPT_ID = "zwapit-clerk-js";
export const CLERK_JS_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@6/dist/clerk.browser.js";
export const CLERK_UI_SCRIPT_ID = "zwapit-clerk-ui";

type ClerkTokenTemplate = "convex";

export type ClerkRuntime = {
  load?: (options?: { ui?: { ClerkUI?: unknown } }) => Promise<void>;
  openSignIn?: (options: ClerkSignInOptions) => Promise<void>;
  openUserProfile?: () => Promise<void> | void;
  session?: {
    getToken: (options: { template: ClerkTokenTemplate; skipCache?: boolean }) => Promise<string | null>;
  } | null;
  user?: unknown;
};

type ClerkSignInOptions = {
  fallbackRedirectUrl: string;
  forceRedirectUrl: string;
  signUpFallbackRedirectUrl: string;
  signUpForceRedirectUrl: string;
};

type ClerkRuntimeWindow = typeof globalThis.window & {
  Clerk?: ClerkRuntime;
  __internal_ClerkUICtor?: unknown;
};

type ClerkScriptError = Error & { script?: HTMLScriptElement };

let clerkPromise: Promise<ClerkRuntime | null> | null = null;

function clearFailedClerkRuntime(script?: HTMLScriptElement): void {
  clerkPromise = null;
  script?.remove();
  if (globalThis.window !== undefined) {
    delete (globalThis.window as ClerkRuntimeWindow).Clerk;
  }
}

export function getBrowserClerk(): ClerkRuntime | null {
  if (globalThis.window === undefined) return null;
  return (globalThis.window as ClerkRuntimeWindow).Clerk ?? null;
}

export function isClerkSignedIn(): boolean {
  return getBrowserClerk()?.user != null;
}

export function getClerkUiScriptUrl(publishableKey: string): string | null {
  const encodedDomain = publishableKey.split("_")[2];
  if (!encodedDomain) return null;

  try {
    const domain = globalThis.atob(encodedDomain).slice(0, -1);
    return domain ? `https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js` : null;
  } catch {
    return null;
  }
}

function loadScript(id: string, src: string, configure?: (script: HTMLScriptElement) => void): Promise<HTMLScriptElement> {
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(id) as HTMLScriptElement | null;
    existingScript?.remove();
    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = src;
    configure?.(script);

    script.addEventListener("load", () => resolve(script), { once: true });
    script.addEventListener(
      "error",
      () => {
        const error = new Error(`Failed to load script ${id}`) as ClerkScriptError;
        error.script = script;
        reject(error);
      },
      { once: true },
    );
    document.head.append(script);
  });
}

export function loadClerkRuntime(publishableKey: string | undefined = getClerkPublishableKey()): Promise<ClerkRuntime | null> {
  if (!publishableKey || globalThis.window === undefined || globalThis.document === undefined) {
    return Promise.resolve(null);
  }

  const existingClerk = getBrowserClerk();
  if (existingClerk) return Promise.resolve(existingClerk);
  if (clerkPromise !== null) return clerkPromise;

  clerkPromise = new Promise((resolve) => {
    const uiScriptUrl = getClerkUiScriptUrl(publishableKey);
    if (!uiScriptUrl) {
      clerkPromise = null;
      resolve(null);
      return;
    }

    const finish = async (script: HTMLScriptElement) => {
      const clerk = getBrowserClerk();
      try {
        await clerk?.load?.({ ui: { ClerkUI: (globalThis.window as ClerkRuntimeWindow).__internal_ClerkUICtor } });
      } catch {
        clearFailedClerkRuntime(script);
        resolve(null);
        return;
      }

      if (clerk == null) {
        clearFailedClerkRuntime(script);
        resolve(null);
        return;
      }

      resolve(clerk);
    };

    loadScript(CLERK_UI_SCRIPT_ID, uiScriptUrl)
      .then(() =>
        loadScript(CLERK_JS_SCRIPT_ID, CLERK_JS_SCRIPT_URL, (script) => {
          script.dataset.clerkPublishableKey = publishableKey;
        }),
      )
      .then((script) => void finish(script))
      .catch((error_: ClerkScriptError) => {
        clearFailedClerkRuntime(error_.script);
        resolve(null);
      });
  });

  return clerkPromise;
}

export async function getClerkConvexToken(options: { skipCache?: boolean } = {}): Promise<string | null> {
  const clerk = getBrowserClerk() ?? (await loadClerkRuntime());
  return (await clerk?.session?.getToken({ template: "convex", skipCache: options.skipCache })) ?? null;
}

export async function openClerkSignIn(options: ClerkSignInOptions): Promise<void> {
  const clerk = await loadClerkRuntime();
  await clerk?.openSignIn?.(options);
}

export async function openClerkUserProfile(): Promise<void> {
  const clerk = await loadClerkRuntime();
  await clerk?.openUserProfile?.();
}
