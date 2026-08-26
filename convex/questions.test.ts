import { describe, it, expect, vi } from "vitest";
import { getNextQuestion } from "./questions";

// The point of this filter: once a student has gotten a question right, it
// must never come back — a wrong attempt is fair game (spaced repetition),
// but a solved one is just wasted practice now that the bank is big enough
// to always have something fresh at the student's level.
describe("getNextQuestion", () => {
  const studentId = "student-1" as any;
  const topicId = "topic-1" as any;

  const q = (id: string, difficulty: number) => ({ _id: id, topicId, difficulty });

  // Builds a ctx whose "attempts"/"sessions"/"questions" queries answer from
  // the given fixtures, following each call's own withIndex/order/take/collect
  // chain — mirrors the dispatch-by-table-name pattern in levels.test.ts.
  function mockCtx(opts: {
    topicAttempts?: Array<{ questionId: string; isCorrect: boolean }>;
    recentAttempts?: Array<{ questionId: string }>;
    session?: { currentDifficulty: number } | null;
    atDifficulty: ReturnType<typeof q>[];
    atTopic?: ReturnType<typeof q>[];
    student?: { homeworkTheme?: string } | null;
    /** "questionId:theme" → the themed stem stored for that pair. */
    themed?: Record<string, string>;
  }) {
    const { topicAttempts = [], recentAttempts = [], session = null, atDifficulty, atTopic = atDifficulty, student = null, themed = {} } = opts;
    return {
      db: {
        get: vi.fn().mockResolvedValue(student),
        query: vi.fn().mockImplementation((table: string) => {
          if (table === "attempts") {
            // Two distinct call sites on the same table, and since both are now
            // bounded reads (order + take) the chain shape no longer tells them
            // apart — dispatch on the index name instead, same as `questions`
            // below. by_student_topic feeds solvedIds; by_student feeds the
            // last-10 recency window.
            return {
              withIndex: vi.fn().mockImplementation((indexName: string) => ({
                order: vi.fn().mockReturnValue({
                  take: vi.fn().mockResolvedValue(
                    indexName === "by_student_topic" ? topicAttempts : recentAttempts,
                  ),
                }),
              })),
            };
          }
          if (table === "sessions") {
            return { withIndex: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(session) }) }) };
          }
          if (table === "questions") {
            // Dispatch on the index name itself (matches the two distinct
            // .withIndex("by_topic_difficulty" | "by_topic", ...) call sites in
            // the handler) rather than call order, so this stays correct no
            // matter how many times a test re-invokes the handler on one ctx.
            return {
              withIndex: vi.fn().mockImplementation((indexName: string) => ({
                collect: vi.fn().mockResolvedValue(indexName === "by_topic_difficulty" ? atDifficulty : atTopic),
              })),
            };
          }
          if (table === "precomputedThemedQuestions") {
            // Replay the index builder to learn which (questionId, theme) pair
            // is being probed, then answer from the fixture map.
            return {
              withIndex: vi.fn().mockImplementation((_name: string, cb: (b: unknown) => unknown) => {
                const captured: Record<string, string> = {};
                const builder = {
                  eq: (field: string, value: string) => {
                    captured[field] = value;
                    return builder;
                  },
                };
                cb(builder);
                const hit = themed[`${captured.questionId}:${captured.theme}`];
                return { first: vi.fn().mockResolvedValue(hit ? { personalizedText: hit } : null) };
              }),
            };
          }
          throw new Error(`unexpected table ${table}`);
        }),
      },
    };
  }

  it("never returns a question already answered correctly, even with room left at the level", async () => {
    const ctx = mockCtx({
      topicAttempts: [{ questionId: "q1", isCorrect: true }],
      session: { currentDifficulty: 2 },
      atDifficulty: [q("q1", 2), q("q2", 2), q("q3", 2)],
    });
    for (let i = 0; i < 20; i++) {
      const picked = await (getNextQuestion as any)._handler(ctx, { studentId, topicId });
      expect(picked._id).not.toBe("q1");
    }
  });

  it("does not permanently exclude a question answered incorrectly", async () => {
    const ctx = mockCtx({
      topicAttempts: [{ questionId: "q1", isCorrect: false }],
      session: { currentDifficulty: 2 },
      atDifficulty: [q("q1", 2)],
    });
    const picked = await (getNextQuestion as any)._handler(ctx, { studentId, topicId });
    expect(picked._id).toBe("q1");
  });

  it("is random, not deterministic, across the surviving candidates", async () => {
    const ctx = mockCtx({
      session: { currentDifficulty: 1 },
      atDifficulty: [q("q1", 1), q("q2", 1), q("q3", 1), q("q4", 1)],
    });
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const picked = await (getNextQuestion as any)._handler(ctx, { studentId, topicId });
      seen.add(picked._id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("widens to other difficulties before ever repeating a solved question", async () => {
    const ctx = mockCtx({
      topicAttempts: [{ questionId: "q1", isCorrect: true }],
      session: { currentDifficulty: 2 },
      atDifficulty: [q("q1", 2)], // level 2 is fully solved
      atTopic: [q("q1", 2), q("q5", 3)], // but the topic has an unsolved q at level 3
    });
    const picked = await (getNextQuestion as any)._handler(ctx, { studentId, topicId });
    expect(picked._id).toBe("q5");
  });

  it("only repeats a solved question once the entire topic is exhausted", async () => {
    const ctx = mockCtx({
      topicAttempts: [{ questionId: "q1", isCorrect: true }],
      session: { currentDifficulty: 2 },
      atDifficulty: [q("q1", 2)],
      atTopic: [q("q1", 2)], // nothing else anywhere in the topic
    });
    const picked = await (getNextQuestion as any)._handler(ctx, { studentId, topicId });
    expect(picked._id).toBe("q1");
  });

  it("returns null for a topic with no questions at all", async () => {
    const ctx = mockCtx({ session: { currentDifficulty: 1 }, atDifficulty: [], atTopic: [] });
    const picked = await (getNextQuestion as any)._handler(ctx, { studentId, topicId });
    expect(picked).toBeNull();
  });

  // Nothing generates themed variants any more, but ~10.5k already exist and
  // are still served. The contract is: use one when it exists for this
  // student's theme, and fall back to the original stem in every other case —
  // no theme set, or no row for this question.
  describe("themed stems", () => {
    it("serves the themed variant when one exists for the student's theme", async () => {
      const ctx = mockCtx({
        session: { currentDifficulty: 1 },
        atDifficulty: [q("q1", 1)],
        student: { homeworkTheme: "כדורגל" },
        themed: { "q1:כדורגל": "מסי בועט 3 בעיטות..." },
      });
      const picked = await (getNextQuestion as any)._handler(ctx, { studentId, topicId });
      expect(picked.stem).toBe("מסי בועט 3 בעיטות...");
    });

    it("leaves the stem alone when no variant was generated for that pair", async () => {
      const ctx = mockCtx({
        session: { currentDifficulty: 1 },
        atDifficulty: [{ ...q("q1", 1), stem: "מקורי" } as never],
        student: { homeworkTheme: "מינקראפט" },
        themed: { "q1:כדורגל": "לא רלוונטי" },
      });
      const picked = await (getNextQuestion as any)._handler(ctx, { studentId, topicId });
      expect(picked.stem).toBe("מקורי");
    });

    it("skips the lookup entirely when the student has no theme", async () => {
      const ctx = mockCtx({
        session: { currentDifficulty: 1 },
        atDifficulty: [{ ...q("q1", 1), stem: "מקורי" } as never],
        student: {},
        themed: { "q1:כדורגל": "לא רלוונטי" },
      });
      const picked = await (getNextQuestion as any)._handler(ctx, { studentId, topicId });
      expect(picked.stem).toBe("מקורי");
    });
  });
});
