import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Student queries
// Login name-picker (RolePage). Projects to {_id, name} so the subscription
// doesn't ship every student field (xp, streaks, themes…) to a pre-login page.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    return students.map((s) => ({ _id: s._id, name: s.name }));
  },
});

export const get = query({
  args: { id: v.id("students") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getByClassroom = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    return await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();
  },
});

// getClassroomHeatmap / getLiveAlerts lived here. Both were read only by
// the standalone HeatmapView page, which the command-center dashboard
// replaced — commandCenter.getCommandCenter now returns the mastery grid
// and the live ticker in a single pass.

// Get first classroom
export const getFirstClassroom = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("classrooms").first();
  },
});

// ── Teacher: add a new student to a classroom ──
// Students otherwise only exist via the seed script; this lets a teacher
// create one (e.g. אלמוג עציוני) straight from the dashboard.
const AVATAR_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#06b6d4", "#ef4444", "#6366f1", "#14b8a6", "#f97316",
];

export const addStudent = mutation({
  args: {
    classroomId: v.id("classrooms"),
    name: v.string(),
    homeworkTheme: v.optional(v.string()),
  },
  handler: async (ctx, { classroomId, name, homeworkTheme }) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("שם התלמיד ריק");
    // Spread avatar colors deterministically by current roster size.
    const existing = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();
    const avatarColor = AVATAR_COLORS[existing.length % AVATAR_COLORS.length];
    return await ctx.db.insert("students", {
      name: trimmed,
      classroomId,
      avatarColor,
      streak: 0,
      level: 1,
      homeworkTheme: homeworkTheme?.trim() || undefined,
    });
  },
});

// Update a student's homework theme preference
export const updateStudentTheme = mutation({
  args: {
    studentId: v.id("students"),
    theme: v.optional(v.string()), // pass undefined to clear the theme
  },
  handler: async (ctx, { studentId, theme }) => {
    await ctx.db.patch(studentId, { homeworkTheme: theme });
  },
});

// Milestones + class speed used to live here as getDashboardStats; the teacher
// dashboard reads both from commandCenter.getCommandCenter's ticker instead,
// which builds them in the same pass as the rest of the dashboard payload.

