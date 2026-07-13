import { query, mutation, internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { awardXpHelper } from "./xp";
import { touchStreakHelper } from "./streaks";

// Shared helper: schedule the per-student fan-out for a homework doc. Used by
// immediate publish (createHomework), scheduled auto-publish (publishScheduled),
// and manual draft publish (publishHomework) so the args stay in one place.
async function scheduleAssignment(
  ctx: MutationCtx,
  homeworkId: Id<"homework">,
  hw: {
    classroomId: Id<"classrooms">;
    topicIds: Id<"topics">[];
    questionCount: number;
    pinnedQuestionIds?: Id<"questions">[];
    pinnedCompoundIds?: Id<"compoundQuestions">[];
  }
) {
  await ctx.scheduler.runAfter(0, internal.homework.assignToStudents, {
    homeworkId,
    classroomId: hw.classroomId,
    topicIds: hw.topicIds,
    questionCount: hw.questionCount,
    pinnedQuestionIds: hw.pinnedQuestionIds,
    pinnedCompoundIds: hw.pinnedCompoundIds,
  });
}

// ── Teacher creates a homework assignment ──
// Three creation modes, driven by `status` + `publishAt`:
//   • publishAt set        → inserted "scheduled"; auto-published at publishAt.
//   • status === "draft"   → inserted "draft"; NO fan-out until published.
//   • otherwise (active)   → inserted "active"; students get questions now.
export const createHomework = mutation({
  args: {
    classroomId: v.id("classrooms"),
    title: v.string(),
    topicIds: v.array(v.id("topics")),
    teacherNotes: v.optional(v.string()),
    questionCount: v.number(),
    deadline: v.number(),
    status: v.optional(v.string()),       // "draft" | "active" (default active)
    publishAt: v.optional(v.number()),    // ms epoch; when set → scheduled
    // Teacher-imported questions to pin to this homework (assigned to everyone).
    pinnedQuestionIds: v.optional(v.array(v.id("questions"))),
    pinnedCompoundIds: v.optional(v.array(v.id("compoundQuestions"))),
  },
  handler: async (ctx, args) => {
    const scheduled = args.publishAt != null;
    const isDraft = !scheduled && args.status === "draft";
    const status = scheduled ? "scheduled" : isDraft ? "draft" : "active";

    const homeworkId = await ctx.db.insert("homework", {
      classroomId: args.classroomId,
      title: args.title,
      topicIds: args.topicIds,
      teacherNotes: args.teacherNotes,
      questionCount: args.questionCount,
      createdAt: Date.now(),
      deadline: args.deadline,
      status,
      publishAt: scheduled ? args.publishAt : undefined,
      pinnedQuestionIds: args.pinnedQuestionIds,
      pinnedCompoundIds: args.pinnedCompoundIds,
    });

    if (scheduled) {
      // Auto-publish at the requested time.
      await ctx.scheduler.runAt(args.publishAt!, internal.homework.publishScheduled, {
        homeworkId,
      });
    } else if (!isDraft) {
      // Publish now: schedule personalized assignment for each student.
      await scheduleAssignment(ctx, homeworkId, args);
    }

    return homeworkId;
  },
});

// ── Internal: fire a scheduled homework at its publishAt time ──
export const publishScheduled = internalMutation({
  args: { homeworkId: v.id("homework") },
  handler: async (ctx, { homeworkId }) => {
    const hw = await ctx.db.get(homeworkId);
    // No-op if the row was deleted or already moved past "scheduled".
    if (!hw || hw.status !== "scheduled") return;
    await ctx.db.patch(homeworkId, { status: "active" });
    await scheduleAssignment(ctx, homeworkId, hw);
  },
});

// ── Teacher: publish a draft immediately (draft → active + fan-out) ──
export const publishHomework = mutation({
  args: { homeworkId: v.id("homework") },
  handler: async (ctx, { homeworkId }) => {
    const hw = await ctx.db.get(homeworkId);
    if (!hw) throw new Error("Homework not found");
    if (hw.status !== "draft") throw new Error("Only drafts can be published");
    await ctx.db.patch(homeworkId, { status: "active", publishAt: undefined });
    await scheduleAssignment(ctx, homeworkId, hw);
  },
});

// ── Teacher: edit a draft (blocked once it's live) ──
export const updateHomework = mutation({
  args: {
    homeworkId: v.id("homework"),
    title: v.optional(v.string()),
    topicIds: v.optional(v.array(v.id("topics"))),
    teacherNotes: v.optional(v.string()),
    questionCount: v.optional(v.number()),
    deadline: v.optional(v.number()),
    pinnedQuestionIds: v.optional(v.array(v.id("questions"))),
    pinnedCompoundIds: v.optional(v.array(v.id("compoundQuestions"))),
  },
  handler: async (ctx, args) => {
    const hw = await ctx.db.get(args.homeworkId);
    if (!hw) throw new Error("Homework not found");
    if (hw.status !== "draft") throw new Error("Only drafts can be edited");

    const patch: Partial<Doc<"homework">> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.topicIds !== undefined) patch.topicIds = args.topicIds;
    if (args.teacherNotes !== undefined) patch.teacherNotes = args.teacherNotes;
    if (args.questionCount !== undefined) patch.questionCount = args.questionCount;
    if (args.deadline !== undefined) patch.deadline = args.deadline;
    if (args.pinnedQuestionIds !== undefined) patch.pinnedQuestionIds = args.pinnedQuestionIds;
    if (args.pinnedCompoundIds !== undefined) patch.pinnedCompoundIds = args.pinnedCompoundIds;
    await ctx.db.patch(args.homeworkId, patch);
  },
});

