// ── Minimal deterministic seed for e2e smoke tests and load tests ──
// Creates one classroom, one student, one topic, and three easy questions.
// Idempotent: matched by the fixed names below, so re-running is a no-op.
// Internal-only — run with `npx convex run seedE2E:seed`.
import { internalMutation } from "./_generated/server";

export const E2E_CLASSROOM = "כיתת בדיקות E2E";
export const E2E_STUDENT = "תלמיד בדיקה";
export const E2E_TOPIC_HE = "חשבון בסיסי (בדיקות)";

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

    return { classroomId, studentId, topicId };
  },
});

// ── Load-test roster: N extra students in the E2E classroom ──
// The k6 live-write scenario (loadtest/convex_live_write.js) answers as these
// students. Idempotent by name. `npx convex run seedE2E:seedLoadStudents [--prod]`
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
