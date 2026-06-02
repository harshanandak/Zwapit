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