// ── Teacher: cancel a scheduled publish (scheduled → draft) ──
// Only acts on "scheduled" rows: reverts to "draft" and clears publishAt. The
// already-queued publishScheduled job then no-ops (its status guard sees
// "draft", not "scheduled"), so no extra scheduler bookkeeping is needed.
export const cancelScheduled = mutation({
  args: { homeworkId: v.id("homework") },
  handler: async (ctx, { homeworkId }) => {
    const hw = await ctx.db.get(homeworkId);
    if (!hw) throw new Error("Homework not found");
    if (hw.status !== "scheduled") throw new Error("Only scheduled homework can be cancelled");
    await ctx.db.patch(homeworkId, { status: "draft", publishAt: undefined });
  },
});

// ── Teacher: delete a draft (drafts have no assignedQuestions to clean up) ──
export const deleteHomework = mutation({
  args: { homeworkId: v.id("homework") },
  handler: async (ctx, { homeworkId }) => {
    const hw = await ctx.db.get(homeworkId);
    if (!hw) throw new Error("Homework not found");
    if (hw.status !== "draft") throw new Error("Only drafts can be deleted");
    await ctx.db.delete(homeworkId);
  },
});

// ── Internal: personalize questions per student ──
export const assignToStudents = internalMutation({
  args: {
    homeworkId: v.id("homework"),
    classroomId: v.id("classrooms"),
    topicIds: v.array(v.id("topics")),
    questionCount: v.number(),
    pinnedQuestionIds: v.optional(v.array(v.id("questions"))),
    pinnedCompoundIds: v.optional(v.array(v.id("compoundQuestions"))),
  },
  handler: async (ctx, { homeworkId, classroomId, topicIds, questionCount, pinnedQuestionIds, pinnedCompoundIds }) => {
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

      // 2.5 Pin teacher-imported questions — every student gets these verbatim.
      // Intentionally NOT theme-personalized (teacher wants them as-is), so their
      // ids are kept out of insertedAssignedIds.
      let pinnedCount = 0;
      for (const qId of pinnedQuestionIds ?? []) {
        await ctx.db.insert("assignedQuestions", {
          homeworkId,
          studentId: student._id,
          questionId: qId,
          assignedDifficulty: targetDifficulty,
          personalizedReason: 'שאלה שנבחרה ע"י המורה',
          status: "pending",
        });
        pinnedCount++;
      }
      for (const cId of pinnedCompoundIds ?? []) {
        await ctx.db.insert("assignedQuestions", {
          homeworkId,
          studentId: student._id,
          compoundQuestionId: cId,
          assignedDifficulty: targetDifficulty,
          personalizedReason: 'שאלה שנבחרה ע"י המורה',
          status: "pending",
        });
        pinnedCount++;
      }

      // 3. Auto-select the remaining questions at the target difficulty (± 1 range)
      const remaining = Math.max(0, questionCount - pinnedCount);
      const selectedIds = new Set<string>();
      const insertedAssignedIds: Id<"assignedQuestions">[] = [];

      // Prefer compound questions
      const matchingCompound = compoundCandidates.filter(
        (q) => Math.abs(q.difficulty - targetDifficulty) <= 1
      );
      for (const q of matchingCompound) {
        if (selectedIds.size >= remaining) break;
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
      if (selectedIds.size < remaining) {
        const matchingLegacy = legacyCandidates.filter(
          (q) => Math.abs(q.difficulty - targetDifficulty) <= 1
        );
        for (const q of matchingLegacy) {
          if (selectedIds.size >= remaining) break;
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

// ── Teacher: get homework for a classroom (STUDENT-FACING) ──
// Excludes drafts and scheduled (not-yet-published) homework — the student side
// (StudentHomeworkList / StudentHomework) consumes this and must only ever see
// live/closed assignments.
export const getHomeworkForClassroom = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    // Stream newest-first and keep the first 20 visible rows — a classroom
    // with many drafts/scheduled rows must not starve the student list.
    const visible = [];
    const q = ctx.db
      .query("homework")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .order("desc");
    for await (const hw of q) {
      if (hw.status === "draft" || hw.status === "scheduled") continue;
      visible.push(hw);
      if (visible.length >= 20) break;
    }
    return visible;
  },
});

// ── Teacher: management console list (ALL statuses + submission counts) ──
// Every row is enriched with {submitted, total} where total = distinct students
// assigned and submitted = distinct students with at least one submitted row.
// Drafts / scheduled homework have no assignedQuestions yet, so both are 0.
export const getHomeworkForTeacher = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    const rows = await ctx.db
      .query("homework")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .order("desc")
      .take(50);

    const enriched = [];
    for (const hw of rows) {
      const assignments = await ctx.db
        .query("assignedQuestions")
        .withIndex("by_homework", (q) => q.eq("homeworkId", hw._id))
        .collect();
      // A student counts as "submitted" only when EVERY question assigned to
      // them is submitted (same convention as convex/notifications.ts).
      const perStudent = new Map<string, boolean>(); // studentId → all submitted so far
      for (const aq of assignments) {
        const key = aq.studentId.toString();
        const done = aq.status === "submitted";
        perStudent.set(key, (perStudent.get(key) ?? true) && done);
      }
      let submitted = 0;
      for (const allDone of perStudent.values()) if (allDone) submitted++;
      enriched.push({
        ...hw,
        total: perStudent.size,
        submitted,
      });
    }
    return enriched;
  },
});

