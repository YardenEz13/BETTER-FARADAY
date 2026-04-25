import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Create a composite brief when a chat ends ──
export const createBrief = mutation({
  args: {
    chatId: v.id("aiChats"),
    studentId: v.id("students"),
    topicId: v.optional(v.id("topics")),
    totalCycles: v.number(),
    totalMessages: v.number(),
    totalDurationMs: v.number(),
    partialBriefs: v.array(v.object({
      sessionIndex: v.number(),
      messageCount: v.number(),
      durationMs: v.number(),
      summary: v.string(),
      triggerReason: v.string(),
    })),
    approach: v.string(),
    frictionPoints: v.array(v.string()),
    autonomyLevel: v.number(),
    solutionAccuracy: v.number(),
    keyInsight: v.string(),
    recommendedAction: v.optional(v.string()),
    selfAssessment: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessionBriefs", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// ── Get all briefs for a student (most recent first) ──
export const getBriefsForStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    return await ctx.db
      .query("sessionBriefs")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(50);
  },
});

// ── Get all briefs for a student + topic ──
export const getBriefsForStudentTopic = query({
  args: {
    studentId: v.id("students"),
    topicId: v.id("topics"),
  },
  handler: async (ctx, { studentId, topicId }) => {
    return await ctx.db
      .query("sessionBriefs")
      .withIndex("by_student_topic", (q) =>
        q.eq("studentId", studentId).eq("topicId", topicId)
      )
      .order("desc")
      .take(50);
  },
});

// ── Get brief for a specific chat ──
export const getBriefForChat = query({
  args: { chatId: v.id("aiChats") },
  handler: async (ctx, { chatId }) => {
    return await ctx.db
      .query("sessionBriefs")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .first();
  },
});
