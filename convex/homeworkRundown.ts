import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ── Generate the "Next Lesson Brief" rundown after homework closes ──
export const generateRundown = internalMutation({
  args: {
    homeworkId: v.id("homework"),
    classroomId: v.id("classrooms"),
  },
  handler: async (ctx, { homeworkId, classroomId }) => {
    // Fetch all assigned questions for this homework
    const allAssigned = await ctx.db
      .query("assignedQuestions")
      .withIndex("by_homework", (q) => q.eq("homeworkId", homeworkId))
      .collect();

    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();

    const topics = await ctx.db.query("topics").collect();
    const topicMap = new Map(topics.map((t) => [t._id.toString(), t]));

    const hw = await ctx.db.get(homeworkId);
    if (!hw) return;

    // ── Class-level metrics ──
    const submitted = allAssigned.filter((a) => a.status === "submitted");
    const totalStudents = students.length;
    const completionRate = totalStudents > 0
      ? Math.round((submitted.length / (totalStudents * hw.questionCount)) * 100)
      : 0;

    const scores = submitted.map((a) => a.score ?? 0);
    const classAvgScore = scores.length > 0
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : 0;

    // Average time (from answers)
    let totalTimeMs = 0;
    let timeCount = 0;
    for (const aq of submitted) {
      for (const ans of aq.answers ?? []) {
        if (ans.timeMs) {
          totalTimeMs += ans.timeMs;
          timeCount++;
        }
      }
    }
    const avgTimeMinutes = timeCount > 0
      ? Math.round(totalTimeMs / timeCount / 60000 * 10) / 10
      : 0;

    // ── Per-topic breakdown ──
    const topicStats: Record<string, {
      topicId: Id<"topics">;
      topicName: string;
      scores: number[];
      sectionErrors: Record<string, number>;
      mistakes: string[];
    }> = {};

    for (const aq of submitted) {
      // Determine which topic this question belongs to
      let questionTopicIds: string[] = [];
      if (aq.compoundQuestionId) {
        const cq = await ctx.db.get(aq.compoundQuestionId);
        if (cq) questionTopicIds = cq.topicIds.map((t) => t.toString());
      } else if (aq.questionId) {
        const q = await ctx.db.get(aq.questionId);
        if (q) questionTopicIds = [q.topicId.toString()];
      }

      for (const tid of questionTopicIds) {
        const topic = topicMap.get(tid);
        if (!topic) continue;

        if (!topicStats[tid]) {
          topicStats[tid] = {
            topicId: topic._id,
            topicName: topic.nameHe || topic.name,
            scores: [],
            sectionErrors: {},
            mistakes: [],
          };
        }

        topicStats[tid].scores.push(aq.score ?? 0);

        // Track section-level errors
        for (const ans of aq.answers ?? []) {
          if (!ans.isCorrect) {
            const key = `סעיף ${ans.sectionLabel}`;
            topicStats[tid].sectionErrors[key] =
              (topicStats[tid].sectionErrors[key] || 0) + 1;
            if (ans.studentAnswer) {
              topicStats[tid].mistakes.push(ans.studentAnswer.slice(0, 50));
            }
          }
        }
      }
    }

    const topicBreakdown = Object.values(topicStats).map((ts) => {
      const avgScore = ts.scores.length > 0
        ? Math.round(ts.scores.reduce((s, v) => s + v, 0) / ts.scores.length)
        : 0;

      // Find the hardest section
      const sectionEntries = Object.entries(ts.sectionErrors);
      sectionEntries.sort((a, b) => b[1] - a[1]);
      const hardestSection = sectionEntries[0]
        ? `${sectionEntries[0][0]} — ${sectionEntries[0][1]} שגיאות`
        : "אין מספיק נתונים";

      // Deduplicate common mistakes
      const uniqueMistakes = [...new Set(ts.mistakes)].slice(0, 5);

      return {
        topicId: ts.topicId,
        topicName: ts.topicName,
        avgScore,
        hardestSection,
        commonMistakes: uniqueMistakes,
      };
    });

    // ── Student clustering ──
    const studentScores: Record<string, number[]> = {};
    for (const aq of allAssigned) {
      const sid = aq.studentId.toString();
      if (!studentScores[sid]) studentScores[sid] = [];
      if (aq.score !== undefined) studentScores[sid].push(aq.score);
    }

    const needsHelp: Id<"students">[] = [];
    const readyToAdvance: Id<"students">[] = [];
    const excelling: Id<"students">[] = [];

    for (const [sid, scoreArr] of Object.entries(studentScores)) {
      const avg = scoreArr.length > 0
        ? scoreArr.reduce((s, v) => s + v, 0) / scoreArr.length
        : 0;

      if (avg < 40) needsHelp.push(sid as Id<"students">);
      else if (avg < 75) readyToAdvance.push(sid as Id<"students">);
      else excelling.push(sid as Id<"students">);
    }

    const clusters = [
      {
        label: "צריכים חיזוק",
        studentIds: needsHelp,
        recommendedAction: "חזרה על יסודות הנושא עם תרגול מודרך",
      },
      {
        label: "מוכנים להתקדם",
        studentIds: readyToAdvance,
        recommendedAction: "תרגול עצמאי ברמת קושי גבוהה יותר",
      },
      {
        label: "מצטיינים",
        studentIds: excelling,
        recommendedAction: "שאלות העשרה בין-נושאיות ברמת בגרות",
      },
    ].filter((c) => c.studentIds.length > 0);

    // ── Flagged students ──
    const submittedStudentIds = new Set(
      submitted.map((a) => a.studentId.toString())
    );
    const flagged: { studentId: Id<"students">; reason: string }[] = [];

    for (const student of students) {
      const sid = student._id.toString();
      const studentAssigned = allAssigned.filter(
        (a) => a.studentId.toString() === sid
      );

      if (studentAssigned.every((a) => a.status === "pending")) {
        flagged.push({ studentId: student._id, reason: "לא הגיש כלל" });
        continue;
      }

      const studentScoreArr = studentScores[sid] ?? [];
      const avg = studentScoreArr.length > 0
        ? studentScoreArr.reduce((s, v) => s + v, 0) / studentScoreArr.length
        : 0;
      if (avg < 30 && studentScoreArr.length > 0) {
        flagged.push({ studentId: student._id, reason: `ציון ממוצע ${Math.round(avg)}% — מתחת לסף` });
      }

      // Flag heavy AI usage
      const totalAI = studentAssigned.reduce(
        (s, a) => s + (a.aiInteractions ?? 0), 0
      );
      if (totalAI >= 8) {
        flagged.push({ studentId: student._id, reason: `${totalAI} פניות ל-AI — תלות גבוהה` });
      }
    }

    // ── Write rundown ──
    await ctx.db.insert("homeworkRundowns", {
      homeworkId,
      classroomId,
      generatedAt: Date.now(),
      classAvgScore,
      completionRate,
      avgTimeMinutes,
      topicBreakdown,
      clusters,
      flagged,
    });

    // Mark homework as graded
    await ctx.db.patch(homeworkId, { status: "graded" });
  },
});

// ── Teacher: get the rundown for a homework ──
export const getRundown = query({
  args: { homeworkId: v.id("homework") },
  handler: async (ctx, { homeworkId }) => {
    return await ctx.db
      .query("homeworkRundowns")
      .withIndex("by_homework", (q) => q.eq("homeworkId", homeworkId))
      .first();
  },
});
