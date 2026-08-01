import { describe, it, expect, vi } from "vitest";
import { getMissingPrecomputations } from "./precompute";

// This query used to scan every question x every theme on each run — ~3400
// document reads against Convex's 4096 ceiling, growing with the bank. It now
// walks one bounded page and threads a cursor forward, so what matters is that
// the cursor never strands work: stay on a page while it has gaps, advance when
// it is clean, switch tables at the end, and only report NULL when genuinely done.
describe("getMissingPrecomputations", () => {
  const THEME_COUNT = 10;

  /**
   * @param page          rows the paginated table returns
   * @param isDone        whether that table is exhausted
   * @param precomputed   set of "questionId:theme" keys that already exist
   */
  function mockCtx(opts: {
    page: Array<Record<string, unknown>>;
    isDone: boolean;
    precomputed?: Set<string>;
    continueCursor?: string;
  }) {
    const { page, isDone, precomputed = new Set(), continueCursor = "CURSOR_NEXT" } = opts;
    const paginate = vi.fn().mockResolvedValue({ page, isDone, continueCursor });
    return {
      db: {
        query: vi.fn().mockImplementation((table: string) => {
          if (table === "precomputedThemedQuestions") {
            return {
              withIndex: vi.fn().mockImplementation((_name: string, cb: (b: unknown) => unknown) => {
                // Replay the index builder to learn which (questionId, theme)
                // pair is being probed, then answer from the fixture set.
                const captured: Record<string, string> = {};
                const builder = {
                  eq: (field: string, value: string) => {
                    captured[field] = value;
                    return builder;
                  },
                };
                cb(builder);
                const hit = precomputed.has(`${captured.questionId}:${captured.theme}`);
                return { first: vi.fn().mockResolvedValue(hit ? { _id: "pre-1" } : null) };
              }),
            };
          }
          return { paginate };
        }),
      },
    };
  }

  const run = (ctx: unknown, args: Record<string, unknown> = {}) =>
    (getMissingPrecomputations as any)._handler(ctx, args);

  it("reports every theme gap for a fresh question, capped at the batch size", async () => {
    const ctx = mockCtx({ page: [{ _id: "q1", stem: "שאלה" }], isDone: false });
    const { missing } = await run(ctx);
    // One question x 10 themes = 10 gaps, all for the same question.
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.length).toBeLessThanOrEqual(10);
    expect(missing.every((m: any) => m.originalText === "שאלה")).toBe(true);
  });

  it("returns a single theme per run, so the caller makes one Gemini call", async () => {
    const page = Array.from({ length: 5 }, (_, i) => ({ _id: `q${i}`, stem: `שאלה ${i}` }));
    const ctx = mockCtx({ page, isDone: false });
    const { missing } = await run(ctx);
    expect(new Set(missing.map((m: any) => m.theme)).size).toBe(1);
  });

  it("stays on the same page while it still has gaps", async () => {
    const ctx = mockCtx({ page: [{ _id: "q1", stem: "שאלה" }], isDone: false });
    const { next } = await run(ctx, { table: "questions", cursor: "CURSOR_A" });
    expect(next).toEqual({ table: "questions", cursor: "CURSOR_A" });
  });

  it("advances to the next page once the current one is fully precomputed", async () => {
    const precomputed = new Set<string>();
    for (let t = 0; t < THEME_COUNT; t++) precomputed.add(`q1:${["כדורגל", "חברים", "מינקראפט", "מוזיקה פופ", "כדורסל", "הארי פוטר", "מרוצים", "בישול", "ריקוד", "חלל"][t]}`);
    const ctx = mockCtx({ page: [{ _id: "q1", stem: "שאלה" }], isDone: false, precomputed });
    const { missing, next } = await run(ctx, { table: "questions", cursor: "CURSOR_A" });
    expect(missing).toEqual([]);
    expect(next).toEqual({ table: "questions", cursor: "CURSOR_NEXT" });
  });

  it("hands off from questions to compoundQuestions when questions run out", async () => {
    const ctx = mockCtx({ page: [], isDone: true });
    const { next } = await run(ctx, { table: "questions", cursor: "CURSOR_A" });
    expect(next).toEqual({ table: "compoundQuestions", cursor: null });
  });

  it("reports the sweep complete only after compoundQuestions is exhausted too", async () => {
    const ctx = mockCtx({ page: [], isDone: true });
    const { next } = await run(ctx, { table: "compoundQuestions", cursor: "CURSOR_B" });
    expect(next).toBeNull();
  });

  it("reads the compound preamble, not the legacy stem, on the compound pass", async () => {
    const ctx = mockCtx({ page: [{ _id: "cq1", preamble: "פתיח" }], isDone: false });
    const { missing } = await run(ctx, { table: "compoundQuestions", cursor: null });
    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0].originalText).toBe("פתיח");
  });

  it("skips rows with no text instead of queuing empty rewrites", async () => {
    const ctx = mockCtx({ page: [{ _id: "q1" }, { _id: "q2", stem: "" }], isDone: false });
    const { missing } = await run(ctx);
    expect(missing).toEqual([]);
  });
});
