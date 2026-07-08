import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { israelDate } from "./streaks";
import { awardXpHelper, xpForAttempt } from "./xp";

// Default questions-per-day target when a student hasn't picked one.
export const DEFAULT_DAILY_GOAL = 10;
export const MIN_DAILY_GOAL = 5;
export const MAX_DAILY_GOAL = 30;
export const GOAL_BONUS_XP = 20; // one-off XP when the day's goal is crossed

// Bounded scan cap — mirrors how streaks.ts keeps reads within transaction
// limits. Practice sessions are short, so the last ~200 attempts always cover
// "today" for any realistic student.
const RECENT_SCAN = 200;

// ── Award the once-per-day goal-reached bonus if the count just crossed ──
// Call this AFTER the attempt row is inserted. It re-counts today's attempts,
// and if the fresh count exactly reaches the goal (and no daily_goal event
// exists for today yet), awards GOAL_BONUS_XP. Idempotent: guarded by a lookup
// for an existing daily_goal xpEvent whose refId is today's Israel date.
export async function maybeAwardDailyGoalHelper(
  ctx: MutationCtx,
  studentId: Id<"students">,
): Promise<boolean> {
  const student = await ctx.db.get(studentId);
  if (!student) return false;
  const goal = student.dailyGoal ?? DEFAULT_DAILY_GOAL;
  const today = israelDate();

  // Already awarded today? (refId = the Israel date string)
  const events = await ctx.db
    .query("xpEvents")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .order("desc")
    .take(RECENT_SCAN);
  const alreadyAwarded = events.some(
    (e) => e.reason === "daily_goal" && e.refId === today,
  );
  if (alreadyAwarded) return false;

  const answeredToday = countAttemptsToday(
    await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(RECENT_SCAN),
    today,
  );

  if (answeredToday >= goal) {
    await awardXpHelper(ctx, studentId, GOAL_BONUS_XP, "daily_goal", today);
    return true;
  }
  return false;
}

// Count rows whose Israel-local creation date matches `today`.
function countAttemptsToday(
  rows: Array<{ _creationTime: number }>,
  today: string,
): number {
  return rows.filter((r) => israelDate(r._creationTime) === today).length;
}

export const getDailyProgress = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    const goal = student?.dailyGoal ?? DEFAULT_DAILY_GOAL;
    const streak = student?.streak ?? 0;
    const today = israelDate();

    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(RECENT_SCAN);

    let answeredToday = 0;
    let correctToday = 0;
    for (const a of attempts) {
      if (israelDate(a._creationTime) !== today) continue;
      answeredToday++;
      if (a.isCorrect) correctToday++;
    }

    const events = await ctx.db
      .query("xpEvents")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(RECENT_SCAN);
    // Earned-only: shop purchases are spending, not negative progress.
    let xpToday = 0;
    for (const e of events) {
      if (e.reason === "purchase") continue;
      if (israelDate(e.createdAt) === today) xpToday += e.amount;
    }

    return {
      goal,
      answeredToday,
      correctToday,
      xpToday,
      goalReached: answeredToday >= goal,
      streak,
    };
  },
});

export const setDailyGoal = mutation({
  args: { studentId: v.id("students"), goal: v.number() },
  handler: async (ctx, { studentId, goal }) => {
    const clamped = Math.max(
      MIN_DAILY_GOAL,
      Math.min(MAX_DAILY_GOAL, Math.round(goal)),
    );
    await ctx.db.patch(studentId, { dailyGoal: clamped });
    return { goal: clamped };
  },
});

// End-of-session recap. Reads the session row and its attempts within the
// session window, computing XP from the same xpForAttempt() the awarder uses.
export const getSessionSummary = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;

    const student = await ctx.db.get(session.studentId);
    const streak = student?.streak ?? 0;

    const endedAt = session.endedAt ?? Date.now();
    const durationMs = Math.max(0, endedAt - session.startedAt);

    // Pull this student's recent attempts and keep the ones inside the session
    // window — the attempt schema has no sessionId, so we bound by time.
    const recent = await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", session.studentId))
      .order("desc")
      .take(RECENT_SCAN);
    const inWindow = recent.filter(
      (a) => a._creationTime >= session.startedAt && a._creationTime <= endedAt,
    );

    // Prefer the live attempt-derived numbers; fall back to the denormalized
    // session counters if the window scan came up empty.
    const attempted = inWindow.length || session.questionsAttempted;
    const correct = inWindow.length
      ? inWindow.filter((a) => a.isCorrect).length
      : session.correctCount;
    const xpEarned = inWindow.reduce(
      (sum, a) => sum + xpForAttempt(a.isCorrect, a.difficulty),
      0,
    );
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

    return {
      attempted,
      correct,
      accuracy,
      xpEarned,
      durationMs,
      streak,
      topicId: session.topicId,
    };
  },
});

// Mark the current (open) session as ended so the recap has a stable window.
// Best-effort: if there is no open session, returns null.
export const endSession = mutation({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .first();
    if (!session || session.endedAt) return session?._id ?? null;
    await ctx.db.patch(session._id, { endedAt: Date.now() });
    return session._id;
  },
});
