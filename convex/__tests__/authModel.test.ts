import { describe, expect, test } from "bun:test";

import {
  appUserIdFromUserDocId,
  assertActorMatchesAppUser,
  buildAuthSyncRecord,
  selectVerificationMode,
} from "../authModel";

describe("Convex auth identity model", () => {
  test("builds internal app user ids from Convex-owned ids instead of provider subjects", () => {
    const appUserId = appUserIdFromUserDocId("abc123");

    expect(appUserId).toBe("user_abc123");
    expect(appUserId).not.toBe("clerk_user_abc123");
  });

  test("keeps provider identity separate from app user data", () => {
    const record = buildAuthSyncRecord({
      appUserId: "user_internal_1",
      displayName: "Harsha Clerk",
      phoneVerified: true,
      provider: "clerk",
      providerUserId: "user_2clerkSubject",
    });

    expect(record.appUser.id).toBe("user_internal_1");
    expect(record.authIdentity.appUserId).toBe("user_internal_1");
    expect(record.authIdentity.provider).toBe("clerk");
    expect(record.authIdentity.providerUserId).toBe("user_2clerkSubject");
    expect(record.authIdentity.providerUserId).not.toBe(record.appUser.id);
    expect(record.verification.verificationMode).toBe("clerk_phone");
  });

  test("selects a shape-only phone verification mode", () => {
    expect(selectVerificationMode("clerk", true)).toBe("clerk_phone");
    expect(selectVerificationMode("clerk", false)).toBe("unverified");
    expect(selectVerificationMode("mock_phone", true)).toBe("mock");
  });

  test("rejects missing and mismatched actors before protected state changes", () => {
    expect(() => assertActorMatchesAppUser(null, "user_buyer_1", "BUYER_ACTOR_REQUIRED")).toThrow("AUTH_REQUIRED");
    expect(() => assertActorMatchesAppUser("user_seller_1", "user_buyer_1", "BUYER_ACTOR_REQUIRED")).toThrow(
      "BUYER_ACTOR_REQUIRED",
    );
    expect(assertActorMatchesAppUser("user_buyer_1", "user_buyer_1", "BUYER_ACTOR_REQUIRED")).toBe("user_buyer_1");
  });
});

