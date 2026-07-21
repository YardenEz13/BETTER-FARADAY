import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
