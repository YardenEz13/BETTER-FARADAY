import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { awardXpHelper } from "./xp";
import { touchStreakHelper } from "./streaks";

// ── מצב מתכונת (Bagrut exam simulation) ──
// A serious, timed, no-help sitting of 2-3 compound (581-style) questions.
// Solutions are stripped from the payload while the exam is in progress; the
// student never receives correctAnswer/solutionSteps/hints before submitting.
// Grading happens server-side on finish (numeric/expression compare); proof and
// free-expression sections fall back to self-assessment ("בדיקה עצמית").

const MINUTES_PER_QUESTION = 30;
const GRACE_MS = 5 * 60 * 1000;

// Section answerTypes we can auto-grade with a normalized compare. Everything
// else (proof, graph_description, …) is surfaced as self-check.
const AUTO_GRADED_TYPES = new Set(["numeric", "range", "coordinates"]);

// ── Answer comparison (server-side) ──
// Normalizes whitespace/case and a few LaTeX/Hebrew-math quirks, then compares.
function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/\\cdot|\\times/g, "*")
    .replace(/[\s]+/g, "")
    .replace(/[{}]/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/[,;]/g, ",")
    .trim();
}

function answersMatch(correct: string, student: string): boolean {
  const c = normalizeAnswer(correct);
  const a = normalizeAnswer(student);
  if (!a) return false;
  if (c === a) return true;
  // Numeric tolerance compare when both sides parse as numbers.
  const cn = Number(c.replace(/[^0-9.-]/g, ""));
  const an = Number(a.replace(/[^0-9.-]/g, ""));
  if (Number.isFinite(cn) && Number.isFinite(an) && c.replace(/[0-9.-]/g, "") === "" && a.replace(/[0-9.-]/g, "") === "") {
    return Math.abs(cn - an) < 1e-4;
  }
  // Loose containment for short expression answers.
  return c.length > 0 && (c === a);
}

// Strip solution fields from a compound question for the in-progress client.
function stripSolution(q: Doc<"compoundQuestions">) {
  return {
    _id: q._id,
    difficulty: q.difficulty,
    tags: q.tags,
    bagrutYear: q.bagrutYear,
    topicIds: q.topicIds,
    figureImageStorageId: q.figureImageStorageId,
    preamble: q.preamble,
    preambleParams: q.preambleParams,
    sections: q.sections.map((s) => ({
      label: s.label,
      prompt: s.prompt,
      dependsOn: s.dependsOn,
      answerType: s.answerType,
      points: s.points,
      skillsTested: s.skillsTested,
      // Proof statement (given/toProve/diagram) is part of the QUESTION, not the
      // answer — keep it so proof sections are answerable. Strip proofSteps.
      proofMeta: s.proofMeta,
    })),
  };
}

// ── Start a new exam ──
export const startExam = mutation({
  args: {
    studentId: v.id("students"),
    questionCount: v.number(),          // 2 or 3
    difficultyMax: v.optional(v.number()),
  },
  handler: async (ctx, { studentId, questionCount, difficultyMax }) => {
    const count = Math.max(2, Math.min(3, Math.round(questionCount)));

    // Avoid repeating questions from the student's recent attempts.
    const recent = await ctx.db
      .query("examAttempts")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(5);
    const recentlyUsed = new Set<string>();
    for (const r of recent) {
      for (const id of r.compoundQuestionIds) recentlyUsed.add(id.toString());
    }

    const all = await ctx.db.query("compoundQuestions").take(200);
    const cap = difficultyMax ?? 5;
    let pool = all.filter((q) => q.difficulty <= cap);
    if (pool.length === 0) pool = all;

    // Prefer bagrutYear-tagged, then not-recently-used, for variety.
    const preferred = pool.filter((q) => q.bagrutYear && !recentlyUsed.has(q._id.toString()));
    const fresh = pool.filter((q) => !recentlyUsed.has(q._id.toString()));
    const ordered = [
      ...preferred,
      ...fresh.filter((q) => !preferred.some((p) => p._id === q._id)),
      ...pool,
    ];

    // Pick `count`, preferring distinct topicIds where possible.
    const picked: Doc<"compoundQuestions">[] = [];
    const usedTopics = new Set<string>();
    for (const q of ordered) {
      if (picked.some((p) => p._id === q._id)) continue;
      const overlaps = q.topicIds.some((t) => usedTopics.has(t.toString()));
      if (overlaps && picked.length < count && ordered.length > count) continue;
      picked.push(q);
      q.topicIds.forEach((t) => usedTopics.add(t.toString()));
      if (picked.length >= count) break;
    }
    // Backfill if the topic-variety filter left us short.
    if (picked.length < count) {
      for (const q of ordered) {
        if (picked.some((p) => p._id === q._id)) continue;
        picked.push(q);
        if (picked.length >= count) break;
      }
    }

    if (picked.length === 0) throw new Error("אין שאלות זמינות למתכונת");

    const durationMinutes = picked.length * MINUTES_PER_QUESTION;

    const perQuestion = picked.map((q) => ({
      compoundQuestionId: q._id,
      sectionResults: q.sections.map((s) => ({
        sectionLabel: s.label,
        studentAnswer: "",
        pointsPossible: s.points,
      })),
      totalEarned: 0,
      totalPossible: q.sections.reduce((sum, s) => sum + s.points, 0),
    }));

    const examId = await ctx.db.insert("examAttempts", {
      studentId,
      compoundQuestionIds: picked.map((q) => q._id),
      startedAt: Date.now(),
      durationMinutes,
      status: "in_progress",
      perQuestion,
    });

    return {
      examId,
      durationMinutes,
      startedAt: Date.now(),
      questions: picked.map(stripSolution),
    };
  },
});

