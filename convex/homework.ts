import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ── Teacher creates a homework assignment ──
export const createHomework = mutation({
  args: {
    classroomId: v.id("classrooms"),
    title: v.string(),
    topicIds: v.array(v.id("topics")),
    teacherNotes: v.optional(v.string()),
    questionCount: v.number(),
    deadline: v.number(),
  },
  handler: async (ctx, args) => {
    const homeworkId = await ctx.db.insert("homework", {
      classroomId: args.classroomId,
      title: args.title,
      topicIds: args.topicIds,
      teacherNotes: args.teacherNotes,
      questionCount: args.questionCount,
      createdAt: Date.now(),
      deadline: args.deadline,
      status: "active",
    });

    // Schedule personalized assignment for each student
    await ctx.scheduler.runAfter(0, internal.homework.assignToStudents, {
      homeworkId,
      classroomId: args.classroomId,
      topicIds: args.topicIds,
      questionCount: args.questionCount,
    });

    return homeworkId;
  },
});

// ── Internal: personalize questions per student ──
export const assignToStudents = internalMutation({
  args: {
    homeworkId: v.id("homework"),
    classroomId: v.id("classrooms"),
    topicIds: v.array(v.id("topics")),
    questionCount: v.number(),
  },
  handler: async (ctx, { homeworkId, classroomId, topicIds, questionCount }) => {
    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();

    const topicSet = new Set(topicIds.map((t) => t.toString()));

    // Fetch all candidate questions
    const compoundAll = await ctx.db.query("compoundQuestions").take(100);
    const compoundCandidates = compoundAll.filter((q) =>
      q.topicIds.some((tid) => topicSet.has(tid.toString()))
    );

    const legacyCandidates: typeof legacyAll = [];
    const legacyAll = await ctx.db.query("questions").take(200);
    for (const q of legacyAll) {
      if (topicSet.has(q.topicId.toString())) {
        legacyCandidates.push(q);
      }
    }

    let studentIndex = 0;
    for (const student of students) {
      // 1. Fetch power map for this student
      const powerMap = await ctx.db
        .query("studentPowerMap")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .first();

      // 2. Determine mastery → difficulty mapping
      let targetDifficulty = 3; // default middle
      let reason = "ברירת מחדל — אין מפת כוח";

      if (powerMap && powerMap.topicMastery.length > 0) {
        // Average mastery across the homework's topics
        const relevant = powerMap.topicMastery.filter((tm) =>
          topicSet.has(tm.topicId.toString())
        );
        if (relevant.length > 0) {
          const avgMastery =
            relevant.reduce((s, tm) => s + tm.masteryScore, 0) / relevant.length;

          if (avgMastery <= 20) {
            targetDifficulty = 1;
            reason = `שליטה ${Math.round(avgMastery)}% → רמה 1 (בסיסי)`;
          } else if (avgMastery <= 45) {
            targetDifficulty = 2;
            reason = `שליטה ${Math.round(avgMastery)}% → רמה 2 (חיזוק)`;
          } else if (avgMastery <= 70) {
            targetDifficulty = 3;
            reason = `שליטה ${Math.round(avgMastery)}% → רמה 3 (אתגר)`;
          } else if (avgMastery <= 90) {
            targetDifficulty = 4;
            reason = `שליטה ${Math.round(avgMastery)}% → רמה 4 (בגרות)`;
          } else {
            targetDifficulty = 5;
            reason = `שליטה ${Math.round(avgMastery)}% → רמה 5 (העשרה)`;
          }
        }
      }

      // 3. Select questions at the target difficulty (± 1 range)
      const selectedIds = new Set<string>();
      const insertedAssignedIds: Id<"assignedQuestions">[] = [];

      // Prefer compound questions
      const matchingCompound = compoundCandidates.filter(
        (q) => Math.abs(q.difficulty - targetDifficulty) <= 1
      );
      for (const q of matchingCompound) {
        if (selectedIds.size >= questionCount) break;
        selectedIds.add(q._id);
        const aqId = await ctx.db.insert("assignedQuestions", {
          homeworkId,
          studentId: student._id,
          compoundQuestionId: q._id,
          assignedDifficulty: targetDifficulty,
          personalizedReason: reason,
          status: "pending",
        });
        insertedAssignedIds.push(aqId);
      }

      // Fill remaining with legacy questions
      if (selectedIds.size < questionCount) {
        const matchingLegacy = legacyCandidates.filter(
          (q) => Math.abs(q.difficulty - targetDifficulty) <= 1
        );
        for (const q of matchingLegacy) {
          if (selectedIds.size >= questionCount) break;
          if (selectedIds.has(q._id)) continue;
          selectedIds.add(q._id);
          const aqId = await ctx.db.insert("assignedQuestions", {
            homeworkId,
            studentId: student._id,
            questionId: q._id,
            assignedDifficulty: targetDifficulty,
            personalizedReason: reason,
            status: "pending",
          });
          insertedAssignedIds.push(aqId);
        }
      }

      // 4. If this student has a theme, schedule Gemini personalization
      if (student.homeworkTheme && insertedAssignedIds.length > 0) {
        // Stagger personalization: 20 seconds per student to avoid Gemini rate limits (15 RPM max)
        await ctx.scheduler.runAfter(studentIndex * 20000, internal.ai.personalizeHomework, {
          assignedIds: insertedAssignedIds,
        });
      }
      studentIndex++;
    }
  },
});

