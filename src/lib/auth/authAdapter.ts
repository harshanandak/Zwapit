import type { AuthIdentity, MockUser, UserVerification } from "../types";
import { mockAuthIdentity, mockCurrentUser, mockUserVerification } from "./mockAuth";

export type AuthAction = "buy" | "sell";

export type AuthState =
  | { status: "signed_out" }
  | {
      status: "authenticated";
      user: MockUser;
      authIdentity: AuthIdentity;
      verification: UserVerification;
    };

export type AuthActionState =
  | { action: AuthAction; href: string; status: "allowed" }
  | { action: AuthAction; href: string; reason: "AUTH_REQUIRED"; status: "sign_in_required" }
  | {
      action: AuthAction;
      href: string;
      reason: "PHONE_VERIFICATION_REQUIRED";
      status: "phone_verification_required";
    };

export interface AuthSyncResult {
  appUser: MockUser;
  authIdentity: AuthIdentity;
  verification: UserVerification;
}

export interface ClerkAuthStateInput {
  appUserId: string;
  providerUserId: string;
  displayName: string;
  phoneVerified: boolean;
}

export function createMockAuthState(): AuthState {
  return {
    status: "authenticated",
    user: mockCurrentUser,
    authIdentity: mockAuthIdentity,
    verification: mockUserVerification,
  };
}

export function createSignedOutAuthState(): AuthState {
  return { status: "signed_out" };
}

export function createClerkAuthState(input: ClerkAuthStateInput): AuthState {
  return {
    status: "authenticated",
    user: {
      id: input.appUserId,
      role: "buyer_seller",
      phoneVerified: input.phoneVerified,
      displayName: input.displayName,
    },
    authIdentity: {
      appUserId: input.appUserId,
      provider: "clerk",
      providerUserId: input.providerUserId,
    },
    verification: {
      appUserId: input.appUserId,
      phoneVerified: input.phoneVerified,
      verificationMode: input.phoneVerified ? "clerk_phone" : "unverified",
    },
  };
}

export function getCurrentUser(state: AuthState = createMockAuthState()): MockUser {
  return requireUser(state);
}

export function requireUser(state: AuthState = createMockAuthState()): MockUser {
  if (state.status === "signed_out") {
    throw new Error("AUTH_REQUIRED");
  }

  return state.user;
}

export function requirePhoneVerified(state: AuthState = createMockAuthState()): MockUser {
  const user = requireUser(state);

  if (!user.phoneVerified) {
    throw new Error("PHONE_VERIFICATION_REQUIRED");
  }

  return user;
}

export function syncUserToConvex(state: AuthState = createMockAuthState()): AuthSyncResult {
  if (state.status === "signed_out") {
    throw new Error("AUTH_REQUIRED");
  }

  return {
    appUser: state.user,
    authIdentity: state.authIdentity,
    verification: state.verification,
  };
}

export function getAuthActionState(
  action: AuthAction,
  href: string,
  state: AuthState = createMockAuthState(),
  options: { requirePhoneVerified?: boolean } = {},
): AuthActionState {
  if (state.status === "signed_out") {
    return { action, href, reason: "AUTH_REQUIRED", status: "sign_in_required" };
  }

  if (options.requirePhoneVerified === true && !state.user.phoneVerified) {
    return { action, href, reason: "PHONE_VERIFICATION_REQUIRED", status: "phone_verification_required" };
  }

  return { action, href, status: "allowed" };
}
