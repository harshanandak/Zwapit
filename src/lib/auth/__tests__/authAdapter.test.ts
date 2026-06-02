import { afterEach, describe, expect, test } from "bun:test";

import {
  createClerkAuthState,
  createCurrentAuthState,
  createSignedOutAuthState,
  getAuthActionState,
  getCurrentUser,
  isClerkAuthConfigured,
  requirePhoneVerified,
  requireUser,
  syncUserToConvex,
} from "../authAdapter";
import { mockCurrentUserId } from "../mockAuth";

const ORIGINAL_PUBLIC_CLERK_PUBLISHABLE_KEY = process.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
const ORIGINAL_VITE_CLERK_PUBLISHABLE_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY;

function restoreEnv(name: "PUBLIC_CLERK_PUBLISHABLE_KEY" | "VITE_CLERK_PUBLISHABLE_KEY", value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

describe("auth adapter contract", () => {
  afterEach(() => {
    restoreEnv("PUBLIC_CLERK_PUBLISHABLE_KEY", ORIGINAL_PUBLIC_CLERK_PUBLISHABLE_KEY);
    restoreEnv("VITE_CLERK_PUBLISHABLE_KEY", ORIGINAL_VITE_CLERK_PUBLISHABLE_KEY);
  });

  test("keeps the mock demo user as the default local auth state", () => {
    delete process.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.VITE_CLERK_PUBLISHABLE_KEY;

    const user = getCurrentUser();
    const sync = syncUserToConvex();

    expect(user.id).toBe(mockCurrentUserId);
    expect(sync.appUser.id).toBe(mockCurrentUserId);
    expect(sync.authIdentity.appUserId).toBe(mockCurrentUserId);
    expect(sync.authIdentity.providerUserId).not.toBe(mockCurrentUserId);
    expect(isClerkAuthConfigured()).toBe(false);
    expect(createCurrentAuthState().status).toBe("authenticated");
  });

  test("uses signed-out gates instead of mock state when Clerk auth is configured", () => {
    process.env.PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_zwapit";

    const state = createCurrentAuthState();

    expect(isClerkAuthConfigured()).toBe(true);
    expect(state.status).toBe("signed_out");
    expect(getAuthActionState("buy", "/app/checkout/listing_bms_event_1", state, { requirePhoneVerified: true })).toEqual({
      action: "buy",
      href: "/app/checkout/listing_bms_event_1",
      reason: "AUTH_REQUIRED",
      status: "sign_in_required",
    });
  });

  test("normalizes Clerk identity without exposing provider id as the app user id", () => {
    const state = createClerkAuthState({
      appUserId: "user_convex_internal_1",
      providerUserId: "user_2clerkProviderSubject",
      displayName: "Clerk Buyer",
      phoneVerified: false,
    });

    expect(state.status).toBe("authenticated");
    if (state.status !== "authenticated") throw new Error("expected authenticated state");

    expect(state.user.id).toBe("user_convex_internal_1");
    expect(state.authIdentity.provider).toBe("clerk");
    expect(state.authIdentity.providerUserId).toBe("user_2clerkProviderSubject");
    expect(state.authIdentity.providerUserId).not.toBe(state.user.id);
    expect(state.verification.phoneVerified).toBe(false);
    expect(state.verification.verificationMode).toBe("unverified");
  });

  test("requires a signed-in user for protected actions", () => {
    const signedOut = createSignedOutAuthState();

    expect(() => requireUser(signedOut)).toThrow("AUTH_REQUIRED");
    expect(() => syncUserToConvex(signedOut)).toThrow("AUTH_REQUIRED");
    expect(getAuthActionState("buy", "/app/checkout/listing_bms_event_1", signedOut)).toEqual({
      action: "buy",
      href: "/app/checkout/listing_bms_event_1",
      reason: "AUTH_REQUIRED",
      status: "sign_in_required",
    });
  });

  test("reports phone verification requirement as a shape without doing OTP or KYC", () => {
    const unverified = createClerkAuthState({
      appUserId: "user_convex_internal_2",
      providerUserId: "user_2unverified",
      displayName: "Unverified Buyer",
      phoneVerified: false,
    });

    expect(() => requirePhoneVerified(unverified)).toThrow("PHONE_VERIFICATION_REQUIRED");
    expect(getAuthActionState("buy", "/app/checkout/listing_bms_event_1", unverified, { requirePhoneVerified: true })).toEqual({
      action: "buy",
      href: "/app/checkout/listing_bms_event_1",
      reason: "PHONE_VERIFICATION_REQUIRED",
      status: "phone_verification_required",
    });
    expect(getAuthActionState("sell", "/app/sell/upload", unverified, { requirePhoneVerified: true })).toEqual({
      action: "sell",
      href: "/app/sell/upload",
      reason: "PHONE_VERIFICATION_REQUIRED",
      status: "phone_verification_required",
    });
  });
});