// ── Teacher: load a single draft for the edit wizard ──
// Guarded to drafts — the wizard can only edit unpublished homework.
export const getHomeworkById = query({
  args: { homeworkId: v.id("homework") },
  handler: async (ctx, { homeworkId }) => {
    const hw = await ctx.db.get(homeworkId);
    if (!hw || hw.status !== "draft") return null;
    return hw;
  },
});

// ── Student: get their assigned questions for a homework ──
export const getStudentHomework = query({
  args: {
    homeworkId: v.id("homework"),
    studentId: v.id("students"),
  },
  handler: async (ctx, { homeworkId, studentId }) => {
    // No cap — a teacher can pin more than 10 questions (e.g. a full packet
    // import), and every assigned question must reach the student.
    const assigned = await ctx.db
      .query("assignedQuestions")
      .withIndex("by_homework_student", (q) =>
        q.eq("homeworkId", homeworkId).eq("studentId", studentId)
      )
      .collect();

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

    const wasSubmitted = aq.status === "submitted";
    await ctx.db.patch(assignedQuestionId, {
      status: "submitted",
      submittedAt: Date.now(),
      score,
    });

    // Gamification: award the homework-submitted bonus once, on first submit.
    if (!wasSubmitted) {
      await awardXpHelper(ctx, aq.studentId, 50, "homework_submitted", assignedQuestionId);
      await touchStreakHelper(ctx, aq.studentId);
    }
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
