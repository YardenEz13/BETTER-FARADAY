// ── "This question is wrong" reports ─────────────────────────────────────
// Every question in the bank is machine-authored — seeded, packet-imported, or
// written by the questionGen cron — and nothing between generation and a
// student's screen can prove the answer key is right. This is the detector:
// the people looking at the question say so, and it surfaces on the teacher
// dashboard in minutes instead of at the pilot post-mortem.
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

/** Report reasons. Keys are stored; Hebrew labels live in the UI. */
export const REPORT_REASONS = ["wrong_answer", "unclear", "broken_math", "other"] as const;

const NOTE_MAX = 300;

export const report = mutation({
  args: {
    questionId: v.string(),
    studentId: v.optional(v.id("students")),
    reason: v.union(...REPORT_REASONS.map((r) => v.literal(r))),
    note: v.optional(v.string()),
    route: v.string(),
  },
  handler: async (ctx, { questionId, studentId, reason, note, route }) => {
    // One open report per reporter per question — a student hitting the button
    // twice shouldn't inflate the count the teacher triages on.
    const existing = await ctx.db
      .query("questionReports")
      .withIndex("by_question", (q) => q.eq("questionId", questionId))
      .collect();
    const mine = existing.find((r) => r.studentId === studentId && r.resolvedAt === undefined);
    if (mine) return mine._id;

    return await ctx.db.insert("questionReports", {
      questionId,
      studentId,
      reason,
      note: note?.trim().slice(0, NOTE_MAX) || undefined,
      route,
      createdAt: Date.now(),
    });
  },
});

/** Open reports, newest first, with enough question text to act on. */
export const listOpen = query({
  args: {},
  handler: async (ctx) => {
    const open = await ctx.db
      .query("questionReports")
      .withIndex("by_resolved", (q) => q.eq("resolvedAt", undefined))
      .order("desc")
      .take(50);

    const out = [];
    for (const r of open) {
      // questionId addresses either table, and normalizeId returns null when
      // the string isn't an id for that table — that's the discriminator.
      const legacyId = ctx.db.normalizeId("questions", r.questionId);
      const compoundId = ctx.db.normalizeId("compoundQuestions", r.questionId);
      let text = "(שאלה נמחקה)";
      if (legacyId) {
        const q: Doc<"questions"> | null = await ctx.db.get(legacyId);
        if (q) text = q.stem;
      } else if (compoundId) {
        const q: Doc<"compoundQuestions"> | null = await ctx.db.get(compoundId);
        if (q) text = q.preamble;
      }

      const student = r.studentId ? await ctx.db.get(r.studentId) : null;
      out.push({
        _id: r._id,
        questionId: r.questionId,
        reason: r.reason,
        note: r.note,
        route: r.route,
        createdAt: r.createdAt,
        studentName: student?.name ?? "מורה",
        questionText: text,
      });
    }
    return out;
  },
});

/** Teacher clears a report once the question is fixed or judged fine. */
export const resolve = mutation({
  args: { reportId: v.id("questionReports") },
  handler: async (ctx, { reportId }) => {
    await ctx.db.patch(reportId, { resolvedAt: Date.now() });
  },
});
