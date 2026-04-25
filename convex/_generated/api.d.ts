/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as aiChat from "../aiChat.js";
import type * as attempts from "../attempts.js";
import type * as classroom from "../classroom.js";
import type * as clear from "../clear.js";
import type * as crons from "../crons.js";
import type * as powerMap from "../powerMap.js";
import type * as questions from "../questions.js";
import type * as seed from "../seed.js";
import type * as seedInteractions from "../seedInteractions.js";
import type * as sessionBriefs from "../sessionBriefs.js";
import type * as topics from "../topics.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  aiChat: typeof aiChat;
  attempts: typeof attempts;
  classroom: typeof classroom;
  clear: typeof clear;
  crons: typeof crons;
  powerMap: typeof powerMap;
  questions: typeof questions;
  seed: typeof seed;
  seedInteractions: typeof seedInteractions;
  sessionBriefs: typeof sessionBriefs;
  topics: typeof topics;
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
