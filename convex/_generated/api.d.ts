/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as addMore from "../addMore.js";
import type * as ai from "../ai.js";
import type * as aiChat from "../aiChat.js";
import type * as attempts from "../attempts.js";
import type * as bridge from "../bridge.js";
import type * as classroom from "../classroom.js";
import type * as clear from "../clear.js";
import type * as commandCenter from "../commandCenter.js";
import type * as compoundQuestions from "../compoundQuestions.js";
import type * as crons from "../crons.js";
import type * as digest from "../digest.js";
import type * as geminiModels from "../geminiModels.js";
import type * as geminiServer from "../geminiServer.js";
import type * as goals from "../goals.js";
import type * as homework from "../homework.js";
import type * as homeworkRundown from "../homeworkRundown.js";
import type * as http from "../http.js";
import type * as levels from "../levels.js";
import type * as mockInteractions from "../mockInteractions.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as packetImport from "../packetImport.js";
import type * as packetParse from "../packetParse.js";
import type * as packetPipeline from "../packetPipeline.js";
import type * as packetPrompts from "../packetPrompts.js";
import type * as packetPublish from "../packetPublish.js";
import type * as packetValidators from "../packetValidators.js";
import type * as packetWatchdog from "../packetWatchdog.js";
import type * as pdfAssignments from "../pdfAssignments.js";
import type * as powerMap from "../powerMap.js";
import type * as precompute from "../precompute.js";
import type * as proofGrading from "../proofGrading.js";
import type * as questions from "../questions.js";
import type * as review from "../review.js";
import type * as seedGeometry from "../seedGeometry.js";
import type * as seedGeometryQuestions from "../seedGeometryQuestions.js";
import type * as sessionBriefs from "../sessionBriefs.js";
import type * as shop from "../shop.js";
import type * as streaks from "../streaks.js";
import type * as teacherImport from "../teacherImport.js";
import type * as topics from "../topics.js";
import type * as xp from "../xp.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  addMore: typeof addMore;
  ai: typeof ai;
  aiChat: typeof aiChat;
  attempts: typeof attempts;
  bridge: typeof bridge;
  classroom: typeof classroom;
  clear: typeof clear;
  commandCenter: typeof commandCenter;
  compoundQuestions: typeof compoundQuestions;
  crons: typeof crons;
  digest: typeof digest;
  geminiModels: typeof geminiModels;
  geminiServer: typeof geminiServer;
  goals: typeof goals;
  homework: typeof homework;
  homeworkRundown: typeof homeworkRundown;
  http: typeof http;
  levels: typeof levels;
  mockInteractions: typeof mockInteractions;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  packetImport: typeof packetImport;
  packetParse: typeof packetParse;
  packetPipeline: typeof packetPipeline;
  packetPrompts: typeof packetPrompts;
  packetPublish: typeof packetPublish;
  packetValidators: typeof packetValidators;
  packetWatchdog: typeof packetWatchdog;
  pdfAssignments: typeof pdfAssignments;
  powerMap: typeof powerMap;
  precompute: typeof precompute;
  proofGrading: typeof proofGrading;
  questions: typeof questions;
  review: typeof review;
  seedGeometry: typeof seedGeometry;
  seedGeometryQuestions: typeof seedGeometryQuestions;
  sessionBriefs: typeof sessionBriefs;
  shop: typeof shop;
  streaks: typeof streaks;
  teacherImport: typeof teacherImport;
  topics: typeof topics;
  xp: typeof xp;
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
