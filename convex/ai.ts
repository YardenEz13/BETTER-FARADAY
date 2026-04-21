import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const generateHint = mutation({
  args: {
    studentId: v.id("students"),
    questionId: v.id("questions"),
    studentInput: v.string(),
  },
  handler: async (ctx, { studentId, questionId, studentInput }) => {
    const question = await ctx.db.get(questionId);
    if (!question) throw new Error("Question not found");

    // Generate a mock contextual hint based on the question's actual hint field
    // In production: call Gemini API with question.stem, question.solutionSteps, and studentInput
    const mockHint = question.hint;

    await ctx.db.insert("hintRequests", {
      studentId,
      questionId,
      studentInput: studentInput || "(no input)",
      aiHint: mockHint,
    });

    return { hint: mockHint };
  },
});

export const getStudentHints = mutation({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    return await ctx.db
      .query("hintRequests")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(10);
  },
});
