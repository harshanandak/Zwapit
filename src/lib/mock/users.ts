import type { AuthIdentity, MockSellerPaymentAccount, MockUser, UserVerification } from "../types";
import { mockAuthIdentity, mockCurrentUser, mockUserVerification } from "../auth/mockAuth";

export const mockUser: MockUser = mockCurrentUser;
export const mockIdentity: AuthIdentity = mockAuthIdentity;
export const mockVerification: UserVerification = mockUserVerification;

export const mockSellerPaymentAccount: MockSellerPaymentAccount = {
  sellerId: "seller_demo_1",
  status: "mock_ready",
  provider: "mock",
};
