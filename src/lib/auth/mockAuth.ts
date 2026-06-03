import type { AuthIdentity, MockUser, UserVerification } from "../types";

export const mockCurrentUserId = "user_demo_1";

// Mock-only OTP code for the provider-abstracted phone-verification path. There
// is no real SMS provider in this slice; this constant stands in for the code a
// real provider would deliver, so the verified-phone transition can be exercised
// locally and in tests without sending anything.
// Keep in sync with MOCK_OTP_CODE in convex/authModel.ts; the duplicate
// constant preserves the client/Convex boundary.
export const MOCK_OTP_CODE = "000000";

export const mockCurrentUser: MockUser = {
  id: mockCurrentUserId,
  role: "buyer_seller",
  phoneVerified: true,
  displayName: "Harsha Demo",
};

export const mockAuthIdentity: AuthIdentity = {
  appUserId: mockCurrentUserId,
  provider: "mock_phone",
  providerUserId: "mock_phone_user_demo_1",
};

export const mockUserVerification: UserVerification = {
  appUserId: mockCurrentUserId,
  phoneVerified: true,
  verificationMode: "mock",
};
