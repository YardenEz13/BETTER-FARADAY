// ── Idempotent seeder for the bagrut-style question bank ──
// Run with: npx convex run seedBagrut:seedBagrutQuestions
// Dedup: simple questions are matched by (topicId, stem); compound questions
// by preamble. Re-running inserts only what is missing.
import { mutation } from "./_generated/server";
import {
  SEQUENCES_QUESTIONS,
  PROBABILITY_QUESTIONS,
  type SimpleQuestionSeed,
} from "./seedBagrutData1";
import { TRIG_QUESTIONS, RATIONAL_QUESTIONS } from "./seedBagrutData2";
import {
  GEOMETRY_QUESTIONS,
  COMPOUND_QUESTIONS,
} from "./seedBagrutData3";

const ALL_SIMPLE: SimpleQuestionSeed[] = [
  ...SEQUENCES_QUESTIONS,
  ...PROBABILITY_QUESTIONS,
  ...TRIG_QUESTIONS,
  ...RATIONAL_QUESTIONS,
  ...GEOMETRY_QUESTIONS,
];

export const seedBagrutQuestions = mutation({
  args: {},
  handler: async (ctx) => {
    const topics = await ctx.db.query("topics").collect();
    const topicIdByHe = new Map(topics.map((t) => [t.nameHe, t._id]));

    // ── Simple (multiple-choice) questions, dedup by stem within topic ──
    let inserted = 0;
    let skippedExisting = 0;
    const skippedTopics = new Set<string>();
    const perTopic: Record<string, number> = {};

    // Existing stems per topic (bank is small — a few hundred rows at most).
    const existingStems = new Set<string>();
    const existingQuestions = await ctx.db.query("questions").collect();
    for (const q of existingQuestions) {
      existingStems.add(`${q.topicId}|${q.stem}`);
    }

    for (const q of ALL_SIMPLE) {
      const topicId = topicIdByHe.get(q.topicHe);
      if (!topicId) {
        skippedTopics.add(q.topicHe);
        continue;
      }
      const key = `${topicId}|${q.stem}`;
      if (existingStems.has(key)) {
        skippedExisting++;
        continue;
      }
      await ctx.db.insert("questions", {
        topicId,
        difficulty: q.difficulty,
        stem: q.stem,
        choices: q.choices,
        correctIndex: q.correctIndex,
        solutionSteps: q.solutionSteps,
        hint: q.hint,
        explanation: q.explanation,
      });
      existingStems.add(key);
      inserted++;
      perTopic[q.topicHe] = (perTopic[q.topicHe] ?? 0) + 1;
    }

    // ── Compound (multi-section) questions, dedup by preamble ──
    let compoundInserted = 0;
    let compoundSkipped = 0;
    const existingCompound = await ctx.db.query("compoundQuestions").collect();
    const existingPreambles = new Set(existingCompound.map((c) => c.preamble));

    for (const cq of COMPOUND_QUESTIONS) {
      if (existingPreambles.has(cq.preamble)) {
        compoundSkipped++;
        continue;
      }
      const topicIds = cq.topicsHe
        .map((he) => topicIdByHe.get(he))
        .filter((id): id is NonNullable<typeof id> => id !== undefined);
      if (topicIds.length === 0) {
        skippedTopics.add(cq.topicsHe.join(","));
        continue;
      }
      await ctx.db.insert("compoundQuestions", {
        topicIds,
        difficulty: cq.difficulty,
        tags: cq.tags,
        preamble: cq.preamble,
        preambleParams: [],
        sections: cq.sections.map((s) => ({
          label: s.label,
          prompt: s.prompt,
          dependsOn: s.dependsOn,
          answerType: s.answerType,
          correctAnswer: s.correctAnswer,
          solutionSteps: s.solutionSteps,
          hints: s.hints,
          points: s.points,
          skillsTested: s.skillsTested,
        })),
        fullSolution: cq.fullSolution,
      });
      existingPreambles.add(cq.preamble);
      compoundInserted++;
    }

    return {
      simpleInserted: inserted,
      simpleSkippedExisting: skippedExisting,
      // Convex field names must be ASCII — return Hebrew topic names as pairs.
      perTopic: Object.entries(perTopic).map(([topic, count]) => ({ topic, count })),
      compoundInserted,
      compoundSkipped,
      missingTopics: [...skippedTopics],
    };
  },
});
