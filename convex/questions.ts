import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("topics").collect();
  },
});

export const getNextQuestion = query({
  args: { studentId: v.id("students"), topicId: v.id("topics") },
  handler: async (ctx, { studentId, topicId }) => {
    // Find recently attempted question IDs
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

    let difficulty = session?.currentDifficulty ?? 1;

    // Try to find a question at this difficulty not recently attempted
    const allAtDifficulty = await ctx.db
      .query("questions")
      .withIndex("by_topic_difficulty", (q) =>
        q.eq("topicId", topicId).eq("difficulty", difficulty)
      )
      .collect();

    const candidates = allAtDifficulty.filter((q) => !recentIds.has(q._id));

    if (candidates.length > 0) {
      const idx = Math.floor(Math.random() * candidates.length);
      return candidates[idx];
    }

    // Fallback: any question in topic
    const all = await ctx.db
      .query("questions")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .collect();

    const fallback = all.filter((q) => !recentIds.has(q._id));
    if (fallback.length === 0) return all[0] ?? null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  },
});

export const getQuestion = query({
  args: { id: v.id("questions") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
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
