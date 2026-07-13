import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ── Level names (for display) ──
// 1: מתחיל  2: חוקר  3: מתקדם  4: מומחה  5: מאסטר

// ── Evaluate a single student's level and create a suggestion if warranted ──
export const evaluateStudentLevel = internalMutation({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) return;

    const currentLevel = student.level ?? 1;

    // Gather evidence: topic mastery from power map
    const powerMap = await ctx.db
      .query("studentPowerMap")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .first();

    const topicMastery = powerMap?.topicMastery ?? [];
    const topicsMastered = topicMastery.filter((t) => t.masteryScore >= 70).length;
    const avgAccuracy =
      topicMastery.length > 0
        ? topicMastery.reduce((s, t) => s + t.avgAccuracy, 0) / topicMastery.length
        : 0;

    // Gather evidence: homework scores
    const assignedQuestions = await ctx.db
      .query("assignedQuestions")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    const submitted = assignedQuestions.filter((a) => a.status === "submitted" && a.score != null);
    const homeworkAvgScore =
      submitted.length > 0
        ? submitted.reduce((s, a) => s + (a.score ?? 0), 0) / submitted.length
        : 0;

    const recentStreak = student.streak;

    // Determine suggested level based on criteria
    // Level thresholds (designed to leave room for future auto-promote):
    //   2: mastery > 40% in 2+ topics
    //   3: mastery > 60% in 3+ topics AND homework avg >= 70
    //   4: mastery > 75% in 4+ topics AND homework avg >= 80
    //   5: mastery > 85% in ALL topics (minimum 3 topics with data)
    let suggestedLevel = 1;
    const masteredAt40 = topicMastery.filter((t) => t.masteryScore >= 40).length;
    const masteredAt60 = topicMastery.filter((t) => t.masteryScore >= 60).length;
    const masteredAt75 = topicMastery.filter((t) => t.masteryScore >= 75).length;
    const masteredAt85 = topicMastery.filter((t) => t.masteryScore >= 85).length;

    if (topicMastery.length >= 3 && masteredAt85 === topicMastery.length) {
      suggestedLevel = 5;
    } else if (masteredAt75 >= 4 && homeworkAvgScore >= 80) {
      suggestedLevel = 4;
    } else if (masteredAt60 >= 3 && homeworkAvgScore >= 70) {
      suggestedLevel = 3;
    } else if (masteredAt40 >= 2) {
      suggestedLevel = 2;
    }

    // Only create suggestion if it's an upgrade from current level
    if (suggestedLevel <= currentLevel) return;

    // Check if there's already a pending suggestion for this student
    const existingPending = await ctx.db
      .query("levelSuggestions")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .first();

    if (existingPending && existingPending.status === "pending" && existingPending.suggestedLevel >= suggestedLevel) {
      return; // already have a pending or higher suggestion
    }

    // Build reason string
    const reasons: string[] = [];
    if (topicsMastered > 0) reasons.push(`שולט ב-${topicsMastered} נושאים`);
    if (homeworkAvgScore > 0) reasons.push(`ציון ממוצע שיעורי בית: ${Math.round(homeworkAvgScore)}`);
    if (recentStreak >= 3) reasons.push(`רצף דיוק: ${recentStreak}`);

    await ctx.db.insert("levelSuggestions", {
      studentId,
      currentLevel,
      suggestedLevel,
      reason: reasons.join(" · ") || "שיפור כללי במדדים",
      evidence: {
        topicsMastered,
        avgAccuracy: Math.round(avgAccuracy * 10) / 10,
        homeworkAvgScore: Math.round(homeworkAvgScore),
        recentStreak,
      },
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// ── Get pending level suggestions for all students in a classroom ──
export const getPendingSuggestions = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();

    const suggestions = [];

    for (const student of students) {
      const pending = await ctx.db
        .query("levelSuggestions")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .order("desc")
        .first();

      if (pending && pending.status === "pending") {
        suggestions.push({
          ...pending,
          studentName: student.name,
          avatarColor: student.avatarColor,
        });
      }
    }

    return suggestions;
  },
});

// ── Teacher approves or rejects a level suggestion ──
export const resolveSuggestion = mutation({
  args: {
    suggestionId: v.id("levelSuggestions"),
    action: v.union(v.literal("approved"), v.literal("rejected")),
    resolvedBy: v.optional(v.string()),
  },
  handler: async (ctx, { suggestionId, action, resolvedBy }) => {
    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion || suggestion.status !== "pending") return;

    await ctx.db.patch(suggestionId, {
      status: action,
      resolvedAt: Date.now(),
      resolvedBy: resolvedBy ?? "teacher",
    });

    // If approved, update the student's level
    if (action === "approved") {
      await ctx.db.patch(suggestion.studentId, {
        level: suggestion.suggestedLevel,
      });
    }
  },
});

// ── Scheduled: evaluate all students for level-up ──
export const scheduledEvaluateAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Only evaluate students that have power map data
    const allMaps = await ctx.db.query("studentPowerMap").collect();
    for (const map of allMaps) {
      await ctx.scheduler.runAfter(0, internal.levels.evaluateStudentLevel, {
        studentId: map.studentId,
      });
    }
  },
});

// ── Backfill: set level=1 for all students that don't have a level yet ──
export const backfillLevels = internalMutation({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    for (const student of students) {
      if (student.level == null) {
        await ctx.db.patch(student._id, { level: 1 });
      }
    }
  },
});
