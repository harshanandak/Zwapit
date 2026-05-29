import type { AuthIdentity, MockUser, UserVerification } from "../types";
import { mockAuthIdentity, mockCurrentUser, mockUserVerification } from "./mockAuth";

export interface MockAuthSyncResult {
  appUser: MockUser;
  authIdentity: AuthIdentity;
  verification: UserVerification;
}

export function getCurrentUser(): MockUser {
  return mockCurrentUser;
}

export function requireUser(): MockUser {
  return getCurrentUser();
}

export function requirePhoneVerified(): MockUser {
  const user = requireUser();

  if (!user.phoneVerified) {
    throw new Error("PHONE_VERIFICATION_REQUIRED");
  }

  return user;
}

export function syncUserToConvex(): MockAuthSyncResult {
  return {
    appUser: mockCurrentUser,
    authIdentity: mockAuthIdentity,
    verification: mockUserVerification,
  };
}
