import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { appUserIdFromUserDocId, buildAuthSyncRecord, selectProviderPhoneVerified } from "./authModel";

type ConvexAuthIdentity = {
  subject: string;
  name?: string;
  email?: string;
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean | null;
};

type AuthCtx = QueryCtx | MutationCtx;

const PROVIDER = "clerk" as const;
const PHONE_REQUIRED_ACTIONS: Array<"buy" | "sell"> = ["buy", "sell"];

function displayNameFromIdentity(identity: ConvexAuthIdentity): string {
  return identity.name ?? identity.email ?? "Zwapit user";
}

function phoneVerifiedFromIdentity(identity: ConvexAuthIdentity): boolean {
  return selectProviderPhoneVerified(identity);
}

async function requireProviderIdentity(ctx: AuthCtx): Promise<ConvexAuthIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("AUTH_REQUIRED");
  return identity;
}

export async function syncIdentityToAppUser(
  ctx: MutationCtx,
  identity: ConvexAuthIdentity,
): Promise<ReturnType<typeof buildAuthSyncRecord>> {
  const providerUserId = identity.subject;
  const existingIdentity = await ctx.db
    .query("auth_identities")
    .withIndex("by_provider_subject", (q) => q.eq("provider", PROVIDER).eq("providerUserId", providerUserId))
    .unique();

  const phoneVerified = phoneVerifiedFromIdentity(identity);
  const displayName = displayNameFromIdentity(identity);

  if (existingIdentity) {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", existingIdentity.appUserId))
      .unique();
    if (existingUser) {
      await ctx.db.patch(existingUser._id, { displayName, phoneVerified });
    } else {
      await ctx.db.insert("users", {
        appUserId: existingIdentity.appUserId,
        displayName,
        phoneVerified,
        role: "buyer_seller",
      });
    }

    const existingVerification = await ctx.db
      .query("user_verifications")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", existingIdentity.appUserId))
      .unique();
    const verificationMode = phoneVerified ? "clerk_phone" : "unverified";
    if (existingVerification) {
      await ctx.db.patch(existingVerification._id, { phoneVerified, verificationMode });
    } else {
      await ctx.db.insert("user_verifications", {
        appUserId: existingIdentity.appUserId,
        phoneVerified,
        verificationMode,
      });
    }

    return buildAuthSyncRecord({
      appUserId: existingIdentity.appUserId,
      displayName,
      phoneVerified,
      provider: PROVIDER,
      providerUserId,
    });
  }

  const userDocId = await ctx.db.insert("users", {
    appUserId: "__pending__",
    displayName,
    phoneVerified,
    role: "buyer_seller",
  });
  const appUserId = appUserIdFromUserDocId(userDocId);
  await ctx.db.patch(userDocId, { appUserId });
  await ctx.db.insert("auth_identities", { appUserId, provider: PROVIDER, providerUserId });
  await ctx.db.insert("user_verifications", {
    appUserId,
    phoneVerified,
    verificationMode: phoneVerified ? "clerk_phone" : "unverified",
  });

  return buildAuthSyncRecord({ appUserId, displayName, phoneVerified, provider: PROVIDER, providerUserId });
}

export async function resolveCurrentAppUser(ctx: AuthCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const identityDoc = await ctx.db
    .query("auth_identities")
    .withIndex("by_provider_subject", (q) => q.eq("provider", PROVIDER).eq("providerUserId", identity.subject))
    .unique();
  if (!identityDoc) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_app_user_id", (q) => q.eq("appUserId", identityDoc.appUserId))
    .unique();
}

export async function requireAuthenticatedAppUser(ctx: AuthCtx): Promise<Doc<"users">> {
  const user = await resolveCurrentAppUser(ctx);
  if (!user) throw new Error("AUTH_REQUIRED");
  return user;
}

export async function requirePhoneVerifiedAppUser(ctx: AuthCtx): Promise<Doc<"users">> {
  const user = await requireAuthenticatedAppUser(ctx);
  if (!user.phoneVerified) throw new Error("PHONE_VERIFICATION_REQUIRED");
  return user;
}

export const syncAppUserFromProvider = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireProviderIdentity(ctx);
    return await syncIdentityToAppUser(ctx, identity);
  },
});

export const getCurrentAppUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      displayName: v.string(),
      id: v.string(),
      phoneVerified: v.boolean(),
      role: v.literal("buyer_seller"),
    }),
  ),
  handler: async (ctx) => {
    const user = await resolveCurrentAppUser(ctx);
    if (!user) return null;
    return {
      displayName: user.displayName,
      id: user.appUserId,
      phoneVerified: user.phoneVerified,
      role: user.role,
    };
  },
});

export const getPhoneVerificationRequirement = query({
  args: {},
  returns: v.object({
    appUserId: v.string(),
    phoneVerified: v.boolean(),
    requiredFor: v.array(v.union(v.literal("buy"), v.literal("sell"))),
    status: v.union(v.literal("verified"), v.literal("required")),
  }),
  handler: async (ctx) => {
    const user = await requireAuthenticatedAppUser(ctx);
    return {
      appUserId: user.appUserId,
      phoneVerified: user.phoneVerified,
      requiredFor: PHONE_REQUIRED_ACTIONS,
      status: user.phoneVerified ? ("verified" as const) : ("required" as const),
    };
  },
});

export const requirePhoneVerifiedForAction = mutation({
  args: { action: v.union(v.literal("buy"), v.literal("sell")) },
  returns: v.object({
    action: v.union(v.literal("buy"), v.literal("sell")),
    appUserId: v.string(),
    status: v.literal("verified"),
  }),
  handler: async (ctx, args) => {
    const user = await requirePhoneVerifiedAppUser(ctx);
    return { action: args.action, appUserId: user.appUserId, status: "verified" as const };
  },
});
