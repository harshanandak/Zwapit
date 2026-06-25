/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alerts from "../alerts.js";
import type * as authModel from "../authModel.js";
import type * as catalog from "../catalog.js";
import type * as catalogCrawl from "../catalogCrawl.js";
import type * as crons from "../crons.js";
import type * as identity from "../identity.js";
import type * as listings from "../listings.js";
import type * as model from "../model.js";
import type * as orders from "../orders.js";
import type * as referrals from "../referrals.js";
import type * as requests from "../requests.js";
import type * as seed from "../seed.js";
import type * as watcher from "../watcher.js";
import type * as watcher_adapters from "../watcher/adapters.js";
import type * as watcher_parse from "../watcher/parse.js";
import type * as watcher_senders from "../watcher/senders.js";
import type * as watcher_types from "../watcher/types.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alerts: typeof alerts;
  authModel: typeof authModel;
  catalog: typeof catalog;
  catalogCrawl: typeof catalogCrawl;
  crons: typeof crons;
  identity: typeof identity;
  listings: typeof listings;
  model: typeof model;
  orders: typeof orders;
  referrals: typeof referrals;
  requests: typeof requests;
  seed: typeof seed;
  watcher: typeof watcher;
  "watcher/adapters": typeof watcher_adapters;
  "watcher/parse": typeof watcher_parse;
  "watcher/senders": typeof watcher_senders;
  "watcher/types": typeof watcher_types;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
