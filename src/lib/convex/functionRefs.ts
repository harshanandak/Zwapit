// Convex function references built by name (module:export), so `src/` never
// imports `convex/_generated/api`. This keeps the Astro build independent of
// Convex codegen output — the generated files only exist after a deployment is
// run (`npx convex dev`), and the app must build/typecheck without one.

import { makeFunctionReference } from "convex/server";

export const functionRefs = {
  seedDemoFixture: makeFunctionReference<"mutation">("seed:seedDemoFixture"),
  getCurrentFixtureView: makeFunctionReference<"query">("orders:getCurrentFixtureView"),
  getBuyerOrder: makeFunctionReference<"query">("orders:getBuyerOrder"),
  getBuyerOrderForCurrentUser: makeFunctionReference<"query">("orders:getBuyerOrderForCurrentUser"),
  getBuyerTickets: makeFunctionReference<"query">("orders:getBuyerTickets"),
  getSellerOrders: makeFunctionReference<"query">("orders:getSellerOrders"),
  getSellerOrdersForCurrentUser: makeFunctionReference<"query">("orders:getSellerOrdersForCurrentUser"),
  getHomeListings: makeFunctionReference<"query">("listings:getHomeListings"),
  getListingDetail: makeFunctionReference<"query">("listings:getListingDetail"),
  getCheckoutView: makeFunctionReference<"query">("listings:getCheckoutView"),
  submitSellerListingForCurrentUser: makeFunctionReference<"mutation">("listings:submitSellerListingForCurrentUser"),
  mockCheckout: makeFunctionReference<"mutation">("orders:mockCheckout"),
  mockCheckoutForCurrentUser: makeFunctionReference<"mutation">("orders:mockCheckoutForCurrentUser"),
  claimDemoSellerOrderForCurrentUser: makeFunctionReference<"mutation">("orders:claimDemoSellerOrderForCurrentUser"),
  sellerSubmitTransfer: makeFunctionReference<"mutation">("orders:sellerSubmitTransfer"),
  buyerConfirmTransfer: makeFunctionReference<"mutation">("orders:buyerConfirmTransfer"),
  buyerReportIssue: makeFunctionReference<"mutation">("orders:buyerReportIssue"),
  advanceTimeline: makeFunctionReference<"mutation">("orders:advanceTimeline"),
  syncAppUserFromProvider: makeFunctionReference<"mutation">("identity:syncAppUserFromProvider"),
  getCurrentAppUser: makeFunctionReference<"query">("identity:getCurrentAppUser"),
  getPhoneVerificationRequirement: makeFunctionReference<"query">("identity:getPhoneVerificationRequirement"),
  requirePhoneVerifiedForAction: makeFunctionReference<"mutation">("identity:requirePhoneVerifiedForAction"),
  sellerSubmitTransferForCurrentUser: makeFunctionReference<"mutation">("orders:sellerSubmitTransferForCurrentUser"),
  buyerConfirmTransferForCurrentUser: makeFunctionReference<"mutation">("orders:buyerConfirmTransferForCurrentUser"),
  buyerReportIssueForCurrentUser: makeFunctionReference<"mutation">("orders:buyerReportIssueForCurrentUser"),
  advanceTimelineForCurrentUser: makeFunctionReference<"mutation">("orders:advanceTimelineForCurrentUser"),
} as const;
