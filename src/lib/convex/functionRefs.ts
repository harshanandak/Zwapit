// Convex function references built by name (module:export), so `src/` never
// imports `convex/_generated/api`. This keeps the Astro build independent of
// Convex codegen output — the generated files only exist after a deployment is
// run (`npx convex dev`), and the app must build/typecheck without one.

import { makeFunctionReference } from "convex/server";

export const functionRefs = {
  seedDemoFixture: makeFunctionReference<"mutation">("seed:seedDemoFixture"),
  getCurrentFixtureView: makeFunctionReference<"query">("orders:getCurrentFixtureView"),
  getBuyerOrder: makeFunctionReference<"query">("orders:getBuyerOrder"),
  getBuyerTickets: makeFunctionReference<"query">("orders:getBuyerTickets"),
  getSellerOrders: makeFunctionReference<"query">("orders:getSellerOrders"),
  getHomeListings: makeFunctionReference<"query">("listings:getHomeListings"),
  getListingDetail: makeFunctionReference<"query">("listings:getListingDetail"),
  mockCheckout: makeFunctionReference<"mutation">("orders:mockCheckout"),
  sellerSubmitTransfer: makeFunctionReference<"mutation">("orders:sellerSubmitTransfer"),
  buyerConfirmTransfer: makeFunctionReference<"mutation">("orders:buyerConfirmTransfer"),
  buyerReportIssue: makeFunctionReference<"mutation">("orders:buyerReportIssue"),
  advanceTimeline: makeFunctionReference<"mutation">("orders:advanceTimeline"),
} as const;
