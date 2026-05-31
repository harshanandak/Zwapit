import type { AuthIdentity, MockUser, UserVerification } from "../types";

export const mockCurrentUserId = "user_demo_1";

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
