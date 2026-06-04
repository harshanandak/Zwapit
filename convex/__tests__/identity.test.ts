import { describe, expect, test } from "bun:test";

import {
  getCurrentAppUser,
  getPhoneVerificationRequirement,
  requirePhoneVerifiedForAction,
  syncAppUserFromProvider,
  verifyPhoneWithMockOtp,
} from "../identity";
import { MOCK_OTP_CODE } from "../authModel";

type TestRow = Record<string, unknown> & { _id: string };
type TestTables = Record<"users" | "auth_identities" | "user_verifications", TestRow[]>;

type ConvexFunctionForTest = {
  _handler: (ctx: unknown, args?: Record<string, unknown>) => Promise<unknown>;
};

function handlerOf(fn: unknown): ConvexFunctionForTest["_handler"] {
  return (fn as ConvexFunctionForTest)._handler;
}

function createEqBuilder(filters: Array<{ field: string; value: unknown }>) {
  const builder = {
    eq(field: string, value: unknown) {
      filters.push({ field, value });
      return builder;
    },
  };
  return builder;
}

function createMockIdentityCtx(
  identity: { subject: string; name?: string; phoneNumber?: string; phoneNumberVerified?: boolean } | null,
  seed: Partial<TestTables> = {},
) {
  const tables: TestTables = {
    users: [...(seed.users ?? [])],
    auth_identities: [...(seed.auth_identities ?? [])],
    user_verifications: [...(seed.user_verifications ?? [])],
  };
  let idSeq = 1;

  const ctx = {
    auth: {
      getUserIdentity: async () => identity,
    },
    db: {
      query(table: keyof TestTables) {
        const rows = tables[table];
        return {
          withIndex(_indexName: string, apply: (q: ReturnType<typeof createEqBuilder>) => unknown) {
            const filters: Array<{ field: string; value: unknown }> = [];
            apply(createEqBuilder(filters));
            const filtered = rows.filter((row) => filters.every(({ field, value }) => row[field] === value));
            return {
              unique: async () => filtered[0] ?? null,
            };
          },
        };
      },
      insert: async (table: keyof TestTables, doc: Record<string, unknown>) => {
        const _id = `${table}_${idSeq++}`;
        tables[table].push({ _id, ...doc });
        return _id;
      },
      patch: async (_id: string, patch: Record<string, unknown>) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === _id);
          if (row) Object.assign(row, patch);
        }
      },
    },
  };

  return { ctx, tables };
}

async function expectRejectsWithMessage(run: () => Promise<unknown>, message: string) {
  try {
    await run();
    throw new Error("EXPECTED_REJECTION");
  } catch (error) {
    expect((error as Error).message).toBe(message);
  }
}

