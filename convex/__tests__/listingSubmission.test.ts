import { describe, expect, test } from "bun:test";

import {
  blockedWatcherRule,
  bookmyshowEventRule,
  districtMovieWaitlistRule,
  otherPlatformEventReviewRule,
} from "../../src/lib/rules/sourceRules";
import type { SourceRule } from "../../src/lib/types";
import { submitSellerListingForCurrentUser } from "../listings";

type TestRow = Record<string, unknown> & { _id: string };
type TestTableName =
  | "users"
  | "auth_identities"
  | "user_verifications"
  | "seller_payment_accounts"
  | "source_rules"
  | "listings";
type TestTables = Record<TestTableName, TestRow[]>;

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

function rowMatchesFilters(row: TestRow, filters: Array<{ field: string; value: unknown }>): boolean {
  return filters.every(({ field, value }) => row[field] === value);
}

function applyIndexFilters(rows: TestRow[], apply: (q: ReturnType<typeof createEqBuilder>) => unknown): TestRow[] {
  const filters: Array<{ field: string; value: unknown }> = [];
  apply(createEqBuilder(filters));
  return rows.filter((row) => rowMatchesFilters(row, filters));
}

function indexedRowsResult(rows: TestRow[], apply: (q: ReturnType<typeof createEqBuilder>) => unknown) {
  const filtered = applyIndexFilters(rows, apply);
  return {
    unique: async () => {
      if (filtered.length > 1) throw new Error("MOCK_UNIQUE_VIOLATION");
      return filtered[0] ?? null;
    },
    collect: async () => filtered,
  };
}

function patchTableRow(tables: TestTables, _id: string, patch: Record<string, unknown>): void {
  for (const rows of Object.values(tables)) {
    const row = rows.find((candidate) => candidate._id === _id);
    if (row) Object.assign(row, patch);
  }
}

function createMockDb(tables: TestTables, nextId: (table: keyof TestTables) => string) {
  return {
    query: (table: keyof TestTables) => ({
      withIndex: (_indexName: string, apply: (q: ReturnType<typeof createEqBuilder>) => unknown) =>
        indexedRowsResult(tables[table], apply),
    }),
    insert: async (table: keyof TestTables, doc: Record<string, unknown>) => {
      const _id = nextId(table);
      tables[table].push({ _id, ...doc });
      return _id;
    },
    patch: async (_id: string, patch: Record<string, unknown>) => patchTableRow(tables, _id, patch),
  };
}

function sourceRuleRow(rule = bookmyshowEventRule): TestRow {
  return {
    _id: `source_rules_${rule.id}`,
    sourceRuleKey: rule.id,
    ...rule,
  };
}

function verifiedSellerRows(options: { phoneVerified: boolean; payoutReady?: boolean }): Pick<
  TestTables,
  "users" | "auth_identities" | "user_verifications" | "seller_payment_accounts"
> {
  const sellerPaymentAccounts =
    options.payoutReady === false
      ? []
      : [
          {
            _id: "seller_payment_accounts_verified_seller_1",
            sellerId: VERIFIED_APP_USER_ID,
            status: "mock_ready",
            provider: "mock",
          },
        ];

  return {
    users: [
      {
        _id: "users_verified_seller_1",
        appUserId: VERIFIED_APP_USER_ID,
        phoneVerified: options.phoneVerified,
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
      },
    ],
    seller_payment_accounts: sellerPaymentAccounts,
  };
}

