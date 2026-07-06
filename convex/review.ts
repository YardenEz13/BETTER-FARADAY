import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { awardXpHelper } from "./xp";
import { touchStreakHelper } from "./streaks";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const DECK_LIMIT = 10;

// ── Wrong-answer review deck ──
// Surfaces questions the student got wrong and hasn't since mastered. Uses the
// by_student index (no full scan) and bounds the scan window to the recent
// attempt history.
export const getReviewDeck = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;

    // Recent attempts, newest first. Bounded read; _creationTime tracks time.
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(500);

    // Per question, track: last correct time, list of miss times.
    type Agg = { lastCorrectAt: number; missTimes: number[]; topicId: Id<"topics"> };
    const byQuestion = new Map<Id<"questions">, Agg>();

    for (const a of attempts) {
      if (a._creationTime < cutoff) continue;
      let agg = byQuestion.get(a.questionId);
      if (!agg) {
        agg = { lastCorrectAt: 0, missTimes: [], topicId: a.topicId };
        byQuestion.set(a.questionId, agg);
      }
      if (a.isCorrect) {
        agg.lastCorrectAt = Math.max(agg.lastCorrectAt, a._creationTime);
      } else {
        agg.missTimes.push(a._creationTime);
      }
    }

    const now = Date.now();
    const candidates: Array<{ questionId: Id<"questions">; topicId: Id<"topics">; lastMissAt: number; missCount: number }> = [];

    for (const [questionId, agg] of byQuestion) {
      if (agg.missTimes.length === 0) continue;
      const lastMissAt = Math.max(...agg.missTimes);
      // Exclude questions answered correctly AFTER the most recent miss (mastered).
      if (agg.lastCorrectAt > lastMissAt) continue;
      // Resurface only if the miss is older than 2 days OR missed 2+ times.
      const isStale = now - lastMissAt > TWO_DAYS_MS;
      const missedOften = agg.missTimes.length >= 2;
      if (!isStale && !missedOften) continue;
      candidates.push({ questionId, topicId: agg.topicId, lastMissAt, missCount: agg.missTimes.length });
    }

    // Prioritize most-missed, then oldest miss.
    candidates.sort((a, b) => b.missCount - a.missCount || a.lastMissAt - b.lastMissAt);
    const top = candidates.slice(0, DECK_LIMIT);

    const topicNameCache = new Map<Id<"topics">, string>();
    const deck = [];
    for (const c of top) {
      const question = await ctx.db.get(c.questionId);
      if (!question) continue;
      let topicName = topicNameCache.get(c.topicId);
      if (topicName === undefined) {
        const topic = await ctx.db.get(c.topicId);
        topicName = topic?.nameHe ?? "";
        topicNameCache.set(c.topicId, topicName);
      }
      deck.push({
        questionId: c.questionId,
        topicId: c.topicId,
        topicName,
        missCount: c.missCount,
        lastMissAt: c.lastMissAt,
        stem: question.stem,
        choices: question.choices,
        correctIndex: question.correctIndex,
        hint: question.hint,
        explanation: question.explanation,
        difficulty: question.difficulty,
      });
    }

    return deck;
  },
});

// ── Record a review answer ──
// Inserts a review-tagged attempt, awards XP for correct answers, and keeps the
// streak alive.
export const recordReviewResult = mutation({
  args: {
    studentId: v.id("students"),
    questionId: v.id("questions"),
    isCorrect: v.boolean(),
  },
  handler: async (ctx, { studentId, questionId, isCorrect }) => {
    const question = await ctx.db.get(questionId);
    if (!question) throw new Error("Question not found");

    await ctx.db.insert("attempts", {
      studentId,
      questionId,
      topicId: question.topicId,
      isCorrect,
      choiceIndex: -1, // review flow doesn't track the chosen index
      timeMs: 0,
      hintsUsed: 0,
      difficulty: question.difficulty,
      source: "review",
    });

    if (isCorrect) {
      await awardXpHelper(ctx, studentId, 8, "review_correct", questionId);
    }
    await touchStreakHelper(ctx, studentId);

    return { isCorrect };
  },
});
