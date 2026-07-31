// ── Faraday AI gate: rate limiting + kill-switch ────────────────────────────
// Single choke point the Gemini HTTP proxy (convex/http.ts) calls before
// forwarding any request to Google. Two layers:
//   1. Kill-switch: a `systemFlags` row ("faraday_ai_enabled"). Off → proxy
//      returns a friendly Hebrew "resting" message instead of calling Gemini.
//   2. Rate limits: per-studentId (there's no auth yet — studentId is a
//      client-supplied arg, so this is abuse-slowdown, not a security
//      boundary) plus a global daily cap so one runaway client can't blow the
//      whole project's Gemini quota/bill.
import { RateLimiter, MINUTE, HOUR, DAY } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { query, mutation, internalQuery } from "./_generated/server";

/**
 * Global Gemini calls/day allowed through the proxy.
 *
 * Modelled on a 35-student pilot class at their heaviest:
 *   tutor chat 35 × ~25   ≈  875
 *   notebook vision 35 × 5 ≈  175
 *   chat analysis          ≈  175
 *   themed precompute      ≈  290  (a batch every 5 min while backlogged)
 *   proof grading          ≈  200
 *   question authoring     ≈   19  (cron, every 75min, runs indefinitely — no target)
 *   ────────────────────────────
 *   peak day               ≈ 1,735
 *
 * At the old 2000 that is a cap a normal busy lesson could trip, and tripping
 * it shows every student "פאראדיי עמוס כרגע" at once — which reads as broken,
 * not busy. This is a runaway guard, not a usage ceiling, so it sits ~3.5× the
 * modelled peak. `aiUsage.checkDailyBudget` warns long before it is reached.
 */
export const GLOBAL_DAILY_CAP = 6000;
/** Warn once the day's Gemini calls pass this share of the cap. */
export const BUDGET_WARN_RATIO = 0.7;

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Per-student: 20 tutor messages/hour, small burst allowance so a quick
  // back-and-forth doesn't get choppy.
  studentChat: { kind: "token bucket", rate: 20, period: HOUR, capacity: 5 },
  // Per-student vision calls (notebook photo checks) are heavier/costlier —
  // tighter cap.
  studentVision: { kind: "token bucket", rate: 10, period: HOUR, capacity: 3 },
  // Global daily cap across all students, shared bucket keyed by a constant.
  globalDaily: { kind: "fixed window", rate: GLOBAL_DAILY_CAP, period: DAY },
  // Cheap circuit breaker against a single client hammering the endpoint —
  // caps burst request rate regardless of task.
  globalBurst: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 20 },
});

export const KILL_SWITCH_KEY = "faraday_ai_enabled";

export const RESTING_MESSAGE =
  "המורה פאראדיי נח כרגע, נסו שוב מאוחר יותר.";

// ── Kill-switch read (used by the httpAction, called via ctx.runQuery) ──
export const isAiEnabled = internalQuery({
  args: {},
  handler: async (ctx) => {
    const flag = await ctx.db
      .query("systemFlags")
      .withIndex("by_key", (q) => q.eq("key", KILL_SWITCH_KEY))
      .unique();
    // Default ON when the flag row doesn't exist yet.
    return flag ? flag.enabled : true;
  },
});

// ── Public admin controls (no auth yet — mirrors the rest of the app) ──
export const getAiEnabled = query({
  args: {},
  handler: async (ctx) => {
    const flag = await ctx.db
      .query("systemFlags")
      .withIndex("by_key", (q) => q.eq("key", KILL_SWITCH_KEY))
      .unique();
    return flag ? flag.enabled : true;
  },
});

export const setAiEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("systemFlags")
      .withIndex("by_key", (q) => q.eq("key", KILL_SWITCH_KEY))
      .unique();
    if (existing) {
      await ctx.db.patch("systemFlags", existing._id, { enabled: args.enabled, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("systemFlags", { key: KILL_SWITCH_KEY, enabled: args.enabled, updatedAt: Date.now() });
    }
    return null;
  },
});
