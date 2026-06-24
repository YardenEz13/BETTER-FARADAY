import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Mirrors the `draft` object on the teacherImportedQuestions table. Kept as a
// reusable validator so createImport / updateDraft stay in sync with the schema.
const draftValidator = v.object({
  format: v.string(), // "multiple_choice" | "fill_blank"
  topicId: v.optional(v.id("topics")),
  difficulty: v.number(),
  stem: v.string(),
  choices: v.array(v.string()),
  correctIndex: v.optional(v.number()),
  correctAnswer: v.optional(v.string()),
  solutionSteps: v.array(v.string()),
  hint: v.string(),
  explanation: v.string(),
});

// ── Create a staged import (called after the client-side Gemini extraction) ──
export const createImport = mutation({
  args: {
    classroomId: v.id("classrooms"),
    sourceType: v.string(), // "image" | "pdf"
    sourceName: v.optional(v.string()),
    rawExtractedText: v.optional(v.string()),
    draft: v.optional(draftValidator),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("teacherImportedQuestions", {
      classroomId: args.classroomId,
      createdAt: Date.now(),
      sourceType: args.sourceType,
      sourceName: args.sourceName,
      status: args.draft ? "review" : "failed",
      rawExtractedText: args.rawExtractedText,
      draft: args.draft,
    });
  },
});

// ── Teacher edits the extracted draft ──
export const updateDraft = mutation({
  args: {
    importId: v.id("teacherImportedQuestions"),
    draft: draftValidator,
  },
  handler: async (ctx, { importId, draft }) => {
    const row = await ctx.db.get(importId);
    if (!row) throw new Error("Import not found");
    await ctx.db.patch(importId, { draft, status: "review" });
  },
});

// ── Approve: publish the draft to a real, assignable question ──
// multiple_choice → `questions` row; fill_blank → single-section
// `compoundQuestions` row (both already render + assign via existing code).
export const approveImport = mutation({
  args: { importId: v.id("teacherImportedQuestions") },
  handler: async (ctx, { importId }) => {
    const row = await ctx.db.get(importId);
    if (!row) throw new Error("Import not found");
    if (!row.draft) throw new Error("אין טיוטה לאישור");

    // Idempotent: never publish twice.
    if (row.publishedQuestionId) {
      return { questionId: row.publishedQuestionId, compoundId: null };
    }
    if (row.publishedCompoundId) {
      return { questionId: null, compoundId: row.publishedCompoundId };
    }

    const d = row.draft;
    if (!d.topicId) throw new Error("יש לבחור נושא לפני אישור השאלה");
    if (!d.stem.trim()) throw new Error("נוסח השאלה ריק");

    if (d.format === "fill_blank") {
      const compoundId = await ctx.db.insert("compoundQuestions", {
        topicIds: [d.topicId],
        difficulty: d.difficulty,
        tags: [],
        preamble: "",
        preambleParams: [],
        sections: [
          {
            label: "א",
            prompt: d.stem,
            answerType: "expression",
            correctAnswer: d.correctAnswer ?? "",
            solutionSteps: d.solutionSteps,
            hints: d.hint ? [d.hint] : [],
            points: 100,
            skillsTested: [],
          },
        ],
        fullSolution: d.explanation,
      });
      await ctx.db.patch(importId, { status: "approved", publishedCompoundId: compoundId });
      return { questionId: null, compoundId };
    }

    // multiple_choice
    const questionId = await ctx.db.insert("questions", {
      topicId: d.topicId,
      difficulty: d.difficulty,
      stem: d.stem,
      choices: d.choices,
      correctIndex: d.correctIndex ?? 0,
      solutionSteps: d.solutionSteps,
      hint: d.hint,
      explanation: d.explanation,
    });
    await ctx.db.patch(importId, { status: "approved", publishedQuestionId: questionId });
    return { questionId, compoundId: null };
  },
});

// ── Discard a staged import ──
export const discardImport = mutation({
  args: { importId: v.id("teacherImportedQuestions") },
  handler: async (ctx, { importId }) => {
    const row = await ctx.db.get(importId);
    if (!row) return;
    await ctx.db.patch(importId, { status: "discarded" });
  },
});

// ── List imports for a classroom, optionally filtered by status ──
export const listImports = query({
  args: {
    classroomId: v.id("classrooms"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { classroomId, status }) => {
    if (status) {
      return await ctx.db
        .query("teacherImportedQuestions")
        .withIndex("by_classroom_status", (q) =>
          q.eq("classroomId", classroomId).eq("status", status)
        )
        .order("desc")
        .take(50);
    }
    return await ctx.db
      .query("teacherImportedQuestions")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .order("desc")
      .take(50);
  },
});