function createMockListingCtx(
  identity: { subject: string } | null,
  seed: Partial<TestTables> = {},
) {
  const tableNames: TestTableName[] = [
    "users",
    "auth_identities",
    "user_verifications",
    "seller_payment_accounts",
    "source_rules",
    "listings",
  ];
  const tables = Object.fromEntries(tableNames.map((table) => [table, [...(seed[table] ?? [])]])) as TestTables;
  let idSeq = 1;

  const ctx = {
    auth: {
      getUserIdentity: async () => identity,
    },
    db: createMockDb(tables, (table) => `${table}_${idSeq++}`),
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

function existingFirstSliceListingRow(overrides: Record<string, unknown> = {}): TestRow {
  return {
    _id: "listings_existing_1",
    listingKey: "listing_user_internal_seller_1_seller_upload_arijit_singh_silver_pass",
    sellerId: VERIFIED_APP_USER_ID,
    sourceRuleId: bookmyshowEventRule.id,
    sourceRuleVersion: bookmyshowEventRule.version,
    category: "event_ticket",
    source: "bookmyshow",
    sourceCategoryKey: bookmyshowEventRule.sourceCategoryKey,
    title: "Arijit Singh Live - Silver Pass",
    venueOrRoute: "Bengaluru Palace Grounds",
    eventOrTripStartAt: "2026-12-20T19:00:00+05:30",
    quantity: 1,
    faceValue: 2400,
    listingPrice: 2200,
    platformFee: 10,
    gstOnFee: 1.8,
    totalPayable: 2211.8,
    transferMode: bookmyshowEventRule.transferMode,
    transferDeadlineAt: "2026-12-19T19:00:00+05:30",
    protectionDeadlineAt: "2026-12-21T19:00:00+05:30",
    state: "live",
    ruleDecision: "AUTO_APPROVE",
    duplicateFingerprint: "seller_upload_arijit_singh_silver_pass",
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

function createVerifiedListingCtx(seed: Partial<TestTables> = {}) {
  return createMockListingCtx(
    { subject: VERIFIED_PROVIDER_ID },
    {
      ...verifiedSellerRows({ phoneVerified: true }),
      source_rules: [sourceRuleRow()],
      ...seed,
    },
  );
}

function expectUnderReviewCreated(
  result: { listing: { state: string; ruleDecision: string }; status: string },
  tables: TestTables,
) {
  expect(result.status).toBe("created");
  expect(result.listing.state).toBe("under_review");
  expect(result.listing.ruleDecision).toBe("NEEDS_MANUAL_REVIEW");
  expect(tables.listings[0].state).toBe("under_review");
  expect(tables.listings[0].ruleDecision).toBe("NEEDS_MANUAL_REVIEW");
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

  test("it should keep an auto-approved listing under review when the seller has no mock payout readiness", async () => {
    const { ctx, tables } = createVerifiedListingCtx({
      ...verifiedSellerRows({ phoneVerified: true, payoutReady: false }),
    });

    const result = (await handlerOf(submitSellerListingForCurrentUser)(ctx, {
      draft: firstSliceDraft(),
    })) as { listing: { state: string; ruleDecision: string }; status: string };

    expectUnderReviewCreated(result, tables);
  });

  test("it should reject fractional quantities before persisting a seller listing", async () => {
    const { ctx, tables } = createVerifiedListingCtx();

    await expectRejectsWithMessage(
      () => handlerOf(submitSellerListingForCurrentUser)(ctx, { draft: firstSliceDraft({ quantity: 1.5 }) }),
      "SELLER_LISTING_INVALID:INVALID_QUANTITY",
    );
    expect(tables.listings).toHaveLength(0);
  });

  test("it should reject invalid event timestamps before persisting a seller listing", async () => {
    const { ctx, tables } = createVerifiedListingCtx();

    await expectRejectsWithMessage(
      () =>
        handlerOf(submitSellerListingForCurrentUser)(ctx, {
          draft: firstSliceDraft({ eventOrTripStartAt: "not-a-date" }),
        }),
      "SELLER_LISTING_INVALID:MISSING_EVENT_OR_TRIP_START",
    );
    expect(tables.listings).toHaveLength(0);
  });

  test.each([
    {
      name: "AUTO_APPROVE",
      rule: bookmyshowEventRule,
      draft: firstSliceDraft(),
      state: "live",
    },
    {
      name: "AUTO_BLOCK",
      rule: blockedWatcherRule,
      draft: firstSliceDraft({
        source: "manual_upload",
        category: "watcher",
        title: "Identity-bound watcher slot",
      }),
      state: "blocked",
    },
    {
      name: "AUTO_WAITLIST",
      rule: districtMovieWaitlistRule,
      draft: firstSliceDraft({
        source: "district",
        category: "movie_ticket",
        title: "District Movie Night",
      }),
      state: "waitlist_only",
    },
    {
      name: "NEEDS_MANUAL_REVIEW",
      rule: otherPlatformEventReviewRule,
      draft: firstSliceDraft({
        source: "other_platform",
        category: "event_ticket",
        title: "Other Platform Event",
      }),
      state: "under_review",
    },
  ])("persists $name submissions as $state", async ({ rule, draft, state }) => {
    const { ctx, tables } = createMockListingCtx(
      { subject: VERIFIED_PROVIDER_ID },
      {
        ...verifiedSellerRows({ phoneVerified: true }),
        source_rules: [sourceRuleRow(rule)],
      },
    );

    const result = (await handlerOf(submitSellerListingForCurrentUser)(ctx, { draft })) as {
      listing: { state: string; ruleDecision: string; sourceRuleId: string };
    };

    expect(result.listing.state).toBe(state);
    expect(result.listing.ruleDecision).toBe(rule.decision);
    expect(result.listing.sourceRuleId).toBe(rule.id);
    expect(tables.listings[0].state).toBe(state);
  });

  test("it should apply the persisted source rule decision when it differs from bundled local rules", async () => {
    const persistedBlockedRule = {
      ...bookmyshowEventRule,
      decision: "AUTO_BLOCK" as const,
      internalStatus: "BLOCKED" as const,
      priceRule: { kind: "blocked" as const },
      protectionLevel: "cannot_list" as const,
      blockedBehavior: "cannot_list" as const,
    };
    const { ctx, tables } = createMockListingCtx(
      { subject: VERIFIED_PROVIDER_ID },
      {
        ...verifiedSellerRows({ phoneVerified: true }),
        source_rules: [sourceRuleRow(persistedBlockedRule)],
      },
    );

    const result = (await handlerOf(submitSellerListingForCurrentUser)(ctx, {
      draft: firstSliceDraft(),
    })) as { listing: { state: string; ruleDecision: string; sourceRuleId: string }; status: string };

    expect(result.status).toBe("created");
    expect(result.listing.state).toBe("blocked");
    expect(result.listing.ruleDecision).toBe("AUTO_BLOCK");
    expect(result.listing.sourceRuleId).toBe(bookmyshowEventRule.id);
    expect(tables.listings[0].state).toBe("blocked");
    expect(tables.listings[0].ruleDecision).toBe("AUTO_BLOCK");
  });

  test("it should select the latest persisted source-category rule instead of a bundled fallback", async () => {
    const olderBusRule: SourceRule = {
      ...bookmyshowEventRule,
      id: "source_rule_bus_travel_v1",
      version: 1,
      source: "bus_operator",
      category: "bus_travel",
      sourceCategoryKey: "bus_operator_bus_travel",
      decision: "AUTO_BLOCK",
      internalStatus: "BLOCKED",
      transferMode: "CODE_REVEAL",
      protectionLevel: "cannot_list",
      priceRule: { kind: "blocked" },
      blockedBehavior: "cannot_list",
    };
    const latestBusRule: SourceRule = {
      ...olderBusRule,
      id: "source_rule_bus_travel_v2",
      version: 2,
      decision: "AUTO_WAITLIST",
      internalStatus: "DEMAND_ONLY",
      protectionLevel: "waitlist_only",
      priceRule: { kind: "manual_review_above_face_value", maxMultiplier: 1 },
      blockedBehavior: "waitlist_only",
    };
    const futureBusRule: SourceRule = {
      ...latestBusRule,
      id: "source_rule_bus_travel_v3",
      version: 3,
      decision: "AUTO_BLOCK",
      internalStatus: "BLOCKED",
      protectionLevel: "cannot_list",
      priceRule: { kind: "blocked" },
      blockedBehavior: "cannot_list",
      effectiveFrom: "2099-01-01T00:00:00+05:30",
    };
    const { ctx, tables } = createMockListingCtx(
      { subject: VERIFIED_PROVIDER_ID },
      {
        ...verifiedSellerRows({ phoneVerified: true }),
        source_rules: [sourceRuleRow(olderBusRule), sourceRuleRow(latestBusRule), sourceRuleRow(futureBusRule)],
      },
    );

    const result = (await handlerOf(submitSellerListingForCurrentUser)(ctx, {
      draft: firstSliceDraft({
        source: "bus_operator",
        category: "bus_travel",
        title: "Bengaluru to Mysuru bus pass",
        venueOrRoute: "Bengaluru to Mysuru",
      }),
    })) as { listing: { state: string; ruleDecision: string; sourceRuleId: string; sourceRuleVersion: number } };

    expect(result.listing.state).toBe("waitlist_only");
    expect(result.listing.ruleDecision).toBe("AUTO_WAITLIST");
    expect(result.listing.sourceRuleId).toBe("source_rule_bus_travel_v2");
    expect(result.listing.sourceRuleVersion).toBe(2);
    expect(tables.listings[0].sourceRuleId).toBe("source_rule_bus_travel_v2");
  });

  test("it should require manual review when a persisted face-value cap is exceeded", async () => {
    const { ctx, tables } = createVerifiedListingCtx();

    const result = (await handlerOf(submitSellerListingForCurrentUser)(ctx, {
      draft: firstSliceDraft({ listingPrice: 2600 }),
    })) as { listing: { state: string; ruleDecision: string }; status: string };

    expectUnderReviewCreated(result, tables);
  });

  test("updates the seller's existing duplicate listing instead of creating another row", async () => {
    const { ctx, tables } = createMockListingCtx(
      { subject: VERIFIED_PROVIDER_ID },
      {
        ...verifiedSellerRows({ phoneVerified: true }),
        source_rules: [sourceRuleRow()],
      },
    );

    const first = (await handlerOf(submitSellerListingForCurrentUser)(ctx, {
      draft: firstSliceDraft({ listingPrice: 2200 }),
    })) as { listing: { id: string; listingPrice: number }; status: string };
    const second = (await handlerOf(submitSellerListingForCurrentUser)(ctx, {
      draft: firstSliceDraft({ listingPrice: 2300 }),
    })) as { listing: { id: string; listingPrice: number }; status: string };

    expect(first.status).toBe("created");
    expect(second.status).toBe("updated");
    expect(second.listing.id).toBe(first.listing.id);
    expect(second.listing.listingPrice).toBe(2300);
    expect(tables.listings).toHaveLength(1);
    expect(tables.listings[0].listingPrice).toBe(2300);
  });

  test("it should update an existing listing when duplicate fingerprints normalize to the same key", async () => {
    const { ctx, tables } = createMockListingCtx(
      { subject: VERIFIED_PROVIDER_ID },
      {
        ...verifiedSellerRows({ phoneVerified: true }),
        source_rules: [sourceRuleRow()],
      },
    );

    const first = (await handlerOf(submitSellerListingForCurrentUser)(ctx, {
      draft: firstSliceDraft({ duplicateFingerprint: " Seller Upload:Arijit Singh Silver Pass " }),
    })) as { listing: { id: string }; status: string };
    const second = (await handlerOf(submitSellerListingForCurrentUser)(ctx, {
      draft: firstSliceDraft({
        duplicateFingerprint: "seller-upload arijit    singh silver pass",
        listingPrice: 2300,
      }),
    })) as { listing: { id: string; listingPrice: number }; status: string };

    expect(first.status).toBe("created");
    expect(second.status).toBe("updated");
    expect(second.listing.id).toBe(first.listing.id);
    expect(second.listing.listingPrice).toBe(2300);
    expect(tables.listings).toHaveLength(1);
    expect(tables.listings[0].duplicateFingerprint).toBe("seller_upload_arijit_singh_silver_pass");
    expect(tables.listings[0].listingPrice).toBe(2300);
  });

  test("it should create a new listing when a duplicate fingerprint matches a terminal listing", async () => {
    const { ctx, tables } = createMockListingCtx(
      { subject: VERIFIED_PROVIDER_ID },
      {
        ...verifiedSellerRows({ phoneVerified: true }),
        source_rules: [sourceRuleRow()],
        listings: [existingFirstSliceListingRow({ _id: "listings_terminal_1", state: "sold" })],
      },
    );

    const result = (await handlerOf(submitSellerListingForCurrentUser)(ctx, {
      draft: firstSliceDraft({ listingPrice: 2300 }),
    })) as { listing: { id: string; listingPrice: number }; status: string };

    expect(result.status).toBe("created");
    expect(result.listing.listingPrice).toBe(2300);
    expect(tables.listings).toHaveLength(2);
    expect(tables.listings[0].state).toBe("sold");
    expect(tables.listings[0].listingPrice).toBe(2200);
    expect(tables.listings[1].listingKey).not.toBe(tables.listings[0].listingKey);
    expect(tables.listings[1].listingPrice).toBe(2300);
  });

  test("it should update an active relist when an older terminal listing has the same fingerprint", async () => {
    const activeRelistKey = "listing_user_internal_seller_1_seller_upload_arijit_singh_silver_pass_2";
    const { ctx, tables } = createMockListingCtx(
      { subject: VERIFIED_PROVIDER_ID },
      {
        ...verifiedSellerRows({ phoneVerified: true }),
        source_rules: [sourceRuleRow()],
        listings: [
          existingFirstSliceListingRow({ _id: "listings_terminal_1", state: "sold" }),
          existingFirstSliceListingRow({
            _id: "listings_active_relist_1",
            listingKey: activeRelistKey,
            listingPrice: 2300,
            state: "live",
          }),
        ],
      },
    );

    const result = (await handlerOf(submitSellerListingForCurrentUser)(ctx, {
      draft: firstSliceDraft({ listingPrice: 2400 }),
    })) as { listing: { id: string; listingPrice: number }; status: string };

    expect(result.status).toBe("updated");
    expect(result.listing.id).toBe(activeRelistKey);
    expect(result.listing.listingPrice).toBe(2400);
    expect(tables.listings).toHaveLength(2);
    expect(tables.listings[0].state).toBe("sold");
    expect(tables.listings[0].listingPrice).toBe(2200);
    expect(tables.listings[1].listingKey).toBe(activeRelistKey);
    expect(tables.listings[1].listingPrice).toBe(2400);
  });
});
