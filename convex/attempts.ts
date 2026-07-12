import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { awardXpHelper, xpForAttempt } from "./xp";
import { touchStreakHelper } from "./streaks";
import { maybeAwardDailyGoalHelper } from "./goals";

export const submitAttempt = mutation({
  args: {
    studentId: v.id("students"),
    questionId: v.id("questions"),
    topicId: v.id("topics"),
    choiceIndex: v.number(),
    isCorrect: v.boolean(),
    timeMs: v.number(),
    hintsUsed: v.number(),
    difficulty: v.number(),
  },
  handler: async (ctx, args) => {
    // Record attempt
    await ctx.db.insert("attempts", {
      studentId: args.studentId,
      questionId: args.questionId,
      topicId: args.topicId,
      isCorrect: args.isCorrect,
      choiceIndex: args.choiceIndex,
      timeMs: args.timeMs,
      hintsUsed: args.hintsUsed,
      difficulty: args.difficulty,
    });

    // Update or create session
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .order("desc")
      .first();

    let newDifficulty = args.difficulty;
    if (args.isCorrect && args.hintsUsed === 0 && args.timeMs < 30000) {
      newDifficulty = Math.min(5, args.difficulty + 1);
    } else if (!args.isCorrect) {
      newDifficulty = Math.max(1, args.difficulty - 1);
    }

    let sessionId;
    if (session && !session.endedAt) {
      await ctx.db.patch(session._id, {
        questionsAttempted: session.questionsAttempted + 1,
        correctCount: session.correctCount + (args.isCorrect ? 1 : 0),
        currentDifficulty: newDifficulty,
      });
      sessionId = session._id;
    } else {
      sessionId = await ctx.db.insert("sessions", {
        studentId: args.studentId,
        topicId: args.topicId,
        startedAt: Date.now(),
        questionsAttempted: 1,
        correctCount: args.isCorrect ? 1 : 0,
        currentDifficulty: newDifficulty,
      });
    }

    // Update student's current topic
    await ctx.db.patch(args.studentId, { currentTopicId: args.topicId });

    // Gamification: award XP for the attempt and keep the streak alive.
    await awardXpHelper(
      ctx,
      args.studentId,
      xpForAttempt(args.isCorrect, args.difficulty),
      args.isCorrect ? "attempt_correct" : "attempt_wrong",
      args.questionId,
    );
    await touchStreakHelper(ctx, args.studentId);

    // Daily-goal bonus: award once when the day's attempt count crosses the goal.
    const dailyGoalReached = await maybeAwardDailyGoalHelper(ctx, args.studentId);

    return { newDifficulty, sessionId, dailyGoalReached };
  },
});

export const getStudentStats = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    // Bounded: subscribed by every student's home screen and re-run on each
    // answer. The most recent 500 attempts are indistinguishable in the UI
    // from all-time, and the read stays flat as the table grows.
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(500);

    const byTopic: Record<string, { correct: number; total: number; avgTime: number; totalTime: number }> = {};

    for (const a of attempts) {
      const tid = a.topicId;
      if (!byTopic[tid]) byTopic[tid] = { correct: 0, total: 0, avgTime: 0, totalTime: 0 };
      byTopic[tid].total++;
      if (a.isCorrect) byTopic[tid].correct++;
      byTopic[tid].totalTime += a.timeMs;
    }

    for (const tid in byTopic) {
      byTopic[tid].avgTime = byTopic[tid].totalTime / byTopic[tid].total;
    }

    return { byTopic, totalAttempts: attempts.length };
  },
});

export const getRecentAttempts = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    return await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(20);
  },
});

export const getQuestionFailureRates = query({
  args: {},
  handler: async (ctx) => {
    const questions = await ctx.db.query("questions").take(500);
    const result = [];
    for (const q of questions) {
      // Recent attempts are enough for a failure-rate signal — unbounded
      // per-question scans would make this a full-table sweep.
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_question", (a) => a.eq("questionId", q._id))
        .order("desc")
        .take(100);
      if (attempts.length === 0) continue;
      const wrong = attempts.filter((a) => !a.isCorrect).length;
      result.push({
        questionId: q._id,
        stem: q.stem.slice(0, 50) + "...",
        topicId: q.topicId,
        failureRate: wrong / attempts.length,
        attempts: attempts.length,
      });
    }
    return result.sort((a, b) => b.failureRate - a.failureRate);
  },
});