// ── Get an exam (reactive; drives the runner + results screen) ──
export const getExam = query({
  args: { examId: v.id("examAttempts") },
  handler: async (ctx, { examId }) => {
    const attempt = await ctx.db.get(examId);
    if (!attempt) return null;

    const isDone = attempt.status !== "in_progress";
    const questions: Array<Doc<"compoundQuestions"> | ReturnType<typeof stripSolution>> = [];
    for (const id of attempt.compoundQuestionIds) {
      const q = await ctx.db.get(id);
      if (!q) continue;
      questions.push(isDone ? q : stripSolution(q));
    }

    return { attempt, questions, solutionsRevealed: isDone };
  },
});

// ── Save a single section answer (no grading yet) ──
export const submitExamSection = mutation({
  args: {
    examId: v.id("examAttempts"),
    compoundQuestionId: v.id("compoundQuestions"),
    sectionLabel: v.string(),
    answer: v.string(),
  },
  handler: async (ctx, { examId, compoundQuestionId, sectionLabel, answer }) => {
    const attempt = await ctx.db.get(examId);
    if (!attempt) throw new Error("מתכונת לא נמצאה");
    if (attempt.status !== "in_progress") return; // locked after submit

    const perQuestion = attempt.perQuestion.map((pq) => {
      if (pq.compoundQuestionId !== compoundQuestionId) return pq;
      return {
        ...pq,
        sectionResults: pq.sectionResults.map((sr) =>
          sr.sectionLabel === sectionLabel ? { ...sr, studentAnswer: answer } : sr
        ),
      };
    });

    await ctx.db.patch(examId, { perQuestion });
  },
});

