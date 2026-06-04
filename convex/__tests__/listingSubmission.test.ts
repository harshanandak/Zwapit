import { describe, expect, test } from "bun:test";

import { bookmyshowEventRule } from "../../src/lib/rules/sourceRules";
import { submitSellerListingForCurrentUser } from "../listings";

type TestRow = Record<string, unknown> & { _id: string };
type TestTables = Record<"users" | "auth_identities" | "user_verifications" | "source_rules" | "listings", TestRow[]>;

type ConvexFunctionForTest = {
  _handler: (ctx: unknown, args?: Record<string, unknown>) => Promise<unknown>;
};

const VERIFIED_PROVIDER_ID = "clerk_verified_seller_1";
const VERIFIED_APP_USER_ID = "user_internal_seller_1";

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

function sourceRuleRow(rule = bookmyshowEventRule): TestRow {
  return {
    _id: `source_rules_${rule.id}`,
    sourceRuleKey: rule.id,
    version: rule.version,
    source: rule.source,
    category: rule.category,
    sourceCategoryKey: rule.sourceCategoryKey,
    decision: rule.decision,
    internalStatus: rule.internalStatus,
    transferMode: rule.transferMode,
    transferability: rule.transferability,
    protectionLevel: rule.protectionLevel,
    requiredFields: rule.requiredFields,
    eligibilityFields: rule.eligibilityFields,
    priceRule: rule.priceRule,
    payoutPolicy: rule.payoutPolicy,
    blockedBehavior: rule.blockedBehavior,
    manualReviewReasonCodes: rule.manualReviewReasonCodes,
    effectiveFrom: rule.effectiveFrom,
    lastVerifiedAt: rule.lastVerifiedAt,
    verificationSourceUrlOrNote: rule.verificationSourceUrlOrNote,
    createdBy: rule.createdBy,
  };
}

function verifiedSellerRows(options: { phoneVerified: boolean }): Pick<
  TestTables,
  "users" | "auth_identities" | "user_verifications"
> {
  return {
    users: [
      {
        _id: "users_verified_seller_1",
        appUserId: VERIFIED_APP_USER_ID,
        displayName: "Verified Seller",
        phoneVerified: options.phoneVerified,
        role: "buyer_seller",
      },
    ],
    auth_identities: [
      {
        _id: "auth_identities_verified_seller_1",
        appUserId: VERIFIED_APP_USER_ID,
        provider: "clerk",
        providerUserId: VERIFIED_PROVIDER_ID,
      },
    ],
    user_verifications: [
      {
        _id: "user_verifications_verified_seller_1",
        appUserId: VERIFIED_APP_USER_ID,
        phoneVerified: options.phoneVerified,
        verificationMode: options.phoneVerified ? "clerk_phone" : "unverified",
      },
    ],
  };
}

function createMockListingCtx(
  identity: { subject: string } | null,
  seed: Partial<TestTables> = {},
) {
  const tables: TestTables = {
    users: [...(seed.users ?? [])],
    auth_identities: [...(seed.auth_identities ?? [])],
    user_verifications: [...(seed.user_verifications ?? [])],
    source_rules: [...(seed.source_rules ?? [])],
    listings: [...(seed.listings ?? [])],
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
              collect: async () => filtered,
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

function firstSliceDraft(overrides: Record<string, unknown> = {}) {
  return {
    source: "bookmyshow",
    category: "event_ticket",
    title: "Arijit Singh Live - Silver Pass",
    venueOrRoute: "Bengaluru Palace Grounds",
    eventOrTripStartAt: "2026-12-20T19:00:00+05:30",
    quantity: 1,
    faceValue: 2400,
    listingPrice: 2400,
    transferDeadlineAt: "2026-12-19T19:00:00+05:30",
    protectionDeadlineAt: "2026-12-21T19:00:00+05:30",
    sellerPromiseAccepted: true,
    duplicateFingerprint: "seller-upload:arijit-singh-silver-pass",
    ...overrides,
  };
}

async function expectRejectsWithMessage(run: () => Promise<unknown>, message: string) {
  try {
    await run();
    throw new Error("EXPECTED_REJECTION");
  } catch (error) {
    expect((error as Error).message).toBe(message);
  }
}

describe("seller listing submission mutation", () => {
  test("rejects signed-out sellers before creating a listing", async () => {
    const { ctx, tables } = createMockListingCtx(null, {
      source_rules: [sourceRuleRow()],
    });

    await expectRejectsWithMessage(
      () => handlerOf(submitSellerListingForCurrentUser)(ctx, { draft: firstSliceDraft() }),
      "AUTH_REQUIRED",
    );
    expect(tables.listings).toHaveLength(0);
  });

  test("rejects phone-unverified sellers before creating a listing", async () => {
    const { ctx, tables } = createMockListingCtx(
      { subject: VERIFIED_PROVIDER_ID },
      {
        ...verifiedSellerRows({ phoneVerified: false }),
        source_rules: [sourceRuleRow()],
      },
    );

    await expectRejectsWithMessage(
      () => handlerOf(submitSellerListingForCurrentUser)(ctx, { draft: firstSliceDraft() }),
      "PHONE_VERIFICATION_REQUIRED",
    );
    expect(tables.listings).toHaveLength(0);
  });

  test("creates a listing owned by the internal app user id, never the provider id", async () => {
    const { ctx, tables } = createMockListingCtx(
      { subject: VERIFIED_PROVIDER_ID },
      {
        ...verifiedSellerRows({ phoneVerified: true }),
        source_rules: [sourceRuleRow()],
      },
    );

    const result = (await handlerOf(submitSellerListingForCurrentUser)(ctx, {
      draft: firstSliceDraft(),
    })) as { listing: { sellerId: string; state: string; ruleDecision: string } };

    expect(result.listing.sellerId).toBe(VERIFIED_APP_USER_ID);
    expect(result.listing.sellerId).not.toBe(VERIFIED_PROVIDER_ID);
    expect(result.listing.state).toBe("live");
    expect(result.listing.ruleDecision).toBe("AUTO_APPROVE");
    expect(tables.listings).toHaveLength(1);
    expect(tables.listings[0].sellerId).toBe(VERIFIED_APP_USER_ID);
    expect(tables.listings[0].sellerId).not.toBe(VERIFIED_PROVIDER_ID);
  });
});