// ── Teacher: get homework for a classroom ──
export const getHomeworkForClassroom = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    return await ctx.db
      .query("homework")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .order("desc")
      .take(20);
  },
});

// ── Student: get their assigned questions for a homework ──
export const getStudentHomework = query({
  args: {
    homeworkId: v.id("homework"),
    studentId: v.id("students"),
  },
  handler: async (ctx, { homeworkId, studentId }) => {
    const assigned = await ctx.db
      .query("assignedQuestions")
      .withIndex("by_homework_student", (q) =>
        q.eq("homeworkId", homeworkId).eq("studentId", studentId)
      )
      .take(10);

    // Enrich with actual question data
    const enriched = [];
    for (const aq of assigned) {
      let questionData = null;
      if (aq.compoundQuestionId) {
        questionData = await ctx.db.get(aq.compoundQuestionId);
      } else if (aq.questionId) {
        questionData = await ctx.db.get(aq.questionId);
      }
      enriched.push({ ...aq, questionData });
    }
    return enriched;
  },
});

// ── Student: submit answer for one section ──
export const submitAnswer = mutation({
  args: {
    assignedQuestionId: v.id("assignedQuestions"),
    sectionLabel: v.string(),
    studentAnswer: v.string(),
    isCorrect: v.boolean(),
    timeMs: v.number(),
    hintsUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const aq = await ctx.db.get(args.assignedQuestionId);
    if (!aq) throw new Error("Assigned question not found");

    const existingAnswers = aq.answers ?? [];
    const newAnswer = {
      sectionLabel: args.sectionLabel,
      studentAnswer: args.studentAnswer,
      isCorrect: args.isCorrect,
      timeMs: args.timeMs,
      hintsUsed: args.hintsUsed,
    };

    // Replace if already answered, otherwise append
    const filtered = existingAnswers.filter(
      (a) => a.sectionLabel !== args.sectionLabel
    );
    filtered.push(newAnswer);

    await ctx.db.patch(args.assignedQuestionId, {
      answers: filtered,
      status: "in_progress",
    });
  },
});

// ── Student: finalize submission ──
export const finalizeSubmission = mutation({
  args: { assignedQuestionId: v.id("assignedQuestions") },
  handler: async (ctx, { assignedQuestionId }) => {
    const aq = await ctx.db.get(assignedQuestionId);
    if (!aq) throw new Error("Assigned question not found");

    const answers = aq.answers ?? [];
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const score = answers.length > 0
      ? Math.round((correctCount / answers.length) * 100)
      : 0;

    await ctx.db.patch(assignedQuestionId, {
      status: "submitted",
      submittedAt: Date.now(),
      score,
    });
  },
});

