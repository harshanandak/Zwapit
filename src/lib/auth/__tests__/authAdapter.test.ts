import { describe, expect, test } from "bun:test";

import {
  createClerkAuthState,
  createSignedOutAuthState,
  getAuthActionState,
  getCurrentUser,
  requirePhoneVerified,
  requireUser,
  syncUserToConvex,
} from "../authAdapter";
import { mockCurrentUserId } from "../mockAuth";

describe("auth adapter contract", () => {
  test("keeps the mock demo user as the default local auth state", () => {
    const user = getCurrentUser();
    const sync = syncUserToConvex();

    expect(user.id).toBe(mockCurrentUserId);
    expect(sync.appUser.id).toBe(mockCurrentUserId);
    expect(sync.authIdentity.appUserId).toBe(mockCurrentUserId);
    expect(sync.authIdentity.providerUserId).not.toBe(mockCurrentUserId);
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
