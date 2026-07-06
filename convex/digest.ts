import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

/* ═══════════════════════════════════════════════════════════════════════
   TEACHER WEEKLY DIGEST — deterministic, rule-based (no LLM)
   Composes a per-class summary of the last 7 days: totals, per-topic
   accuracy deltas vs. the previous week, top struggling / improving
   students, notable events, and recommended teacher actions. Stored as one
   `weeklyDigests` row per generation, read back by the dashboard.
   ═══════════════════════════════════════════════════════════════════════ */

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

function accOf(arr: { isCorrect: boolean }[]): number {
  return arr.length > 0
    ? Math.round((arr.filter((a) => a.isCorrect).length / arr.length) * 100)
    : 0;
}

// ── Core aggregation (shared by cron + on-demand regenerate) ──
// Reads are all index-based and bounded (take(300) of recent attempts per
// student covers two weeks of realistic activity).
async function buildDigest(
  ctx: { db: any },
  classroomId: Id<"classrooms">,
): Promise<Id<"weeklyDigests">> {
  const now = Date.now();
  const weekStart = now - WEEK;
  const prevStart = now - 2 * WEEK;

  const students: Doc<"students">[] = await ctx.db
    .query("students")
    .withIndex("by_classroom", (q: any) => q.eq("classroomId", classroomId))
    .collect();

  const topics: Doc<"topics">[] = (await ctx.db.query("topics").collect()).sort(
    (a: Doc<"topics">, b: Doc<"topics">) => a.order - b.order,
  );
  const topicIndex = new Map<string, number>();
  topics.forEach((t, i) => topicIndex.set(t._id, i));

  // per-topic this-week / prev-week accumulators (class-wide)
  const topicThis = topics.map(() => ({ correct: 0, total: 0 }));
  const topicPrev = topics.map(() => ({ correct: 0, total: 0 }));

  // class totals
  let classThisCorrect = 0;
  let classThisTotal = 0;
  let classPrevCorrect = 0;
  let classPrevTotal = 0;
  const activeStudentIds = new Set<string>();

  const perStudent: {
    student: Doc<"students">;
    accThis: number;
    accPrev: number;
    trend: number;
    thisCount: number;
    weakTopic: string | null;
  }[] = [];

  for (const s of students) {
    const attempts: Doc<"attempts">[] = await ctx.db
      .query("attempts")
      .withIndex("by_student", (q: any) => q.eq("studentId", s._id))
      .order("desc")
      .take(300);

    const thisWeek = attempts.filter((a) => a._creationTime >= weekStart);
    const prevWeek = attempts.filter(
      (a) => a._creationTime >= prevStart && a._creationTime < weekStart,
    );

    if (thisWeek.length > 0) activeStudentIds.add(s._id);

    classThisTotal += thisWeek.length;
    classThisCorrect += thisWeek.filter((a) => a.isCorrect).length;
    classPrevTotal += prevWeek.length;
    classPrevCorrect += prevWeek.filter((a) => a.isCorrect).length;

    // per-topic (this week) for this student → fold into class topic aggs +
    // find the student's weakest attempted topic this week
    const stTopic = topics.map(() => ({ correct: 0, total: 0 }));
    for (const a of thisWeek) {
      const ti = topicIndex.get(a.topicId);
      if (ti === undefined) continue;
      topicThis[ti].total++;
      if (a.isCorrect) topicThis[ti].correct++;
      stTopic[ti].total++;
      if (a.isCorrect) stTopic[ti].correct++;
    }
    for (const a of prevWeek) {
      const ti = topicIndex.get(a.topicId);
      if (ti === undefined) continue;
      topicPrev[ti].total++;
      if (a.isCorrect) topicPrev[ti].correct++;
    }

    let weakTopic: string | null = null;
    let weakPct = 101;
    stTopic.forEach((p, i) => {
      if (p.total >= 2) {
        const pct = (p.correct / p.total) * 100;
        if (pct < weakPct) {
          weakPct = pct;
          weakTopic = topics[i].nameHe || topics[i].name;
        }
      }
    });

    const accThis = accOf(thisWeek);
    const accPrev = accOf(prevWeek);
    const trend =
      thisWeek.length > 0 && prevWeek.length > 0 ? accThis - accPrev : 0;

    perStudent.push({
      student: s,
      accThis,
      accPrev,
      trend,
      thisCount: thisWeek.length,
      weakTopic,
    });
  }

  // ── Homework completion (assigned vs submitted, deadline within window) ──
  const homeworks: Doc<"homework">[] = await ctx.db
    .query("homework")
    .withIndex("by_classroom", (q: any) => q.eq("classroomId", classroomId))
    .collect();
  let assignedCount = 0;
  let submittedCount = 0;
  for (const hw of homeworks) {
    if (hw.createdAt < prevStart) continue; // only recent homework
    const assigned: Doc<"assignedQuestions">[] = await ctx.db
      .query("assignedQuestions")
      .withIndex("by_homework", (q: any) => q.eq("homeworkId", hw._id))
      .collect();
    assignedCount += assigned.length;
    submittedCount += assigned.filter((a) => a.status === "submitted").length;
  }
  const homeworkCompletion =
    assignedCount > 0 ? Math.round((submittedCount / assignedCount) * 100) : 0;

  // ── Totals ──
  const accuracy = classThisTotal > 0 ? Math.round((classThisCorrect / classThisTotal) * 100) : 0;
  const prevAccuracy = classPrevTotal > 0 ? Math.round((classPrevCorrect / classPrevTotal) * 100) : 0;
  const accuracyDelta = classThisTotal > 0 && classPrevTotal > 0 ? accuracy - prevAccuracy : 0;

  // ── Topic deltas ──
  const topicDeltas = topics.map((t, i) => {
    const pct = topicThis[i].total > 0 ? Math.round((topicThis[i].correct / topicThis[i].total) * 100) : 0;
    const prevPct = topicPrev[i].total > 0 ? Math.round((topicPrev[i].correct / topicPrev[i].total) * 100) : 0;
    const delta = topicThis[i].total > 0 && topicPrev[i].total > 0 ? pct - prevPct : 0;
    return {
      topicId: t._id,
      name: t.nameHe || t.name,
      pct,
      delta,
      attempts: topicThis[i].total,
    };
  });

  // ── Struggling: active students, ranked by low accuracy + declining trend ──
  const active = perStudent.filter((p) => p.thisCount > 0);
  const struggling = [...active]
    .sort((a, b) => a.accThis - a.trend - (b.accThis - b.trend))
    .slice(0, 3)
    .map((p) => {
      const bits: string[] = [`דיוק ${p.accThis}%`];
      if (p.trend < 0) bits.push(`ירידה של ${Math.abs(p.trend)} נק׳`);
      if (p.weakTopic) bits.push(`חולשה ב${p.weakTopic}`);
      return {
        studentId: p.student._id,
        name: p.student.name,
        avatarColor: p.student.avatarColor,
        acc: p.accThis,
        trend: p.trend,
        reason: bits.join(" · "),
      };
    });

  // ── Improving: biggest positive trend (must have prev-week data) ──
  const improving = [...active]
    .filter((p) => p.trend > 0)
    .sort((a, b) => b.trend - a.trend)
    .slice(0, 3)
    .map((p) => ({
      studentId: p.student._id,
      name: p.student.name,
      avatarColor: p.student.avatarColor,
      acc: p.accThis,
      trend: p.trend,
      reason: `שיפור של ${p.trend} נק׳ · דיוק ${p.accThis}%`,
    }));

  // ── Notable events ──
  const notableEvents: { kind: string; who: string; text: string }[] = [];
  for (const s of students) {
    if ((s.streak ?? 0) >= 5) {
      notableEvents.push({ kind: "streak", who: s.name, text: `רצף של ${s.streak} ימים` });
    }
  }
  // pending level suggestions
  for (const s of students) {
    const pending = await ctx.db
      .query("levelSuggestions")
      .withIndex("by_student", (q: any) => q.eq("studentId", s._id))
      .order("desc")
      .first();
    if (pending && pending.status === "pending") {
      notableEvents.push({
        kind: "level",
        who: s.name,
        text: `מוכן/ה לרמה ${pending.suggestedLevel} — ממתין לאישור`,
      });
    }
  }
  notableEvents.splice(6); // keep bounded

  // ── Recommended actions (rule-based, deterministic) ──
  const recommendedActions: { priority: string; text: string }[] = [];
  if (struggling.length > 0) {
    recommendedActions.push({
      priority: "high",
      text: `שוחח/י עם ${struggling.map((s) => s.name).join(", ")} — דיוק נמוך השבוע`,
    });
  }
  const worstTopic = [...topicDeltas]
    .filter((t) => t.attempts >= 3)
    .sort((a, b) => a.pct - b.pct)[0];
  if (worstTopic && worstTopic.pct < 60) {
    recommendedActions.push({
      priority: "high",
      text: `שקול/י חזרה כיתתית על "${worstTopic.name}" — ממוצע ${worstTopic.pct}%`,
    });
  }
  if (homeworkCompletion > 0 && homeworkCompletion < 70) {
    recommendedActions.push({
      priority: "medium",
      text: `השלמת שיעורי בית עומדת על ${homeworkCompletion}% — תזכורת לכיתה`,
    });
  }
  const droppingTopic = [...topicDeltas].filter((t) => t.delta < -8).sort((a, b) => a.delta - b.delta)[0];
  if (droppingTopic) {
    recommendedActions.push({
      priority: "medium",
      text: `"${droppingTopic.name}" ירד ב-${Math.abs(droppingTopic.delta)} נק׳ מהשבוע שעבר`,
    });
  }
  if (improving.length > 0) {
    recommendedActions.push({
      priority: "low",
      text: `ציין/י לטובה את ${improving.map((s) => s.name).join(", ")} על השיפור`,
    });
  }
  if (recommendedActions.length === 0) {
    recommendedActions.push({
      priority: "low",
      text: "הכיתה יציבה השבוע — המשך/י כרגיל ועקוב/י אחר המגמות",
    });
  }
  recommendedActions.splice(4); // 2-4 actions

  const payload = {
    totals: {
      activeStudents: activeStudentIds.size,
      totalStudents: students.length,
      attempts: classThisTotal,
      accuracy,
      accuracyDelta,
      homeworkCompletion,
    },
    topicDeltas,
    struggling,
    improving,
    notableEvents,
    recommendedActions,
  };

  return await ctx.db.insert("weeklyDigests", {
    classroomId,
    weekStart,
    generatedAt: now,
    payload,
  });
}

// ── Internal: generate + persist a digest for one classroom ──
export const generateWeeklyDigest = internalMutation({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    return await buildDigest(ctx, classroomId);
  },
});

// ── Weekly cron entry: generate for every classroom ──
export const generateAllDigests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const classrooms = await ctx.db.query("classrooms").collect();
    for (const c of classrooms) {
      await ctx.scheduler.runAfter(0, internal.digest.generateWeeklyDigest, {
        classroomId: c._id,
      });
    }
  },
});

// ── Public: latest digest for a classroom (null if none yet) ──
export const getLatestDigest = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    return await ctx.db
      .query("weeklyDigests")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .order("desc")
      .first();
  },
});

// ── Public: on-demand regenerate (the "רענן תקציר" button) ──
export const regenerateDigest = mutation({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }): Promise<Id<"weeklyDigests">> => {
    return await buildDigest(ctx, classroomId);
  },
});
