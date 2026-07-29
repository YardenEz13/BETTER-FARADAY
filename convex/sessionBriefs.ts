import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
      autonomyLevel: v.optional(v.number()),
    })),
    approach: v.string(),
    frictionPoints: v.array(v.string()),
    autonomyLevel: v.number(),
    solutionAccuracy: v.number(),
    keyInsight: v.string(),
    recommendedAction: v.optional(v.string()),
    // Teacher-enriched analytics
    missingConcepts: v.optional(v.array(v.string())),
    teacherActionItem: v.optional(v.string()),
    studentQuotes: v.optional(v.array(v.string())),
    detailedStruggleAnalysis: v.optional(v.string()),
    nextSteps: v.optional(v.array(v.string())),
    selfAssessment: v.string(),
  },
  handler: async (ctx, args) => {
    const briefId = await ctx.db.insert("sessionBriefs", {
      ...args,
      createdAt: Date.now(),
    });
    // Event-driven power-map refresh (debounced per student) — replaces the
    // old recompute-power-maps cron.
    await ctx.scheduler.runAfter(0, internal.powerMap.requestRecompute, {
      studentId: args.studentId,
    });
    return briefId;
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

/**
 * Class picture for one conversation: which of this student's gaps are actually
 * *classroom* gaps. Answers the teacher's real question — "is this Noa, or is
 * this my lesson?" — which a single-student verdict can never settle.
 *
 * Bounded: one classroom (~30 students) × their 10 most recent briefs.
 */
export const getClassGapPicture = query({
  args: { chatId: v.id("aiChats"), sinceDays: v.optional(v.number()) },
  handler: async (ctx, { chatId, sinceDays }) => {
    const chat = await ctx.db.get(chatId);
    if (!chat) return null;
    const student = await ctx.db.get(chat.studentId);
    if (!student) return null;

    const brief = await ctx.db
      .query("sessionBriefs")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .first();
    const mine = new Set([
      ...(brief?.missingConcepts ?? []),
      ...(chat.metrics?.missingKnowledge ?? []),
    ]);
    if (mine.size === 0) return { classmates: [], concepts: [], total: 0 };

    const cutoff = Date.now() - (sinceDays ?? 7) * 86_400_000;
    const classmates = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", student.classroomId))
      .take(200);

    // concept → the students who hit it (this student included, so the count
    // the teacher reads is "N students", not "N others").
    const byConcept = new Map<string, Map<string, string>>();
    for (const s of classmates) {
      const briefs = await ctx.db
        .query("sessionBriefs")
        .withIndex("by_student", (q) => q.eq("studentId", s._id))
        .order("desc")
        .take(10);
      for (const b of briefs) {
        if (b.createdAt < cutoff) continue;
        for (const c of b.missingConcepts ?? []) {
          if (!mine.has(c)) continue;
          if (!byConcept.has(c)) byConcept.set(c, new Map());
          byConcept.get(c)!.set(s._id, s.name);
        }
      }
    }

    const concepts = [...byConcept.entries()]
      .map(([concept, who]) => ({
        concept,
        count: who.size,
        names: [...who.values()].slice(0, 6),
      }))
      .filter((c) => c.count > 1) // a gap only one student has is not a class gap
      .sort((a, b) => b.count - a.count);

    return {
      concepts,
      // The widest shared gap drives the headline; the avatar stack shows who.
      classmates: concepts[0]?.names ?? [],
      total: concepts[0]?.count ?? 0,
    };
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