// ── Teacher: close homework and generate rundown ──
export const closeHomework = mutation({
  args: { homeworkId: v.id("homework") },
  handler: async (ctx, { homeworkId }) => {
    const hw = await ctx.db.get(homeworkId);
    if (!hw) throw new Error("Homework not found");

    await ctx.db.patch(homeworkId, { status: "closed" });

    // Schedule rundown generation
    await ctx.scheduler.runAfter(
      0,
      internal.homeworkRundown.generateRundown,
      { homeworkId, classroomId: hw.classroomId }
    );
  },
});

// -- Teacher: per-student submission details (available while active) --
export const getStudentSubmissions = query({
  args: { homeworkId: v.id("homework") },
  handler: async (ctx, { homeworkId }) => {
    const assignments = await ctx.db
      .query("assignedQuestions")
      .withIndex("by_homework", (q) => q.eq("homeworkId", homeworkId))
      .collect();

    const enriched = [];
    for (const aq of assignments) {
      const student = await ctx.db.get(aq.studentId);
      if (!student) continue;
      enriched.push({
        assignedQuestionId: aq._id,
        studentId: aq.studentId,
        studentName: student.name,
        avatarColor: student.avatarColor,
        status: aq.status,
        score: aq.score ?? null,
        submittedAt: aq.submittedAt ?? null,
        assignedDifficulty: aq.assignedDifficulty,
        personalizedReason: aq.personalizedReason,
        answersCount: aq.answers?.length ?? 0,
        correctCount: aq.answers?.filter((a) => a.isCorrect).length ?? 0,
        aiInteractions: aq.aiInteractions ?? 0,
        totalTimeMs: aq.answers?.reduce((s, a) => s + (a.timeMs ?? 0), 0) ?? 0,
        answers: aq.answers,
      });
    }

    const statusOrder: Record<string, number> = { submitted: 0, in_progress: 1, pending: 2 };
    enriched.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
    return enriched;
  },
});

// -- Teacher: per-question success stats (works while hw is active) --
export const getHomeworkQuestionStats = query({
  args: { homeworkId: v.id("homework") },
  handler: async (ctx, { homeworkId }) => {
    const assignments = await ctx.db
      .query("assignedQuestions")
      .withIndex("by_homework", (q) => q.eq("homeworkId", homeworkId))
      .collect();

    type StatEntry = {
      questionId: string;
      label: string;
      difficulty: number;
      total: number;
      correct: number;
      totalHints: number;
      totalTimeMs: number;
    };
    const statsMap = new Map<string, StatEntry>();

    for (const aq of assignments) {
      if (!aq.answers) continue;
      const qId = (aq.questionId ?? aq.compoundQuestionId)?.toString() ?? "unknown";
      const difficulty = aq.assignedDifficulty;
      for (const ans of aq.answers) {
        const key = `${qId}::${ans.sectionLabel}`;
        const s = statsMap.get(key);
        if (s) {
          s.total++;
          if (ans.isCorrect) s.correct++;
          s.totalHints += ans.hintsUsed;
          s.totalTimeMs += ans.timeMs ?? 0;
        } else {
          statsMap.set(key, {
            questionId: qId,
            label: ans.sectionLabel,
            difficulty,
            total: 1,
            correct: ans.isCorrect ? 1 : 0,
            totalHints: ans.hintsUsed,
            totalTimeMs: ans.timeMs ?? 0,
          });
        }
      }
    }

    return Array.from(statsMap.values())
      .map((s) => ({
        ...s,
        successRate: s.total > 0 ? Math.round((s.correct / s.total) * 100) : null,
        avgHints: s.total > 0 ? +(s.totalHints / s.total).toFixed(1) : 0,
        avgTimeSec: s.total > 0 ? Math.round(s.totalTimeMs / s.total / 1000) : 0,
      }))
      .sort((a, b) => (a.successRate ?? 101) - (b.successRate ?? 101));
  },
});
