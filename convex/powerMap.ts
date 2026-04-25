import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ── Recompute the power map for a single student ──
export const recomputePowerMap = internalMutation({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    // Get all briefs for this student
    const briefs = await ctx.db
      .query("sessionBriefs")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .collect();

    if (briefs.length === 0) return;

    // Get all topics
    const topics = await ctx.db.query("topics").collect();

    // ── Topic Mastery ──
    const topicMastery = [];
    for (const topic of topics) {
      const topicBriefs = briefs.filter((b) => b.topicId === topic._id);
      if (topicBriefs.length === 0) continue;

      const avgAccuracy =
        topicBriefs.reduce((s, b) => s + b.solutionAccuracy, 0) / topicBriefs.length;
      const avgAutonomy =
        topicBriefs.reduce((s, b) => s + b.autonomyLevel, 0) / topicBriefs.length;
      const totalFriction = topicBriefs.reduce(
        (s, b) => s + b.frictionPoints.length, 0
      );

      // Trend: compare last 3 vs. previous 3
      let trend: "improving" | "stable" | "declining" = "stable";
      if (topicBriefs.length >= 4) {
        const recent = topicBriefs.slice(0, 3);
        const older = topicBriefs.slice(3, 6);
        const recentAvg = recent.reduce((s, b) => s + b.solutionAccuracy, 0) / recent.length;
        const olderAvg = older.reduce((s, b) => s + b.solutionAccuracy, 0) / older.length;
        if (recentAvg - olderAvg > 0.5) trend = "improving";
        else if (olderAvg - recentAvg > 0.5) trend = "declining";
      }

      topicMastery.push({
        topicId: topic._id,
        topicName: topic.nameHe || topic.name,
        masteryScore: Math.round(avgAccuracy * 20), // 1-5 → 0-100
        errorFrequency: Math.round((totalFriction / topicBriefs.length) * 10) / 10,
        avgAccuracy: Math.round(avgAccuracy * 10) / 10,
        sessionCount: topicBriefs.length,
        lastSessionAt: topicBriefs[0].createdAt,
        trend,
      });
    }

    // ── Progress Velocity ──
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const weeklySnapshots = [];

    for (let w = 0; w < 8; w++) {
      const weekStart = now - (w + 1) * oneWeek;
      const weekEnd = now - w * oneWeek;
      const weekBriefs = briefs.filter(
        (b) => b.createdAt >= weekStart && b.createdAt < weekEnd
      );
      if (weekBriefs.length === 0) continue;

      const frictions = weekBriefs.flatMap((b) => b.frictionPoints);
      const frictionCounts: Record<string, number> = {};
      for (const f of frictions) {
        frictionCounts[f] = (frictionCounts[f] || 0) + 1;
      }
      const topFriction =
        Object.entries(frictionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

      weeklySnapshots.push({
        weekStart,
        avgAccuracy:
          Math.round(
            (weekBriefs.reduce((s, b) => s + b.solutionAccuracy, 0) / weekBriefs.length) * 10
          ) / 10,
        avgAutonomy:
          Math.round(
            (weekBriefs.reduce((s, b) => s + b.autonomyLevel, 0) / weekBriefs.length) * 10
          ) / 10,
        sessionCount: weekBriefs.length,
        topFriction,
      });
    }

    // Compute deltas (this week vs. last week)
    const thisWeekBriefs = briefs.filter((b) => b.createdAt >= now - oneWeek);
    const lastWeekBriefs = briefs.filter(
      (b) => b.createdAt >= now - 2 * oneWeek && b.createdAt < now - oneWeek
    );

    const thisAvgAcc = thisWeekBriefs.length > 0
      ? thisWeekBriefs.reduce((s, b) => s + b.solutionAccuracy, 0) / thisWeekBriefs.length
      : 0;
    const lastAvgAcc = lastWeekBriefs.length > 0
      ? lastWeekBriefs.reduce((s, b) => s + b.solutionAccuracy, 0) / lastWeekBriefs.length
      : 0;
    const thisAvgAut = thisWeekBriefs.length > 0
      ? thisWeekBriefs.reduce((s, b) => s + b.autonomyLevel, 0) / thisWeekBriefs.length
      : 0;
    const lastAvgAut = lastWeekBriefs.length > 0
      ? lastWeekBriefs.reduce((s, b) => s + b.autonomyLevel, 0) / lastWeekBriefs.length
      : 0;

    // ── Engagement ──
    const totalMessages = briefs.reduce((s, b) => s + b.totalMessages, 0);
    const avgDuration =
      briefs.reduce((s, b) => s + b.totalDurationMs, 0) / briefs.length;

    // Inquiry style: based on avg autonomy
    const overallAutonomy =
      briefs.reduce((s, b) => s + b.autonomyLevel, 0) / briefs.length;
    const inquiryStyle =
      overallAutonomy >= 4 ? "explorer" : overallAutonomy >= 2.5 ? "direct" : "passive";

    // Inquiry evolution: track style changes over time
    const sortedBriefs = [...briefs].sort((a, b) => a.createdAt - b.createdAt);
    const inquiryEvolution = sortedBriefs.slice(-10).map((b) => ({
      date: b.createdAt,
      style: b.autonomyLevel >= 4 ? "explorer" : b.autonomyLevel >= 2.5 ? "direct" : "passive",
    }));

    // Frustration trend
    const recentFriction = briefs.slice(0, 5);
    const olderFriction = briefs.slice(5, 10);
    const recentFrustration = recentFriction.reduce((s, b) => s + b.frictionPoints.length, 0) / Math.max(1, recentFriction.length);
    const olderFrustration = olderFriction.reduce((s, b) => s + b.frictionPoints.length, 0) / Math.max(1, olderFriction.length);
    const frustrationTrend =
      olderFriction.length === 0
        ? "stable"
        : recentFrustration < olderFrustration - 0.5
          ? "decreasing"
          : recentFrustration > olderFrustration + 0.5
            ? "increasing"
            : "stable";

    // ── Upsert power map ──
    const existing = await ctx.db
      .query("studentPowerMap")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .first();

    const powerMapData = {
      studentId,
      lastUpdatedAt: now,
      topicMastery,
      progressVelocity: {
        overall: Math.round((briefs.filter((b) => b.createdAt >= now - oneWeek).length) * 10) / 10,
        accuracyDelta: Math.round((thisAvgAcc - lastAvgAcc) * 10) / 10,
        autonomyDelta: Math.round((thisAvgAut - lastAvgAut) * 10) / 10,
        weeklySnapshots: weeklySnapshots.reverse(),
      },
      engagement: {
        totalSessions: briefs.length,
        totalMessages,
        avgSessionDuration: Math.round(avgDuration),
        inquiryStyle,
        inquiryEvolution,
        frustrationTrend,
      },
    };

    if (existing) {
      await ctx.db.patch(existing._id, powerMapData);
    } else {
      await ctx.db.insert("studentPowerMap", powerMapData);
    }
  },
});

