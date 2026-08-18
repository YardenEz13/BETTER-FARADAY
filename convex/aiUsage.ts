// ── AI usage metering ──
// Every Gemini call site (the HTTP proxy in http.ts and the server-side
// actions that call generateWithFallback) records into a per-day / per-task
// aggregate row. The teacher dashboard reads a 7-day window.
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { israelDate } from "./streaks";
import { GLOBAL_DAILY_CAP, BUDGET_WARN_RATIO } from "./aiGate";

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
      // Budget headroom, so the dashboard can show trouble coming instead of
      // only showing it after every student sees "פאראדיי עמוס כרגע".
      budget: {
        cap: GLOBAL_DAILY_CAP,
        used: today.requests,
        pct: Math.round((today.requests / GLOBAL_DAILY_CAP) * 100),
        level: budgetLevel(today.requests),
      },
    };
  },
});

export type BudgetLevel = "ok" | "warn" | "critical";

/** Shared by the dashboard read and the cron so they can never disagree. */
export function budgetLevel(requests: number): BudgetLevel {
  if (requests >= GLOBAL_DAILY_CAP) return "critical";
  if (requests >= GLOBAL_DAILY_CAP * BUDGET_WARN_RATIO) return "warn";
  return "ok";
}

/**
 * Half-hourly budget watch (convex/crons.ts).
 *
 * Counts every Gemini call recorded today — including the server-side actions
 * (homework personalization, grading, digests) that never touch the proxy's
 * rate limiter, so this sees the real bill rather than just student traffic.
 * Over threshold it logs at error level, which is what Convex log streaming
 * and exception reporting forward to a human.
 *
 * ponytail: log-level alert only. Wire the Convex log stream to email/Slack
 * before the pilot, or nobody reads it during a school day.
 */
export const checkDailyBudget = internalMutation({
  args: {},
  handler: async (ctx) => {
    const day = israelDate();
    const rows = await ctx.db
      .query("aiUsage")
      .withIndex("by_day", (q) => q.eq("day", day))
      .collect();

    const requests = rows.reduce((s, r) => s + r.requests, 0);
    const errors = rows.reduce((s, r) => s + r.errors, 0);
    const level = budgetLevel(requests);
    if (level === "ok") return { level, requests };

    const breakdown = rows
      .map((r) => `${r.task}=${r.requests}`)
      .sort()
      .join(" ");
    const line = `[aiUsage] ${level.toUpperCase()}: ${requests}/${GLOBAL_DAILY_CAP} Gemini calls on ${day} (${errors} errors) — ${breakdown}`;
    console.error(line);
    return { level, requests };
  },
});