// ── Right-to-erasure: delete a student and everything about them ──────────
// src/pages/Legal.tsx promises access, correction and deletion on request to
// the contact address. Nothing in the app could perform the deletion half —
// this is it. Run by the operator who receives the request:
//
//   npx convex run classroom:purgeStudent '{"studentId":"..."}' --prod
//
// Internal on purpose: it is irreversible and there is no auth yet, so it must
// not be reachable from the browser. The return value is the per-table row
// count, which is also the record that the request was honoured.
//
// Anything holding this student's identity or work gets deleted; the teacher's
// aggregate analytics rows (rundowns, weekly digests) survive with the
// student's entries filtered out of them, because deleting a whole classroom
// digest to erase one student would destroy other students' data.
export const purgeStudent = internalMutation({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error(`No student ${studentId}`);
    const deleted: Record<string, number> = {};

    const purgeByStudentIndex = async (
      table: "attempts" | "hintRequests" | "sessions" | "sessionBriefs" | "studentPowerMap"
        | "examAttempts" | "assignedQuestions" | "levelSuggestions"
        | "xpEvents" | "notificationReads" | "purchases",
    ) => {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_student", (q) => q.eq("studentId", studentId))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
      deleted[table] = rows.length;
    };

    for (const table of [
      "attempts", "hintRequests", "sessions", "sessionBriefs", "studentPowerMap",
      "examAttempts", "assignedQuestions", "levelSuggestions",
      "xpEvents", "notificationReads", "purchases",
    ] as const) {
      await purgeByStudentIndex(table);
    }

    // Chats carry the transcripts — the messages hang off the chat, not the
    // student, so they have to go first or they are orphaned forever.
    const chats = await ctx.db
      .query("aiChats")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    let messages = 0;
    for (const chat of chats) {
      const msgs = await ctx.db
        .query("aiMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
        .collect();
      for (const m of msgs) { await ctx.db.delete(m._id); messages++; }
      await ctx.db.delete(chat._id);
    }
    deleted.aiChats = chats.length;
    deleted.aiMessages = messages;

    // PDF assignments hold cropped question images plus the student's own
    // written answers, one level down.
    const pdfs = await ctx.db
      .query("pdfAssignments")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    let pdfQuestions = 0;
    for (const a of pdfs) {
      const qs = await ctx.db
        .query("pdfQuestions")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", a._id))
        .collect();
      for (const q of qs) { await ctx.db.delete(q._id); pdfQuestions++; }
      if (a.pdfStorageId) await ctx.storage.delete(a.pdfStorageId);
      await ctx.db.delete(a._id);
    }
    deleted.pdfAssignments = pdfs.length;
    deleted.pdfQuestions = pdfQuestions;

    // ponytail: bridgeSessions and liveAnswers have no by_student index, so
    // these are full scans. Both are swept/short-lived and pilot-sized; add an
    // index if either table ever grows past a few thousand rows.
    const bridges = (await ctx.db.query("bridgeSessions").collect())
      .filter((b) => b.studentId === studentId);
    for (const b of bridges) await ctx.db.delete(b._id);
    deleted.bridgeSessions = bridges.length;

    const liveAnswers = (await ctx.db.query("liveAnswers").collect())
      .filter((a) => a.studentId === studentId);
    for (const a of liveAnswers) await ctx.db.delete(a._id);
    deleted.liveAnswers = liveAnswers.length;

    // Targeted homework lists the student by id — drop them from the target
    // list, but leave the homework itself for the rest of the class.
    const homework = await ctx.db
      .query("homework")
      .withIndex("by_classroom", (q) => q.eq("classroomId", student.classroomId))
      .collect();
    let homeworkTargets = 0;
    for (const hw of homework) {
      if (!hw.studentIds?.some((id) => id === studentId)) continue;
      await ctx.db.patch(hw._id, { studentIds: hw.studentIds.filter((id) => id !== studentId) });
      homeworkTargets++;
    }
    deleted.homeworkTargetLists = homeworkTargets;

    // Teacher analytics blobs: strip this student out, keep the rest.
    let rundowns = 0;
    for (const hw of homework) {
      const rows = await ctx.db
        .query("homeworkRundowns")
        .withIndex("by_homework", (q) => q.eq("homeworkId", hw._id))
        .collect();
      for (const r of rows) {
        const clusters = r.clusters.map((c) => ({
          ...c,
          studentIds: c.studentIds.filter((id: Id<"students">) => id !== studentId),
        }));
        const flagged = r.flagged.filter((f) => f.studentId !== studentId);
        if (flagged.length === r.flagged.length &&
            clusters.every((c, i) => c.studentIds.length === r.clusters[i].studentIds.length)) continue;
        await ctx.db.patch(r._id, { clusters, flagged });
        rundowns++;
      }
    }
    deleted.homeworkRundowns = rundowns;

    const digests = await ctx.db
      .query("weeklyDigests")
      .withIndex("by_classroom", (q) => q.eq("classroomId", student.classroomId))
      .collect();
    let digestsPatched = 0;
    for (const d of digests) {
      const struggling = d.payload.struggling.filter((s) => s.studentId !== studentId);
      const improving = d.payload.improving.filter((s) => s.studentId !== studentId);
      // notableEvents name students by display name only — drop theirs too.
      const notableEvents = d.payload.notableEvents.filter((e) => e.who !== student.name);
      if (struggling.length === d.payload.struggling.length &&
          improving.length === d.payload.improving.length &&
          notableEvents.length === d.payload.notableEvents.length) continue;
      await ctx.db.patch(d._id, { payload: { ...d.payload, struggling, improving, notableEvents } });
      digestsPatched++;
    }
    deleted.weeklyDigests = digestsPatched;

    // Reports keep the questionId (the content signal the teacher still needs)
    // but must not keep pointing at a purged student.
    const reports = (await ctx.db.query("questionReports").collect())
      .filter((r) => r.studentId === studentId);
    for (const r of reports) await ctx.db.patch(r._id, { studentId: undefined });
    deleted.questionReportsAnonymized = reports.length;

    await ctx.db.delete(studentId);
    deleted.students = 1;

    console.log(`[purgeStudent] ${student.name} (${studentId}) purged:`, deleted);
    return deleted;
  },
});
