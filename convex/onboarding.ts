import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { awardXpHelper } from "./xp";

// ── First-run student onboarding ──
// A brand-new student (created after this ship) has no `onboardedAt`, so the
// StudentHome page redirects them to the /welcome wizard. The wizard collects
// an avatar color + homework theme, runs a tiny 3-question placement quiz, and
// then `completeOnboarding` seeds their level and stamps onboardedAt.
//
// Existing students also lack `onboardedAt`; `markExistingOnboarded` (run once
// at deploy time) stamps everyone who already has attempts/sessions so they are
// NOT forced back through the wizard.

const WELCOME_XP = 25;

export const getOnboardingState = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) return null;
    return {
      needed: student.onboardedAt === undefined,
      name: student.name,
      avatarColor: student.avatarColor,
      homeworkTheme: student.homeworkTheme ?? null,
      level: student.level ?? null,
    };
  },
});

// A tiny placement quiz: 3 questions spread across difficulty buckets, drawn
// deterministically from a mid-order topic so every new student gets the same
// stable set. Returns just what the wizard needs to render + grade.
export const getPlacementQuiz = query({
  args: {},
  handler: async (ctx) => {
    const topics = await ctx.db.query("topics").collect();
    if (topics.length === 0) return [];
    const ordered = [...topics].sort((a, b) => a.order - b.order);
    // A mid-order topic — new-student-friendly but not the very first trivial one.
    const topic = ordered[Math.min(ordered.length - 1, Math.floor(ordered.length / 2))];

    const questions = await ctx.db
      .query("questions")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    if (questions.length === 0) return [];

    // First question per difficulty bucket (deterministic): easy (1-2), mid (3),
    // hard (4-5). Fall back to filling from the pool if a bucket is empty so we
    // always return 3 distinct questions when the topic has enough.
    const byId = new Map(questions.map((q) => [q._id, q]));
    const pickFirst = (pred: (d: number) => boolean) =>
      questions.find((q) => pred(q.difficulty))?._id;

    const chosen: Id<"questions">[] = [];
    const add = (id?: Id<"questions">) => {
      if (id && !chosen.includes(id)) chosen.push(id);
    };
    add(pickFirst((d) => d <= 2));
    add(pickFirst((d) => d === 3));
    add(pickFirst((d) => d >= 4));
    // Backfill to 3 from anything remaining.
    for (const q of questions) {
      if (chosen.length >= 3) break;
      add(q._id);
    }

    return chosen.slice(0, 3).map((id) => {
      const q = byId.get(id)!;
      return {
        questionId: q._id,
        stem: q.stem,
        choices: q.choices,
        correctIndex: q.correctIndex,
        difficulty: q.difficulty,
        topicId: q.topicId,
      };
    });
  },
});

// Grade the placement quiz, seed level, set the starting topic, award the
// welcome bonus, record the attempts, and stamp onboardedAt. Idempotent: a
// no-op (returns alreadyOnboarded) if the student already finished.
export const completeOnboarding = mutation({
  args: {
    studentId: v.id("students"),
    avatarColor: v.string(),
    homeworkTheme: v.optional(v.string()),
    quizAnswers: v.array(
      v.object({
        questionId: v.id("questions"),
        choiceIndex: v.number(),
      }),
    ),
  },
  handler: async (ctx, { studentId, avatarColor, homeworkTheme, quizAnswers }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    if (student.onboardedAt !== undefined) {
      return { alreadyOnboarded: true, level: student.level ?? 1 };
    }

    // Grade against the real questions and record each as a placement attempt.
    let correct = 0;
    for (const ans of quizAnswers) {
      const q = await ctx.db.get(ans.questionId);
      if (!q) continue;
      const isCorrect = ans.choiceIndex === q.correctIndex;
      if (isCorrect) correct++;
      await ctx.db.insert("attempts", {
        studentId,
        questionId: ans.questionId,
        topicId: q.topicId,
        isCorrect,
        choiceIndex: ans.choiceIndex,
        timeMs: 0,
        hintsUsed: 0,
        difficulty: q.difficulty,
        source: "placement",
      });
    }

    // Seed level from placement score: 0-1 → 1, 2 → 2, 3 → 3.
    const level = correct >= 3 ? 3 : correct === 2 ? 2 : 1;

    // Start them on the first topic (by order) if they have none yet.
    let currentTopicId: Id<"topics"> | undefined = student.currentTopicId;
    if (currentTopicId === undefined) {
      const topics = await ctx.db.query("topics").collect();
      const first = [...topics].sort((a, b) => a.order - b.order)[0];
      if (first) currentTopicId = first._id;
    }

    const patch: Partial<Doc<"students">> = {
      avatarColor,
      level,
      onboardedAt: Date.now(),
    };
    if (homeworkTheme && homeworkTheme.trim()) patch.homeworkTheme = homeworkTheme.trim();
    if (currentTopicId !== undefined) patch.currentTopicId = currentTopicId;
    await ctx.db.patch(studentId, patch);

    await awardXpHelper(ctx, studentId, WELCOME_XP, "onboarding");

    return { alreadyOnboarded: false, level, correct, xpAwarded: WELCOME_XP };
  },
});

// ── One-off deploy migration (run: `npx convex run onboarding:markExistingOnboarded`) ──
// Stamp onboardedAt on every student who already has attempts OR sessions — they
// are clearly established users and must not be dropped into the new wizard.
// Idempotent: only touches rows still missing onboardedAt.
export const markExistingOnboarded = internalMutation({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    let stamped = 0;
    for (const s of students) {
      if (s.onboardedAt !== undefined) continue;
      const attempt = await ctx.db
        .query("attempts")
        .withIndex("by_student", (q) => q.eq("studentId", s._id))
        .first();
      const session = await ctx.db
        .query("sessions")
        .withIndex("by_student", (q) => q.eq("studentId", s._id))
        .first();
      if (attempt || session) {
        await ctx.db.patch(s._id, { onboardedAt: s._creationTime });
        stamped++;
      }
    }
    return { stamped, total: students.length };
  },
});
