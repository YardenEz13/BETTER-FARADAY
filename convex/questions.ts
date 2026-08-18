import { query } from "./_generated/server";
import { v } from "convex/values";

export const getNextQuestion = query({
  args: {
    studentId: v.id("students"),
    topicId: v.id("topics"),
    questionKey: v.optional(v.number()),
  },
  handler: async (ctx, { studentId, topicId }) => {
    // Every question this student has ever gotten right, in this topic — a
    // permanent exclusion, not just a recent-history one. The bank is now big
    // enough (packet pipeline, ~60+/topic) that re-solving mastered ground is
    // wasted practice, not spaced repetition; a wrong attempt stays eligible so
    // it can resurface until the student actually gets it.
    const topicAttempts = await ctx.db
      .query("attempts")
      .withIndex("by_student_topic", (q) => q.eq("studentId", studentId).eq("topicId", topicId))
      .collect();
    const solvedIds = new Set(topicAttempts.filter((a) => a.isCorrect).map((a) => a.questionId));

    // Last 10 across every topic — keeps a just-answered question (right or
    // wrong) from bouncing right back on the very next pull.
    const recentAttempts = await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(10);
    const recentIds = new Set(recentAttempts.map((a) => a.questionId));

    // Compute current difficulty from last session
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .first();

    const difficulty = session?.currentDifficulty ?? 1;

    const pickRandom = <T,>(pool: T[]): T | null =>
      pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;

    const atDifficulty = await ctx.db
      .query("questions")
      .withIndex("by_topic_difficulty", (q) =>
        q.eq("topicId", topicId).eq("difficulty", difficulty)
      )
      .collect();

    const notSolved = (q: (typeof atDifficulty)[number]) => !solvedIds.has(q._id);
    const notRecent = (q: (typeof atDifficulty)[number]) => !recentIds.has(q._id);

    // Widen in stages, each one a random pick — never fall through to a
    // deterministic pick, and never leave the student's level while the level
    // still has anything unsolved to offer:
    //   1. at level, fresh                 2. at level, just not-yet-solved
    //   3. any level, fresh                4. any level, just not-yet-solved
    //   5. truly exhausted — repeat something, still at least not-recent
    let selectedQuestion =
      pickRandom(atDifficulty.filter((q) => notSolved(q) && notRecent(q))) ??
      pickRandom(atDifficulty.filter(notSolved));

    if (!selectedQuestion) {
      const all = await ctx.db
        .query("questions")
        .withIndex("by_topic", (q) => q.eq("topicId", topicId))
        .collect();

      selectedQuestion =
        pickRandom(all.filter((q) => notSolved(q) && notRecent(q))) ??
        pickRandom(all.filter(notSolved)) ??
        pickRandom(all.filter(notRecent)) ??
        pickRandom(all);
    }

    return selectedQuestion;
  },
});

export const getByTopic = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    return await ctx.db
      .query("questions")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .collect();
  },
});
