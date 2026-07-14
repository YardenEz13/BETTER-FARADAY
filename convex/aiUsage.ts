// ── AI usage metering ──
// Every Gemini call site (the HTTP proxy in http.ts and the server-side
// actions that call generateWithFallback) records into a per-day / per-task
// aggregate row. The teacher dashboard reads a 7-day window.
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { israelDate } from "./streaks";

export const record = internalMutation({
  args: {
    task: v.string(),
    ok: v.boolean(),
    promptTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
  },
  handler: async (ctx, { task, ok, promptTokens, outputTokens }) => {
    const day = israelDate();
    const existing = await ctx.db
      .query("aiUsage")
      .withIndex("by_day_task", (q) => q.eq("day", day).eq("task", task))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        requests: existing.requests + 1,
        errors: existing.errors + (ok ? 0 : 1),
        promptTokens: existing.promptTokens + (promptTokens ?? 0),
        outputTokens: existing.outputTokens + (outputTokens ?? 0),
      });
    } else {
      await ctx.db.insert("aiUsage", {
        day,
        task,
        requests: 1,
        errors: ok ? 0 : 1,
        promptTokens: promptTokens ?? 0,
        outputTokens: outputTokens ?? 0,
      });
    }
  },
});

// Today's totals + a 7-day daily series (oldest → newest) for sparklines.
export const getUsageSummary = query({
  args: {},
  handler: async (ctx) => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) days.push(israelDate(now - i * DAY_MS));

    const daily = [];
    for (const day of days) {
      const rows = await ctx.db
        .query("aiUsage")
        .withIndex("by_day", (q) => q.eq("day", day))
        .collect();
      daily.push({
        day,
        requests: rows.reduce((s, r) => s + r.requests, 0),
        errors: rows.reduce((s, r) => s + r.errors, 0),
        promptTokens: rows.reduce((s, r) => s + r.promptTokens, 0),
        outputTokens: rows.reduce((s, r) => s + r.outputTokens, 0),
      });
    }

    const today = daily[daily.length - 1];
    const todayRows = await ctx.db
      .query("aiUsage")
      .withIndex("by_day", (q) => q.eq("day", days[days.length - 1]))
      .collect();

    return {
      today,
      byTaskToday: todayRows.map((r) => ({
        task: r.task,
        requests: r.requests,
        errors: r.errors,
      })),
      daily,
    };
  },
});
