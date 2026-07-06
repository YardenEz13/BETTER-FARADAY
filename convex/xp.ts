import { query, internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ── Core XP awarding ──
// Shared helper so any mutation in this codebase can award XP inline (attempts,
// homework, review) without a cross-transaction ctx.runMutation hop. Inserts an
// xpEvents row and keeps the denormalized students.xp rollup in sync.
export async function awardXpHelper(
  ctx: MutationCtx,
  studentId: Id<"students">,
  amount: number,
  reason: string,
  refId?: string,
): Promise<number> {
  await ctx.db.insert("xpEvents", {
    studentId,
    amount,
    reason,
    refId,
    createdAt: Date.now(),
  });
  const student = await ctx.db.get(studentId);
  const newXp = (student?.xp ?? 0) + amount;
  await ctx.db.patch(studentId, { xp: newXp });
  return newXp;
}

// Internal mutation wrapper so scheduled/other-runtime callers can award XP too.
export const awardXp = internalMutation({
  args: {
    studentId: v.id("students"),
    amount: v.number(),
    reason: v.string(),
    refId: v.optional(v.string()),
  },
  handler: async (ctx, { studentId, amount, reason, refId }) => {
    return await awardXpHelper(ctx, studentId, amount, reason, refId);
  },
});

// XP awarded for answering a question: correct scales with difficulty (1-5),
// wrong gives a small participation reward.
export function xpForAttempt(isCorrect: boolean, difficulty: number): number {
  if (!isCorrect) return 2;
  const d = Math.max(1, Math.min(5, difficulty));
  return 5 + 5 * d;
}

export const getXpSummary = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    const earned = student?.xp ?? 0;
    const spent = student?.xpSpent ?? 0;

    const recent = await ctx.db
      .query("xpEvents")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(20);

    return {
      earned,
      spent,
      balance: earned - spent,
      recent: recent.map((e) => ({
        _id: e._id,
        amount: e.amount,
        reason: e.reason,
        refId: e.refId ?? null,
        createdAt: e.createdAt,
      })),
    };
  },
});
