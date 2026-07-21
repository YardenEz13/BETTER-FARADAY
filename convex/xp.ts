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

// XP awarded for answering a question: correct scales with difficulty (1-5),
// wrong gives a small participation reward.
export function xpForAttempt(isCorrect: boolean, difficulty: number): number {
  if (!isCorrect) return 2;
  const d = Math.max(1, Math.min(5, difficulty));
  return 5 + 5 * d;
}

// ── One-off repair + backfill (run with `npx convex run xp:backfillXp`) ──
// 1. Repair: purchases used to double-charge (xpSpent rollup AND a negative
//    patch to students.xp via awardXpHelper). xp is recomputed from the
//    non-purchase ledger events, restoring its "lifetime earned" meaning.
// 2. Backfill: students who practiced before the XP engine shipped have
//    attempts but no xpEvents. Credits xpForAttempt() for every attempt that
//    has no matching xpEvent (matched by refId = attempt id).
// Idempotent: xp is recomputed from the ledger, and the backfill pass is
// skipped entirely once a "backfill" event exists for the student.
export const backfillXp = internalMutation({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    const results: Array<{ name: string; before: number; after: number }> = [];

    for (const student of students) {
      const events = await ctx.db
        .query("xpEvents")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .collect();

      // Backfill: attempts with no xpEvent yet. Runs at most once per student.
      const alreadyBackfilled = events.some((e) => e.reason === "backfill");
      const creditedAttemptIds = new Set(
        events
          .filter((e) => e.reason.startsWith("attempt_") && e.refId)
          .map((e) => e.refId),
      );
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .collect();
      let backfill = 0;
      if (!alreadyBackfilled) {
        for (const a of attempts) {
          if (creditedAttemptIds.has(a._id)) continue;
          backfill += xpForAttempt(a.isCorrect, a.difficulty);
        }
      }
      if (backfill > 0) {
        await ctx.db.insert("xpEvents", {
          studentId: student._id,
          amount: backfill,
          reason: "backfill",
          createdAt: Date.now(),
        });
      }

      // Recompute lifetime-earned from the ledger (idempotent): every earn has
      // an event (deploy-era awards, streak/homework, and the backfill row just
      // inserted); purchases live only in xpSpent.
      const before = student.xp ?? 0;
      const after =
        events
          .filter((e) => e.reason !== "purchase")
          .reduce((sum, e) => sum + e.amount, 0) + backfill;
      if (after !== before) {
        await ctx.db.patch(student._id, { xp: after });
      }
      results.push({ name: student.name, before, after });
    }
    return results;
  },
});

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