describe("Convex identity endpoints", () => {
  test("enforces auth gates for unauthenticated requests", async () => {
    const { ctx } = createMockIdentityCtx(null);

    await expectRejectsWithMessage(() => handlerOf(syncAppUserFromProvider)(ctx), "AUTH_REQUIRED");
    expect(await handlerOf(getCurrentAppUser)(ctx)).toBeNull();
    await expectRejectsWithMessage(() => handlerOf(getPhoneVerificationRequirement)(ctx), "AUTH_REQUIRED");
    await expectRejectsWithMessage(
      () => handlerOf(requirePhoneVerifiedForAction)(ctx, { action: "buy" }),
      "AUTH_REQUIRED",
    );
    await expectRejectsWithMessage(
      () => handlerOf(verifyPhoneWithMockOtp)(ctx, { submittedCode: MOCK_OTP_CODE }),
      "AUTH_REQUIRED",
    );
  });

  test("mocked OTP verification flips the app user and verification records to verified", async () => {
    const { ctx, tables } = createMockIdentityCtx(
      { subject: "clerk_unverified_2" },
      {
        users: [
          {
            _id: "users_1",
            appUserId: "user_internal_2",
            displayName: "Unverified Buyer",
            phoneVerified: false,
            role: "buyer_seller",
          },
        ],
        auth_identities: [
          {
            _id: "auth_identities_1",
            appUserId: "user_internal_2",
            provider: "clerk",
            providerUserId: "clerk_unverified_2",
          },
        ],
        user_verifications: [
          {
            _id: "user_verifications_1",
            appUserId: "user_internal_2",
            phoneVerified: false,
            verificationMode: "unverified",
          },
        ],
      },
    );

    expect(await handlerOf(verifyPhoneWithMockOtp)(ctx, { submittedCode: MOCK_OTP_CODE })).toEqual({
      appUserId: "user_internal_2",
      phoneVerified: true,
      status: "verified",
      verificationMode: "mock",
    });
    expect(tables.users[0].phoneVerified).toBe(true);
    expect(tables.user_verifications[0].phoneVerified).toBe(true);
    expect(tables.user_verifications[0].verificationMode).toBe("mock");
    // Provider identity stays separate from the internal app user id.
    expect(tables.auth_identities[0].providerUserId).toBe("clerk_unverified_2");
    expect(tables.auth_identities[0].appUserId).not.toBe("clerk_unverified_2");
    // The verified app user can now pass the protected action gate.
    expect(await handlerOf(requirePhoneVerifiedForAction)(ctx, { action: "buy" })).toEqual({
      action: "buy",
      appUserId: "user_internal_2",
      status: "verified",
    });
    const synced = (await handlerOf(syncAppUserFromProvider)(ctx, {})) as {
      appUser: { phoneVerified: boolean };
      verification: { verificationMode: string };
    };
    expect(synced.appUser.phoneVerified).toBe(true);
    expect(synced.verification.verificationMode).toBe("mock");
    expect(tables.users[0].phoneVerified).toBe(true);
    expect(tables.user_verifications[0].phoneVerified).toBe(true);
    expect(tables.user_verifications[0].verificationMode).toBe("mock");
  });

  test("a wrong mocked OTP leaves the user unverified and still gated", async () => {
    const { ctx, tables } = createMockIdentityCtx(
      { subject: "clerk_unverified_3" },
      {
        users: [
          {
            _id: "users_1",
            appUserId: "user_internal_3",
            displayName: "Unverified Buyer",
            phoneVerified: false,
            role: "buyer_seller",
          },
        ],
        auth_identities: [
          {
            _id: "auth_identities_1",
            appUserId: "user_internal_3",
            provider: "clerk",
            providerUserId: "clerk_unverified_3",
          },
        ],
      },
    );

    expect(await handlerOf(verifyPhoneWithMockOtp)(ctx, { submittedCode: "111222" })).toEqual({
      appUserId: "user_internal_3",
      phoneVerified: false,
      status: "rejected",
      verificationMode: "unverified",
    });
    const forgedOtpArgs = { submittedCode: "111222", expectedCode: "111222" };
    expect(await handlerOf(verifyPhoneWithMockOtp)(ctx, forgedOtpArgs)).toEqual({
      appUserId: "user_internal_3",
      phoneVerified: false,
      status: "rejected",
      verificationMode: "unverified",
    });
    expect(tables.users[0].phoneVerified).toBe(false);
    await expectRejectsWithMessage(
      () => handlerOf(requirePhoneVerifiedForAction)(ctx, { action: "sell" }),
      "PHONE_VERIFICATION_REQUIRED",
    );
  });

  test("mock OTP preserves an existing Clerk phone verification mode", async () => {
    const { ctx, tables } = createMockIdentityCtx(
      { subject: "clerk_verified_phone" },
      {
        users: [
          {
            _id: "users_1",
            appUserId: "user_internal_4",
            displayName: "Verified Buyer",
            phoneVerified: true,
            role: "buyer_seller",
          },
        ],
        auth_identities: [
          {
            _id: "auth_identities_1",
            appUserId: "user_internal_4",
            provider: "clerk",
            providerUserId: "clerk_verified_phone",
          },
        ],
        user_verifications: [
          {
            _id: "user_verifications_1",
            appUserId: "user_internal_4",
            phoneVerified: true,
            verificationMode: "clerk_phone",
          },
        ],
      },
    );

    expect(await handlerOf(verifyPhoneWithMockOtp)(ctx, { submittedCode: "111222" })).toEqual({
      appUserId: "user_internal_4",
      phoneVerified: true,
      status: "rejected",
      verificationMode: "clerk_phone",
    });
    expect(tables.user_verifications[0].verificationMode).toBe("clerk_phone");

    expect(await handlerOf(verifyPhoneWithMockOtp)(ctx, { submittedCode: MOCK_OTP_CODE })).toEqual({
      appUserId: "user_internal_4",
      phoneVerified: true,
      status: "verified",
      verificationMode: "clerk_phone",
    });
    expect(tables.user_verifications[0].verificationMode).toBe("clerk_phone");
  });

  test("syncs provider identity to an internal app user and resolves current user", async () => {
    const { ctx, tables } = createMockIdentityCtx({
      subject: "clerk_user_1",
      name: "Clerk Buyer",
      phoneNumber: "+919999999999",
      phoneNumberVerified: true,
    });

    const synced = await handlerOf(syncAppUserFromProvider)(ctx);
    expect(synced).toEqual({
      appUser: {
        displayName: "Clerk Buyer",
        id: "user_users_1",
        phoneVerified: true,
        role: "buyer_seller",
      },
      authIdentity: {
        appUserId: "user_users_1",
        provider: "clerk",
        providerUserId: "clerk_user_1",
      },
      verification: {
        appUserId: "user_users_1",
        phoneVerified: true,
        verificationMode: "clerk_phone",
      },
    });
    expect(tables.auth_identities[0].providerUserId).toBe("clerk_user_1");
    expect(tables.auth_identities[0].appUserId).not.toBe("clerk_user_1");
    expect(await handlerOf(getCurrentAppUser)(ctx)).toEqual({
      displayName: "Clerk Buyer",
      id: "user_users_1",
      phoneVerified: true,
      role: "buyer_seller",
    });
    expect(await handlerOf(getPhoneVerificationRequirement)(ctx)).toEqual({
      appUserId: "user_users_1",
      phoneVerified: true,
      requiredFor: ["buy", "sell"],
      status: "verified",
    });
    expect(await handlerOf(requirePhoneVerifiedForAction)(ctx, { action: "buy" })).toEqual({
      action: "buy",
      appUserId: "user_users_1",
      status: "verified",
    });
  });

  test("sync clears stale Clerk phone verification when the provider claim is no longer verified", async () => {
    const { ctx, tables } = createMockIdentityCtx(
      { subject: "clerk_stale_phone", phoneNumberVerified: false },
      {
        users: [
          {
            _id: "users_1",
            appUserId: "user_internal_stale",
            displayName: "Stale Clerk Buyer",
            phoneVerified: true,
            role: "buyer_seller",
          },
        ],
        auth_identities: [
          {
            _id: "auth_identities_1",
            appUserId: "user_internal_stale",
            provider: "clerk",
            providerUserId: "clerk_stale_phone",
          },
        ],
        user_verifications: [
          {
            _id: "user_verifications_1",
            appUserId: "user_internal_stale",
            phoneVerified: true,
            verificationMode: "clerk_phone",
          },
        ],
      },
    );

    const synced = await handlerOf(syncAppUserFromProvider)(ctx);

    expect(synced).toEqual({
      appUser: {
        displayName: "Zwapit user",
        id: "user_internal_stale",
        phoneVerified: false,
        role: "buyer_seller",
      },
      authIdentity: {
        appUserId: "user_internal_stale",
        provider: "clerk",
        providerUserId: "clerk_stale_phone",
      },
      verification: {
        appUserId: "user_internal_stale",
        phoneVerified: false,
        verificationMode: "unverified",
      },
    });
    expect(tables.users[0].phoneVerified).toBe(false);
    expect(tables.user_verifications[0].phoneVerified).toBe(false);
    expect(tables.user_verifications[0].verificationMode).toBe("unverified");
  });

  test("reports phone requirement and enforces verified phone actions", async () => {
    const { ctx } = createMockIdentityCtx(
      { subject: "clerk_unverified_1" },
      {
        users: [
          {
            _id: "users_1",
            appUserId: "user_internal_1",
            displayName: "Unverified Buyer",
            phoneVerified: false,
            role: "buyer_seller",
          },
        ],
        auth_identities: [
          {
            _id: "auth_identities_1",
            appUserId: "user_internal_1",
            provider: "clerk",
            providerUserId: "clerk_unverified_1",
          },
        ],
      },
    );

    expect(await handlerOf(getPhoneVerificationRequirement)(ctx)).toEqual({
      appUserId: "user_internal_1",
      phoneVerified: false,
      requiredFor: ["buy", "sell"],
      status: "required",
    });
    await expectRejectsWithMessage(
      () => handlerOf(requirePhoneVerifiedForAction)(ctx, { action: "sell" }),
      "PHONE_VERIFICATION_REQUIRED",
    );
  });
});
