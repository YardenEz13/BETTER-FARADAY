import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Student queries
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("students").collect();
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
      const question = await ctx.db.get(qid as Id<"questions">) as any;
      const topic = question?.topicId ? await ctx.db.get(question.topicId) as any : null;
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