// ── Get power map for a single student ──
export const getStudentPowerMap = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    return await ctx.db
      .query("studentPowerMap")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .first();
  },
});

// ── Get power maps for all students in a classroom ──
export const getClassroomPowerMaps = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();

    const maps = [];
    for (const student of students) {
      const map = await ctx.db
        .query("studentPowerMap")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .first();
      if (map) {
        maps.push({ ...map, studentName: student.name, avatarColor: student.avatarColor });
      }
    }
    return maps;
  },
});

// ── Scheduled: recompute power maps for students with new briefs ──
export const scheduledRecompute = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find all students who have briefs
    const allBriefs = await ctx.db.query("sessionBriefs").order("desc").take(100);

    // Get unique student IDs
    const studentIds = new Set(allBriefs.map((b) => b.studentId));

    // Check which students need an update
    for (const studentId of studentIds) {
      const existingMap = await ctx.db
        .query("studentPowerMap")
        .withIndex("by_student", (q) => q.eq("studentId", studentId))
        .first();

      const latestBrief = allBriefs.find((b) => b.studentId === studentId);
      if (!latestBrief) continue;

      // Recompute if no map exists or if there are newer briefs
      if (!existingMap || latestBrief.createdAt > existingMap.lastUpdatedAt) {
        await ctx.scheduler.runAfter(0, internal.powerMap.recomputePowerMap, { studentId });
      }
    }
  },
});
