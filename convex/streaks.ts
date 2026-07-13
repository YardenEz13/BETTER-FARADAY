import { query, internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { awardXpHelper } from "./xp";

// ── Israel-local calendar date (YYYY-MM-DD) ──
// Israel is UTC+2 (winter) / UTC+3 (summer). We resolve the wall-clock date via
// Intl in the Asia/Jerusalem zone so DST is handled correctly.
export function israelDate(ts: number = Date.now()): string {
  // en-CA gives ISO-ish YYYY-MM-DD directly.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

function dayDiff(fromISO: string, toISO: string): number {
  const a = Date.parse(fromISO + "T00:00:00Z");
  const b = Date.parse(toISO + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

// ── Touch the student's streak ──
// Called from the same flows that award XP for practice/homework/review.
//  - same day  → noop
//  - yesterday → streak + 1, award streak_day XP (5*streak, capped 50)
//  - older gap → reset to 1, UNLESS a streak freeze is available (consume it,
//                keep the streak intact).
export async function touchStreakHelper(
  ctx: MutationCtx,
  studentId: Id<"students">,
): Promise<{ streak: number; frozeGap: boolean }> {
  const student = await ctx.db.get(studentId);
  if (!student) return { streak: 0, frozeGap: false };

  const today = israelDate();
  const last = student.lastActiveDate;

  // Already counted today.
  if (last === today) {
    return { streak: student.streak, frozeGap: false };
  }

  const gap = last ? dayDiff(last, today) : Infinity;

  if (gap === 1) {
    const newStreak = student.streak + 1;
    await ctx.db.patch(studentId, { streak: newStreak, lastActiveDate: today });
    const bonus = Math.min(50, 5 * newStreak);
    await awardXpHelper(ctx, studentId, bonus, "streak_day");
    return { streak: newStreak, frozeGap: false };
  }

  // Gap of 2+ days (or first-ever activity with a broken chain).
  const freezes = student.streakFreezes ?? 0;
  if (gap !== Infinity && gap >= 2 && freezes > 0) {
    // Consume a freeze, preserve the streak, and mark one unconsumed
    // streak_freeze purchase as consumed for bookkeeping.
    await ctx.db.patch(studentId, {
      streakFreezes: freezes - 1,
      lastActiveDate: today,
    });
    await consumeOneFreezePurchase(ctx, studentId);
    return { streak: student.streak, frozeGap: true };
  }

  // No freeze → reset.
  await ctx.db.patch(studentId, { streak: 1, lastActiveDate: today });
  return { streak: 1, frozeGap: false };
}

async function consumeOneFreezePurchase(
  ctx: MutationCtx,
  studentId: Id<"students">,
): Promise<void> {
  const purchases = await ctx.db
    .query("purchases")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  const freeze = purchases.find((p) => p.consumed !== true);
  // Best-effort: the streakFreezes counter is the source of truth; this just
  // keeps purchase rows tidy. Only mark ones that look like consumables.
  if (freeze) {
    const item = await ctx.db.get(freeze.itemId);
    if (item && item.category === "streak_freeze") {
      await ctx.db.patch(freeze._id, { consumed: true });
    }
  }
}

// Internal wrapper for scheduled callers.
export const touchStreak = internalMutation({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    return await touchStreakHelper(ctx, studentId);
  },
});

export const getStreakStatus = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) {
      return { streak: 0, activeToday: false, inDanger: false, freezesAvailable: 0 };
    }
    const today = israelDate();
    const activeToday = student.lastActiveDate === today;
    return {
      streak: student.streak,
      activeToday,
      inDanger: !activeToday && student.streak > 0,
      freezesAvailable: student.streakFreezes ?? 0,
    };
  },
});
