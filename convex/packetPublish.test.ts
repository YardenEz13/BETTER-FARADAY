import { describe, it, expect, vi } from "vitest";
import { publishRow } from "./packetImport";

// Minimal MutationCtx.db mock: records inserts per table and patches per id.
function makeCtx() {
  const tables: Record<string, any[]> = { questions: [], compoundQuestions: [] };
  const patches: Record<string, any> = {};
  const db = {
    insert: vi.fn(async (table: string, doc: any) => {
      const id = `${table}_${tables[table].length}`;
      tables[table].push({ _id: id, ...doc });
      return id;
    }),
    patch: vi.fn(async (id: string, patch: any) => {
      patches[id] = { ...(patches[id] ?? {}), ...patch };
    }),
    get: vi.fn(),
  };
  return { ctx: { db } as any, tables, patches };
}

const mcRow = {
  _id: "row_mc",
  status: "review",
  topicId: "t1",
  draft: {
    kind: "simple",
    format: "multiple_choice",
    difficulty: 3,
    stem: "כמה זה $2+2$?",
    choices: ["3", "4", "5", "6"],
    correctIndex: 1,
    solutionSteps: ["חבר"],
    hints: ["רמז", "עוד רמז"],
    explanation: "ארבע",
  },
} as any;

const fillRow = {
  _id: "row_fill",
  status: "review",
  topicId: "t1",
  draft: {
    kind: "simple",
    format: "fill_blank",
    difficulty: 2,
    stem: "פתור $x+3=10$",
    choices: [],
    correctAnswer: "7",
    solutionSteps: ["העבר אגף"],
    hints: ["בודד את x", "חסר 3"],
    explanation: "x=7",
  },
} as any;

function proofRow(opts: { proofReviewedAt?: number; proofSteps?: any[] } = {}) {
  const proofSteps = opts.proofSteps ?? [
    { stepIndex: 0, expectedClaim: "AO = OC", expectedReason: "אלכסוני מקבילית מחצים זה את זה" },
    { stepIndex: 1, expectedClaim: "AOB ≅ COD", expectedReason: "צ.ז.צ" },
  ];
  const proofReviewedAt = "proofReviewedAt" in opts ? opts.proofReviewedAt : 123;
  return {
    _id: "row_proof",
    status: "proof_unverified",
    topicId: "t1",
    proofReviewedAt,
    draft: {
      kind: "compound",
      difficulty: 3,
      tags: ["מקבילית", "SAS"],
      preamble: "ABCD מקבילית, O חיתוך האלכסונים.",
      fullSolution: "לפי צ.ז.צ המשולשים חופפים.",
      sections: [
        {
          label: "א",
          prompt: "הוכח כי AOB חופף COD",
          answerType: "proof",
          correctAnswer: "משולש AOB חופף למשולש COD",
          solutionSteps: [],
          hints: ["מה ידוע על אלכסוני מקבילית?", "איזה משפט חפיפה?"],
          points: 100,
          skillsTested: ["חפיפה"],
          proofMeta: { given: "ABCD מקבילית", toProve: "AOB ≅ COD" },
          proofSteps,
        },
      ],
    },
  } as any;
}

describe("publishRow", () => {
  it("publishes multiple_choice to the questions table with hint = hints[0]", async () => {
    const { ctx, tables, patches } = makeCtx();
    const ref = await publishRow(ctx, mcRow);
    expect(ref).toEqual({ questionId: "questions_0", compoundId: null });
    const q = tables.questions[0];
    expect(q).toMatchObject({ topicId: "t1", correctIndex: 1, hint: "רמז", choices: ["3", "4", "5", "6"] });
    expect(patches["row_mc"]).toEqual({ status: "approved", publishedQuestionId: "questions_0" });
  });

  it("publishes fill_blank as a single-section compound with points pinned to 100", async () => {
    const { ctx, tables } = makeCtx();
    const ref = await publishRow(ctx, fillRow);
    expect(ref.compoundId).toBe("compoundQuestions_0");
    const cq = tables.compoundQuestions[0];
    expect(cq.topicIds).toEqual(["t1"]);
    expect(cq.preambleParams).toEqual([]);
    expect(cq.sections).toHaveLength(1);
    expect(cq.sections[0]).toMatchObject({
      label: "א",
      answerType: "expression",
      correctAnswer: "7",
      points: 100,
    });
    expect(cq.fullSolution).toBe("x=7");
  });

  it("round-trips a proof into compoundQuestions.sections that proofGrading can read", async () => {
    const { ctx, tables } = makeCtx();
    await publishRow(ctx, proofRow());
    const section = tables.compoundQuestions[0].sections.find((s: any) => s.label === "א");
    expect(section.answerType).toBe("proof");
    // These are the exact fields convex/proofGrading.ts looks up per step.
    const step0 = section.proofSteps.find((s: any) => s.stepIndex === 0);
    expect(step0).toMatchObject({ expectedClaim: "AO = OC", expectedReason: "אלכסוני מקבילית מחצים זה את זה" });
    expect(section.proofSteps.find((s: any) => s.stepIndex === 1).expectedReason).toBe("צ.ז.צ");
    expect(section.proofMeta).toMatchObject({ given: "ABCD מקבילית", toProve: "AOB ≅ COD" });
  });

  it("refuses to publish a proof whose steps the teacher has not confirmed", async () => {
    const { ctx } = makeCtx();
    await expect(publishRow(ctx, proofRow({ proofReviewedAt: undefined }))).rejects.toThrow(
      "יש לאשר את שלבי ההוכחה לפני פרסום השאלה",
    );
  });

  it("rejects a confirmed proof that is missing its steps", async () => {
    const { ctx } = makeCtx();
    await expect(publishRow(ctx, proofRow({ proofSteps: [] }))).rejects.toThrow("בסעיף הוכחה חסרים");
  });

  it("blocks approval when no topic is chosen", async () => {
    const { ctx } = makeCtx();
    await expect(publishRow(ctx, { ...mcRow, topicId: undefined })).rejects.toThrow(
      "יש לבחור נושא לפני אישור השאלה",
    );
  });

  it("rejects a discarded question", async () => {
    const { ctx } = makeCtx();
    await expect(publishRow(ctx, { ...mcRow, status: "discarded" })).rejects.toThrow("השאלה נמחקה");
  });

  it("is idempotent: an already-published row inserts nothing and returns the same id", async () => {
    const { ctx, tables } = makeCtx();
    const ref = await publishRow(ctx, { ...mcRow, publishedQuestionId: "questions_existing" });
    expect(ref).toEqual({ questionId: "questions_existing", compoundId: null });
    expect(tables.questions).toHaveLength(0);
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });
});
