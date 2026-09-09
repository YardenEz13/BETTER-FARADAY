// ── Minimal deterministic seed for e2e smoke tests and load tests ──
// Creates one classroom, one student, one topic, and three easy questions.
// Idempotent: matched by the fixed names below, so re-running is a no-op.
// Internal-only — run with `npx convex run seedE2E:seed`.
import { internalMutation } from "./_generated/server";

export const E2E_CLASSROOM = "כיתת בדיקות E2E";
export const E2E_STUDENT = "תלמיד בדיקה";
export const E2E_TOPIC_HE = "חשבון בסיסי (בדיקות)";
export const E2E_HOMEWORK = "שיעורי בית לבדיקה E2E";
/** The seeded homework section's stored answer — a ROOT, deliberately.
 *  Entering and grading √2 is the exact path that was broken in both
 *  directions (unenterable on a Hebrew keyboard, then graded wrong), so the
 *  homework spec drives it end to end. */
export const E2E_HOMEWORK_ANSWER = "√2";

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const classroom = (await ctx.db.query("classrooms").collect()).find(
      (c) => c.name === E2E_CLASSROOM,
    );
    const classroomId =
      classroom?._id ??
      (await ctx.db.insert("classrooms", { name: E2E_CLASSROOM, teacherName: "מורה בדיקה" }));

    const student = (await ctx.db.query("students").withIndex("by_classroom", (q) => q.eq("classroomId", classroomId)).collect()).find(
      (s) => s.name === E2E_STUDENT,
    );
    const studentId =
      student?._id ??
      (await ctx.db.insert("students", {
        name: E2E_STUDENT,
        classroomId,
        avatarColor: "#10b981",
        streak: 0,
        level: 1,
        onboardedAt: Date.now(), // skip the first-run wizard in tests
      }));

    const topic = (await ctx.db.query("topics").collect()).find((t) => t.nameHe === E2E_TOPIC_HE);
    const topicId =
      topic?._id ??
      (await ctx.db.insert("topics", {
        name: "basic-arithmetic-e2e",
        nameHe: E2E_TOPIC_HE,
        order: 999,
        description: "נושא לבדיקות אוטומטיות",
        icon: "zap",
      }));

    const existingQs = await ctx.db
      .query("questions")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .collect();
    if (existingQs.length === 0) {
      const qs = [
        { stem: "כמה זה $2+2$?", choices: ["3", "4", "5", "6"], correctIndex: 1 },
        { stem: "כמה זה $3 \\cdot 3$?", choices: ["6", "8", "9", "12"], correctIndex: 2 },
        { stem: "כמה זה $10-7$?", choices: ["2", "3", "4", "7"], correctIndex: 1 },
      ];
      for (const q of qs) {
        await ctx.db.insert("questions", {
          topicId,
          difficulty: 1,
          stem: q.stem,
          choices: q.choices,
          correctIndex: q.correctIndex,
          solutionSteps: ["חשב ישירות"],
          hint: "חשב צעד-צעד",
          explanation: "חישוב ישיר",
        });
      }
    }

    // ── One homework assignment, so the submission path is testable ──
    // A compound question with a single numeric section. Without this the e2e
    // suite could only cover practice; homework is where the answer editor and
    // the grader actually meet.
    const compound = (await ctx.db.query("compoundQuestions").collect()).find(
      (c) => c.preamble.includes("E2E"),
    );
    const compoundId =
      compound?._id ??
      (await ctx.db.insert("compoundQuestions", {
        topicIds: [topicId],
        difficulty: 1,
        tags: ["בדיקות"],
        preamble: "שאלת E2E: נתון ריבוע ששטחו 2.",
        preambleParams: [],
        sections: [{
          label: "א",
          prompt: "מהו אורך צלע הריבוע?",
          answerType: "numeric",
          correctAnswer: E2E_HOMEWORK_ANSWER,
          solutionSteps: ["צלע הריבוע היא השורש הריבועי של השטח"],
          hints: ["חשבו שורש ריבועי של 2"],
          points: 100,
          skillsTested: ["שורשים"],
        }],
        fullSolution: "הצלע היא $\\sqrt{2}$",
      }));

    const homework = (await ctx.db.query("homework").withIndex("by_classroom", (q) => q.eq("classroomId", classroomId)).collect()).find(
      (h) => h.title === E2E_HOMEWORK,
    );
    const homeworkId =
      homework?._id ??
      (await ctx.db.insert("homework", {
        classroomId,
        title: E2E_HOMEWORK,
        topicIds: [topicId],
        questionCount: 1,
        createdAt: Date.now(),
        // Far enough out that the fixture never expires mid-suite.
        deadline: Date.now() + 365 * 24 * 60 * 60 * 1000,
        status: "active",
        pinnedCompoundIds: [compoundId],
      }));

    const assigned = (await ctx.db.query("assignedQuestions").withIndex("by_homework_student", (q) =>
      q.eq("homeworkId", homeworkId).eq("studentId", studentId)).collect())[0];
    if (!assigned) {
      await ctx.db.insert("assignedQuestions", {
        homeworkId,
        studentId,
        compoundQuestionId: compoundId,
        assignedDifficulty: 1,
        personalizedReason: "fixture",
        status: "pending",
      });
    }

    return { classroomId, studentId, topicId, homeworkId, compoundId };
  },
});

// ── Load-test roster: N extra students in the E2E classroom ──
// Fixture roster for whatever load-test scenario gets written before the
// pilot (the old k6 suite was deleted as unused — see docs/deploy.md).
// Idempotent by name. `npx convex run seedE2E:seedLoadStudents [--prod]`
export const LOAD_STUDENT_PREFIX = "לוד-טסט";
const LOAD_STUDENT_COUNT = 50;

export const seedLoadStudents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const classroom = (await ctx.db.query("classrooms").collect()).find(
      (c) => c.name === E2E_CLASSROOM,
    );
    if (!classroom) throw new Error("Run seedE2E:seed first");

    const existing = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroom._id))
      .collect();
    const names = new Set(existing.map((s) => s.name));

    let inserted = 0;
    for (let i = 1; i <= LOAD_STUDENT_COUNT; i++) {
      const name = `${LOAD_STUDENT_PREFIX} ${i}`;
      if (names.has(name)) continue;
      await ctx.db.insert("students", {
        name,
        classroomId: classroom._id,
        avatarColor: "#6366f1",
        streak: 0,
        level: 1,
        onboardedAt: Date.now(),
      });
      inserted++;
    }
    return { classroomId: classroom._id, inserted, total: LOAD_STUDENT_COUNT };
  },
});
