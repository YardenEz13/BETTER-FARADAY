import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Retention engine — per-topic "charge" with a forgetting curve.
 *
 * A topic's charge starts from the student's accuracy in it and drains
 * exponentially with time since the last practice (half-life 10 days), like a
 * battery losing charge. Fresh practice = full accuracy; two idle weeks
 * roughly halves it. This is what makes the map honest: a node you aced a
 * month ago should not glow like one you aced yesterday.
 */
const HALF_LIFE_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export const getTopicCharges = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();

    const topics = await ctx.db.query("topics").collect();
    const now = Date.now();

    const byTopic = new Map<string, { correct: number; total: number; lastAt: number }>();
    for (const a of attempts) {
      const key = a.topicId as string;
      const t = byTopic.get(key) ?? { correct: 0, total: 0, lastAt: 0 };
      t.total++;
      if (a.isCorrect) t.correct++;
      if (a._creationTime > t.lastAt) t.lastAt = a._creationTime;
      byTopic.set(key, t);
    }

    return topics.map((topic) => {
      const t = byTopic.get(topic._id as string);
      if (!t || t.total === 0) {
        return { topicId: topic._id, nameHe: topic.nameHe, charge: null, accuracy: null, daysSince: null, decaying: false };
      }
      const accuracy = Math.round((t.correct / t.total) * 100);
      const daysSince = (now - t.lastAt) / DAY_MS;
      const decay = Math.pow(0.5, daysSince / HALF_LIFE_DAYS);
      const charge = Math.round(accuracy * decay);
      return {
        topicId: topic._id,
        nameHe: topic.nameHe,
        charge,
        accuracy,
        daysSince: Math.floor(daysSince),
        // "decaying" = was in decent shape but has drained noticeably — worth a recharge nudge
        decaying: accuracy >= 60 && accuracy - charge >= 15,
      };
    });
  },
});
