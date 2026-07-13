import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Live class mode (שיעור חי) — the teacher pushes one question to the whole
 * classroom and watches answers land in real time. Convex reactivity keeps
 * both sides in sync with no polling.
 */

// ── Teacher: start a session (ends any previous active one) ──
export const start = mutation({
  args: { classroomId: v.id("classrooms"), questionId: v.id("questions") },
  handler: async (ctx, { classroomId, questionId }) => {
    const existing = await ctx.db
      .query("liveSessions")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    for (const s of existing) {
      await ctx.db.patch(s._id, { status: "ended", endedAt: Date.now() });
    }
    return await ctx.db.insert("liveSessions", {
      classroomId,
      questionId,
      status: "active",
      startedAt: Date.now(),
    });
  },
});

export const end = mutation({
  args: { sessionId: v.id("liveSessions") },
  handler: async (ctx, { sessionId }) => {
    const s = await ctx.db.get(sessionId);
    if (!s || s.status !== "active") return;
    await ctx.db.patch(sessionId, { status: "ended", endedAt: Date.now() });
  },
});

// ── Student: one answer per session ──
export const submitAnswer = mutation({
  args: {
    sessionId: v.id("liveSessions"),
    studentId: v.id("students"),
    choiceIndex: v.number(),
  },
  handler: async (ctx, { sessionId, studentId, choiceIndex }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.status !== "active") throw new Error("השיעור החי הסתיים.");
    const already = await ctx.db
      .query("liveAnswers")
      .withIndex("by_session_student", (q) => q.eq("sessionId", sessionId).eq("studentId", studentId))
      .unique();
    if (already) throw new Error("כבר ענית על השאלה הזו.");
    const question = await ctx.db.get(session.questionId);
    if (!question) throw new Error("השאלה לא נמצאה.");
    const isCorrect = choiceIndex === question.correctIndex;
    await ctx.db.insert("liveAnswers", {
      sessionId,
      studentId,
      choiceIndex,
      isCorrect,
      answeredAt: Date.now(),
    });
    return { isCorrect };
  },
});

// ── Teacher: live results — histogram + who answered ──
export const getResults = query({
  args: { sessionId: v.id("liveSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    const question = await ctx.db.get(session.questionId);
    if (!question) return null;
    const answers = await ctx.db
      .query("liveAnswers")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", session.classroomId))
      .collect();

    const counts = question.choices.map((_, i) => answers.filter((a) => a.choiceIndex === i).length);
    const nameOf = new Map(students.map((s) => [s._id as string, s.name]));
    return {
      status: session.status,
      startedAt: session.startedAt,
      stem: question.stem,
      choices: question.choices,
      correctIndex: question.correctIndex,
      counts,
      answered: answers.length,
      total: students.length,
      correct: answers.filter((a) => a.isCorrect).length,
      answeredNames: answers
        .sort((a, b) => a.answeredAt - b.answeredAt)
        .map((a) => ({ name: nameOf.get(a.studentId as string) ?? "תלמיד", isCorrect: a.isCorrect })),
    };
  },
});

// ── Student: is there a live question for my classroom right now? ──
export const getActiveForStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) return null;
    const session = await ctx.db
      .query("liveSessions")
      .withIndex("by_classroom", (q) => q.eq("classroomId", student.classroomId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (!session) return null;
    const question = await ctx.db.get(session.questionId);
    if (!question) return null;
    const mine = await ctx.db
      .query("liveAnswers")
      .withIndex("by_session_student", (q) => q.eq("sessionId", session._id).eq("studentId", studentId))
      .unique();
    return {
      sessionId: session._id,
      stem: question.stem,
      choices: question.choices,
      answered: !!mine,
      wasCorrect: mine?.isCorrect ?? null,
    };
  },
});

// ── Teacher: the classroom's current active session (to resume the panel) ──
export const getActiveForClassroom = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    const session = await ctx.db
      .query("liveSessions")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    return session ? { sessionId: session._id } : null;
  },
});