// ── Finish + grade the exam ──
export const finishExam = mutation({
  args: {
    examId: v.id("examAttempts"),
    expired: v.optional(v.boolean()),
  },
  handler: async (ctx, { examId, expired }) => {
    const attempt = await ctx.db.get(examId);
    if (!attempt) throw new Error("מתכונת לא נמצאה");
    if (attempt.status !== "in_progress") {
      return { finalScore: attempt.finalScore ?? 0, alreadySubmitted: true };
    }

    // Server-side expiry guard.
    const deadline = attempt.startedAt + attempt.durationMinutes * 60 * 1000 + GRACE_MS;
    const isExpired = expired === true || Date.now() > deadline;

    // Load the questions to grade against correctAnswer.
    const qById = new Map<string, Doc<"compoundQuestions">>();
    for (const id of attempt.compoundQuestionIds) {
      const q = await ctx.db.get(id);
      if (q) qById.set(id.toString(), q);
    }

    let totalEarnedAll = 0;
    let totalPossibleAll = 0;

    const perQuestion = attempt.perQuestion.map((pq) => {
      const q = qById.get(pq.compoundQuestionId.toString());
      let totalEarned = 0;
      const totalPossible = pq.totalPossible;

      const sectionResults = pq.sectionResults.map((sr) => {
        const section = q?.sections.find((s) => s.label === sr.sectionLabel);
        if (!section) return sr;

        const autoGrade = AUTO_GRADED_TYPES.has(section.answerType);
        if (autoGrade) {
          const isCorrect = answersMatch(section.correctAnswer, sr.studentAnswer);
          const pointsEarned = isCorrect ? section.points ?? sr.pointsPossible : 0;
          totalEarned += pointsEarned;
          return {
            ...sr,
            isCorrect,
            pointsEarned,
            needsSelfCheck: false,
          };
        }
        // proof / expression / graph_description → self-assessment. Points are
        // withheld until the student self-grades on the results screen.
        return {
          ...sr,
          isCorrect: undefined,
          pointsEarned: undefined,
          needsSelfCheck: true,
        };
      });

      totalEarnedAll += totalEarned;
      totalPossibleAll += totalPossible;
      return { ...pq, sectionResults, totalEarned, totalPossible };
    });

    const finalScore =
      totalPossibleAll > 0 ? Math.round((100 * totalEarnedAll) / totalPossibleAll) : 0;

    await ctx.db.patch(examId, {
      status: isExpired ? "expired" : "submitted",
      submittedAt: Date.now(),
      perQuestion,
      finalScore,
    });

    // XP + streak on first finish.
    const xpAward = Math.round(finalScore / 2);
    if (xpAward > 0) {
      await awardXpHelper(ctx, attempt.studentId, xpAward, "exam", examId);
    }
    await touchStreakHelper(ctx, attempt.studentId);

    return { finalScore, xpAward, expired: isExpired };
  },
});

// ── Self-grade a self-check section (proof / expression) on the results screen ──
export const selfGradeSection = mutation({
  args: {
    examId: v.id("examAttempts"),
    compoundQuestionId: v.id("compoundQuestions"),
    sectionLabel: v.string(),
    correct: v.boolean(),
  },
  handler: async (ctx, { examId, compoundQuestionId, sectionLabel, correct }) => {
    const attempt = await ctx.db.get(examId);
    if (!attempt) throw new Error("מתכונת לא נמצאה");
    if (attempt.status !== "submitted" && attempt.status !== "expired") {
      throw new Error("ניתן לבדוק עצמית רק לאחר הגשה");
    }

    let delta = 0; // points added/removed by this self-grade
    let alreadyGraded = false;

    const perQuestion = attempt.perQuestion.map((pq) => {
      if (pq.compoundQuestionId !== compoundQuestionId) return pq;
      let totalEarned = pq.totalEarned;
      const sectionResults = pq.sectionResults.map((sr) => {
        if (sr.sectionLabel !== sectionLabel) return sr;
        if (!sr.needsSelfCheck || sr.selfGraded) {
          alreadyGraded = true;
          return sr;
        }
        const pointsEarned = correct ? sr.pointsPossible : 0;
        delta = pointsEarned;
        totalEarned += pointsEarned;
        return {
          ...sr,
          isCorrect: correct,
          pointsEarned,
          selfGraded: true,
        };
      });
      return { ...pq, sectionResults, totalEarned };
    });

    if (alreadyGraded) {
      return { finalScore: attempt.finalScore ?? 0, alreadyGraded: true };
    }

    const totalEarnedAll = perQuestion.reduce((s, pq) => s + pq.totalEarned, 0);
    const totalPossibleAll = perQuestion.reduce((s, pq) => s + pq.totalPossible, 0);
    const finalScore =
      totalPossibleAll > 0 ? Math.round((100 * totalEarnedAll) / totalPossibleAll) : 0;

    const prevScore = attempt.finalScore ?? 0;
    await ctx.db.patch(examId, { perQuestion, finalScore });

    // Adjust XP by the delta in the half-of-score award.
    const xpDelta = Math.round(finalScore / 2) - Math.round(prevScore / 2);
    if (xpDelta !== 0) {
      await awardXpHelper(ctx, attempt.studentId, xpDelta, "exam", examId);
    }

    return { finalScore, delta, xpDelta };
  },
});

// ── Exam history (lobby: last 10 attempts) ──
export const getExamHistory = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const attempts = await ctx.db
      .query("examAttempts")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(10);

    return attempts.map((a) => ({
      examId: a._id,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt ?? null,
      status: a.status,
      questionCount: a.compoundQuestionIds.length,
      finalScore: a.finalScore ?? null,
    }));
  },
});
