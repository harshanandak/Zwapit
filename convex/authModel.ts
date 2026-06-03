import type { AuthIdentity, MockUser, UserVerification } from "../src/lib/types";

export type AuthProvider = AuthIdentity["provider"];

export interface AuthSyncRecordInput {
  appUserId: string;
  displayName: string;
  phoneVerified: boolean;
  provider: AuthProvider;
  providerUserId: string;
}

export interface ProviderPhoneVerificationClaims {
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean | null;
}

export interface AuthSyncRecord {
  appUser: MockUser;
  authIdentity: AuthIdentity;
  verification: UserVerification;
}

// Mock-only OTP code for the provider-abstracted phone-verification path. There
// is no real SMS provider in this slice; the Clerk provider claim remains the
// live source of truth (see selectProviderPhoneVerified). This mock arm lets the
// verified-phone transition be exercised behind the identity boundary.
export const MOCK_OTP_CODE = "000000";

export type MockOtpVerificationResult =
  | { status: "verified"; verificationMode: "mock" }
  | { status: "rejected"; reason: "INVALID_OTP" };

export interface MockOtpInput {
  submittedCode: string;
  expectedCode?: string;
}

export function evaluateMockOtp(input: MockOtpInput): MockOtpVerificationResult {
  const expected = input.expectedCode ?? MOCK_OTP_CODE;
  return input.submittedCode === expected
    ? { status: "verified", verificationMode: "mock" }
    : { status: "rejected", reason: "INVALID_OTP" };
}

export function appUserIdFromUserDocId(userDocId: string): string {
  return `user_${userDocId}`;
}

export function selectVerificationMode(provider: AuthProvider, phoneVerified: boolean): UserVerification["verificationMode"] {
  if (provider === "mock_phone") return "mock";
  return phoneVerified ? "clerk_phone" : "unverified";
}

export function selectProviderPhoneVerified(claims: ProviderPhoneVerificationClaims): boolean {
  return claims.phoneNumberVerified === true;
}

export function buildAuthSyncRecord(input: AuthSyncRecordInput): AuthSyncRecord {
  return {
    appUser: {
      id: input.appUserId,
      role: "buyer_seller",
      phoneVerified: input.phoneVerified,
      displayName: input.displayName,
    },
    authIdentity: {
      appUserId: input.appUserId,
      provider: input.provider,
      providerUserId: input.providerUserId,
    },
    verification: {
      appUserId: input.appUserId,
      phoneVerified: input.phoneVerified,
      verificationMode: selectVerificationMode(input.provider, input.phoneVerified),
    },
  };
}

export function assertActorMatchesAppUser(
  appUserId: string | null | undefined,
  expectedAppUserId: string,
  mismatchError: "BUYER_ACTOR_REQUIRED" | "SELLER_ACTOR_REQUIRED",
): string {
  if (!appUserId) throw new Error("AUTH_REQUIRED");
  if (appUserId !== expectedAppUserId) throw new Error(mismatchError);
  return appUserId;
}
