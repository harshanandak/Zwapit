import type { AuthIdentity, MockUser, UserVerification } from "../types";
import { MOCK_OTP_CODE, mockAuthIdentity, mockCurrentUser, mockUserVerification } from "./mockAuth";

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

function readPublicEnv(name: "PUBLIC_CLERK_PUBLISHABLE_KEY" | "VITE_CLERK_PUBLISHABLE_KEY"): string | undefined {
  try {
    const value = import.meta.env[name];
    if (typeof value === "string" && value.length > 0) return value;
  } catch {
    // import.meta.env is not available in bun tests and some server contexts.
  }

  if (typeof process !== "undefined" && process.env) {
    const value = process.env[name];
    if (typeof value === "string" && value.length > 0) return value;
  }

  return undefined;
}

export function getClerkPublishableKey(): string | undefined {
  return readPublicEnv("PUBLIC_CLERK_PUBLISHABLE_KEY") ?? readPublicEnv("VITE_CLERK_PUBLISHABLE_KEY");
}

export function isClerkAuthConfigured(): boolean {
  return getClerkPublishableKey() !== undefined;
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

export function createCurrentAuthState(): AuthState {
  if (isClerkAuthConfigured()) return createSignedOutAuthState();
  return createMockAuthState();
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

// Provider-abstracted / mocked OTP result shape. Real SMS, Razorpay, KYC, payout,
// and admin behavior are explicitly out of scope: a verified result only means an
// app user's phone-verified state may flip to true through this mocked boundary.
export type MockOtpVerificationResult =
  | { status: "verified"; verificationMode: "mock" }
  | { status: "rejected"; reason: "INVALID_OTP" };

// Pure mock OTP check. Accepts only the mock code; never contacts a provider.
export function evaluateMockOtp(submittedCode: string, expectedCode: string = MOCK_OTP_CODE): MockOtpVerificationResult {
  return submittedCode === expectedCode
    ? { status: "verified", verificationMode: "mock" }
    : { status: "rejected", reason: "INVALID_OTP" };
}

// Verified-phone state transition. A signed-in but phone-unverified user becomes
// phone-verified when the mock OTP is accepted; on rejection the state is
// returned unchanged so the action stays gated. Signed-out users are rejected
// before any verification, matching the action-gate contract.
export function verifyPhoneWithMockOtp(
  state: AuthState,
  submittedCode: string,
  expectedCode: string = MOCK_OTP_CODE,
): { state: AuthState; result: MockOtpVerificationResult } {
  requireUser(state);
  const result = evaluateMockOtp(submittedCode, expectedCode);
  if (result.status !== "verified" || state.status !== "authenticated") {
    return { state, result };
  }

  const verifiedState: AuthState = {
    status: "authenticated",
    user: { ...state.user, phoneVerified: true },
    authIdentity: state.authIdentity,
    verification: { ...state.verification, phoneVerified: true, verificationMode: "mock" },
  };
  return { state: verifiedState, result };
}
