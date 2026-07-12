import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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

// Classroom heatmap: returns students with computed status
export const getClassroomHeatmap = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();

    const result = [];
    for (const s of students) {
      // Get last 5 attempts
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_student", (q) => q.eq("studentId", s._id))
        .order("desc")
        .take(5);

      // Get last hint request
      const lastHint = await ctx.db
        .query("hintRequests")
        .withIndex("by_student", (q) => q.eq("studentId", s._id))
        .order("desc")
        .first();

      // Compute status
      let status: "green" | "yellow" | "red" = "green";
      if (attempts.length === 0) {
        status = "yellow";
      } else {
        const correct = attempts.filter((a) => a.isCorrect).length;
        const ratio = correct / attempts.length;
        const recentlyStuck = lastHint && Date.now() - lastHint._creationTime < 5 * 60 * 1000;
        if (ratio < 0.4 || recentlyStuck) status = "red";
        else if (ratio < 0.7) status = "yellow";
        else status = "green";
      }

      const currentTopic = s.currentTopicId ? await ctx.db.get(s.currentTopicId) : null;

      result.push({
        student: s,
        status,
        currentTopicName: currentTopic?.name ?? "Not started",
        recentAttempts: attempts,
        isStuck: !!lastHint && Date.now() - lastHint._creationTime < 3 * 60 * 1000,
      });
    }
    return result;
  },
});

// Live alerts: students currently stuck
export const getLiveAlerts = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();

    const studentIds = new Set(students.map((s) => s._id));
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;

    // get recent hint requests
    const recentHints = await ctx.db.query("hintRequests").order("desc").take(50);
    const filtered = recentHints.filter(
      (h) => studentIds.has(h.studentId) && h._creationTime > fiveMinAgo
    );

    // Group by questionId
    const byQuestion: Record<string, { count: number; studentNames: string[]; questionId: string }> = {};
    for (const h of filtered) {
      const qid = h.questionId;
      if (!byQuestion[qid]) byQuestion[qid] = { count: 0, studentNames: [], questionId: qid };
      const student = students.find((s) => s._id === h.studentId);
      if (student && !byQuestion[qid].studentNames.includes(student.name)) {
        byQuestion[qid].studentNames.push(student.name);
      }
      byQuestion[qid].count++;
    }

    // Enrich with question stem
    const alerts = [];
    for (const qid of Object.keys(byQuestion)) {
      const question = await ctx.db.get(qid as Id<"questions">);
      const topic = question?.topicId ? await ctx.db.get(question.topicId) : null;
      alerts.push({
        ...byQuestion[qid],
        questionStem: (question?.stem as string | undefined)?.slice(0, 60) ?? "Unknown question",
        topicName: (topic?.name as string | undefined) ?? "",
        count: byQuestion[qid].studentNames.length,
      });
    }

    return alerts.sort((a, b) => b.count - a.count);
  },
});

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

// Get dashboard real-time stats
export const getDashboardStats = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    // We only want data for students in this classroom
    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();
    const studentIds = new Set(students.map(s => s._id));

    // Recent attempts across the class
    const allRecentAttempts = await ctx.db.query("attempts").order("desc").take(100);
    const classAttempts = allRecentAttempts.filter(a => studentIds.has(a.studentId));

    // Build milestones (last 5 actions)
    const milestones = [];
    for (const a of classAttempts.slice(0, 5)) {
      const student = students.find(s => s._id === a.studentId);
      const question = await ctx.db.get(a.questionId);
      const topic = question?.topicId ? await ctx.db.get(question.topicId) : null;

      milestones.push({
        studentName: student?.name ?? "תלמיד",
        action: a.isCorrect ? "השלים שאלה" : "טעה בשאלה",
        topicName: topic?.name ?? "נושא כללי",
        timestamp: a._creationTime,
        isCorrect: a.isCorrect
      });
    }

    // Calculate global speed
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const attemptsLastHour = classAttempts.filter(a => a._creationTime > oneHourAgo).length;
    // Speed = attempts per minute
    const speed = +(attemptsLastHour / 60).toFixed(1);

    return {
      milestones,
      globalSpeed: speed
    };
  },
});
