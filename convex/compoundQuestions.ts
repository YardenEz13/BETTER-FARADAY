import { query } from "./_generated/server";
import { v } from "convex/values";

// ── Get a single compound question by ID ──
export const getById = query({
  args: { id: v.id("compoundQuestions") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// ── Get compound questions filtered by difficulty ──
export const getByDifficulty = query({
  args: { difficulty: v.number() },
  handler: async (ctx, { difficulty }) => {
    return await ctx.db
      .query("compoundQuestions")
      .withIndex("by_difficulty", (q) => q.eq("difficulty", difficulty))
      .take(20);
  },
});

// ── Get all compound questions (bounded) ──
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("compoundQuestions").take(50);
  },
});

// ── Signed URL for a compound question's scanned figure (packet import) ──
export const getFigureUrl = query({
  args: { id: v.id("compoundQuestions") },
  handler: async (ctx, { id }) => {
    const q = await ctx.db.get(id);
    if (!q?.figureImageStorageId) return null;
    return await ctx.storage.getUrl(q.figureImageStorageId);
  },
});

// ── Get compound questions that match any of the given topic IDs ──
export const getByTopics = query({
  args: { topicIds: v.array(v.id("topics")) },
  handler: async (ctx, { topicIds }) => {
    // compoundQuestions store topicIds as an array, so we fetch all and filter
    // This is acceptable since compound questions are a curated, small set
    const all = await ctx.db.query("compoundQuestions").take(100);
    const topicSet = new Set(topicIds);
    return all.filter((q) =>
      q.topicIds.some((tid) => topicSet.has(tid))
    );
  },
});
