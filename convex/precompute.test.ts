import { describe, it, expect, vi } from "vitest";
import { getMissingPrecomputations, purgeOrphanPrecomputations, savePrecomputedBatch } from "./precompute";

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

// This one deletes rows, so the thing worth pinning down is the blast radius:
// it must delete exactly the rows whose question is gone, and nothing else.
describe("purgeOrphanPrecomputations", () => {
  // A well-formed Convex id is 32 chars; anything else fails to decode, and a
  // bare db.get on it THROWS rather than returning null.
  const wellFormed = (s: string) => s.length === 32;

  function mockCtx(rows: Array<{ _id: string; questionId: string }>, liveIds: Set<string>) {
    const deleted: string[] = [];
    return {
      deleted,
      ctx: {
        db: {
          query: vi.fn().mockReturnValue({
            paginate: vi.fn().mockResolvedValue({ page: rows, isDone: true, continueCursor: "C" }),
          }),
          normalizeId: vi.fn().mockImplementation((_table: string, id: string) =>
            wellFormed(id) ? id : null),
          get: vi.fn().mockImplementation(async (id: string) => {
            if (!wellFormed(id)) throw new Error(`Unable to decode ID: Invalid ID length ${id.length}`);
            return liveIds.has(id) ? { _id: id } : null;
          }),
          delete: vi.fn().mockImplementation(async (id: string) => { deleted.push(id); }),
        },
      },
    };
  }

  const pad = (s: string) => s.padEnd(32, "0"); // valid 32-char shape
  const LIVE_Q = pad("qlive");
  const DEAD_Q = pad("qdead");
  const LIVE_CQ = pad("cqlive");
  const DEAD_CQ = pad("cqdead");
  // Verbatim from prod: 33 chars, decodes for neither table.
  const GARBLED = "jd70q6aw3023j1fd9tt6ts79518bm5q99";

  const rows = [
    { _id: "row-live-1", questionId: LIVE_Q },
    { _id: "row-dead-1", questionId: DEAD_Q },
    { _id: "row-live-2", questionId: LIVE_CQ },
    { _id: "row-dead-2", questionId: DEAD_CQ },
  ];
  const live = new Set([LIVE_Q, LIVE_CQ]);

  it("deletes only rows whose question no longer resolves", async () => {
    const { ctx, deleted } = mockCtx(rows, live);
    const res = await (purgeOrphanPrecomputations as any)._handler(ctx, {});
    expect(deleted).toEqual(["row-dead-1", "row-dead-2"]);
    expect(res.deleted).toBe(2);
    expect(res.scanned).toBe(4);
  });

  it("dryRun reports what it would remove without deleting anything", async () => {
    const { ctx, deleted } = mockCtx(rows, live);
    const res = await (purgeOrphanPrecomputations as any)._handler(ctx, { dryRun: true });
    expect(deleted).toEqual([]);
    expect(ctx.db.delete).not.toHaveBeenCalled();
    expect(res.orphans).toBe(2);
    expect(res.deleted).toBe(0);
  });

  it("deletes nothing when every question is still live", async () => {
    const allLive = new Set([LIVE_Q, DEAD_Q, LIVE_CQ, DEAD_CQ]);
    const { ctx, deleted } = mockCtx(rows, allLive);
    const res = await (purgeOrphanPrecomputations as any)._handler(ctx, {});
    expect(deleted).toEqual([]);
    expect(res.deleted).toBe(0);
  });

  it("signals completion with a null cursor so the caller stops", async () => {
    const { ctx } = mockCtx(rows, live);
    const res = await (purgeOrphanPrecomputations as any)._handler(ctx, {});
    expect(res.next).toBeNull();
  });

  // Regression: a bare db.get on the garbled prod id throws, which aborted the
  // whole purge partway. It must be treated as an orphan, not blow up the run.
  it("removes a row whose id is malformed instead of throwing", async () => {
    const withGarbled = [...rows, { _id: "row-garbled", questionId: GARBLED }];
    const { ctx, deleted } = mockCtx(withGarbled, live);
    const res = await (purgeOrphanPrecomputations as any)._handler(ctx, {});
    expect(deleted).toContain("row-garbled");
    expect(res.malformed).toBe(1);
    expect(res.deleted).toBe(3); // two dead questions + one undecodable id
  });

  it("still deletes the other orphans in a page containing a malformed id", async () => {
    const withGarbled = [{ _id: "row-garbled", questionId: GARBLED }, ...rows];
    const { ctx, deleted } = mockCtx(withGarbled, live);
    await (purgeOrphanPrecomputations as any)._handler(ctx, {});
    expect(deleted).toEqual(["row-garbled", "row-dead-1", "row-dead-2"]);
  });
});

// The garbled id above got written because savePrecomputedBatch inserted the
// id Gemini echoed back, unvalidated. Such a row can never match a question, so
// the pair reads as missing forever and the pipeline re-requests it every sweep.
describe("savePrecomputedBatch", () => {
  const pad = (s: string) => s.padEnd(32, "0");
  const LIVE = pad("qlive");
  const GARBLED = "jd70q6aw3023j1fd9tt6ts79518bm5q99";

  function mockCtx(liveIds: Set<string>) {
    const inserted: Array<Record<string, unknown>> = [];
    return {
      inserted,
      ctx: {
        db: {
          normalizeId: vi.fn().mockImplementation((_t: string, id: string) =>
            id.length === 32 ? id : null),
          get: vi.fn().mockImplementation(async (id: string) => (liveIds.has(id) ? { _id: id } : null)),
          query: vi.fn().mockReturnValue({
            withIndex: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }),
          }),
          insert: vi.fn().mockImplementation(async (_t: string, doc: Record<string, unknown>) => {
            inserted.push(doc);
          }),
        },
      },
    };
  }

  it("writes a rewrite whose id resolves to a real question", async () => {
    const { ctx, inserted } = mockCtx(new Set([LIVE]));
    const count = await (savePrecomputedBatch as any)._handler(ctx, {
      results: [{ id: LIVE, rewritten: "טקסט", theme: "כדורגל" }],
    });
    expect(count).toBe(1);
    expect(inserted).toHaveLength(1);
  });

  it("drops a model-garbled id instead of writing an unreachable row", async () => {
    const { ctx, inserted } = mockCtx(new Set([LIVE]));
    const count = await (savePrecomputedBatch as any)._handler(ctx, {
      results: [{ id: GARBLED, rewritten: "טקסט", theme: "ריקוד" }],
    });
    expect(count).toBe(0);
    expect(inserted).toEqual([]);
  });

  it("drops a well-formed id that no longer points at a question", async () => {
    const { ctx, inserted } = mockCtx(new Set([LIVE]));
    const count = await (savePrecomputedBatch as any)._handler(ctx, {
      results: [{ id: pad("gone"), rewritten: "טקסט", theme: "חלל" }],
    });
    expect(count).toBe(0);
    expect(inserted).toEqual([]);
  });

  it("keeps the good results in a batch that also contains a bad id", async () => {
    const { ctx, inserted } = mockCtx(new Set([LIVE]));
    const count = await (savePrecomputedBatch as any)._handler(ctx, {
      results: [
        { id: GARBLED, rewritten: "רע", theme: "ריקוד" },
        { id: LIVE, rewritten: "טוב", theme: "ריקוד" },
      ],
    });
    expect(count).toBe(1);
    expect(inserted[0].personalizedText).toBe("טוב");
  });
});
