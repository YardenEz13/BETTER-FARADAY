import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// ── Publish a reviewed packet row into live content ──
// Shared publish logic, reused by approveQuestion / bulkApprove / homework
// helpers in packetImport.ts. Throws Hebrew errors; idempotent via the row's
// published ids. Lives in its own module so packetImport.ts stays focused on
// Convex function registration and so this logic is unit-testable in isolation
// (see packetPublish.test.ts).
export async function publishRow(
  ctx: MutationCtx,
  row: Doc<"packetImportQuestions">,
): Promise<{ questionId: Id<"questions"> | null; compoundId: Id<"compoundQuestions"> | null }> {
  if (row.publishedQuestionId) return { questionId: row.publishedQuestionId, compoundId: null };
  if (row.publishedCompoundId) return { questionId: null, compoundId: row.publishedCompoundId };
  if (row.status === "discarded") throw new Error("השאלה נמחקה");
  if (!row.draft) throw new Error("אין טיוטה לשאלה");
  if (!row.topicId) throw new Error("יש לבחור נושא לפני אישור השאלה");

  const d = row.draft;
  const topicId = row.topicId;

  // Multiple-choice → a real `questions` row.
  if (d.kind === "simple" && d.format === "multiple_choice") {
    const questionId = await ctx.db.insert("questions", {
      topicId,
      difficulty: d.difficulty,
      stem: d.stem,
      choices: d.choices,
      correctIndex: d.correctIndex ?? 0,
      solutionSteps: d.solutionSteps,
      hint: d.hints[0] ?? "",
      explanation: d.explanation,
    });
    await ctx.db.patch(row._id, { status: "approved", publishedQuestionId: questionId });
    return { questionId, compoundId: null };
  }

  // Everything else → a `compoundQuestions` row.
  let sections: Doc<"compoundQuestions">["sections"];
  let difficulty: number;
  let tags: string[];
  let preamble: string;
  let fullSolution: string;

  if (d.kind === "compound") {
    sections = d.sections;
    difficulty = d.difficulty;
    tags = d.tags;
    preamble = d.preamble;
    fullSolution = d.fullSolution;
  } else {
    // simple fill_blank → a single-section compound. Points pinned to 100 (a
    // synthesized single section always owns the whole question).
    sections = [
      {
        label: "א",
        prompt: d.stem,
        answerType: "expression",
        correctAnswer: d.correctAnswer ?? "",
        solutionSteps: d.solutionSteps,
        hints: d.hints,
        points: 100,
        skillsTested: [],
      },
    ];
    difficulty = d.difficulty;
    tags = [];
    preamble = "";
    fullSolution = d.explanation;
  }

  // Proof sections become live auto-grading ground truth — guard their shape and
  // require an explicit teacher confirmation of the claim/reason chain.
  const hasProof = sections.some((s) => s.answerType === "proof");
  if (hasProof) {
    if (!row.proofReviewedAt) throw new Error("יש לאשר את שלבי ההוכחה לפני פרסום השאלה");
    for (const s of sections) {
      if (s.answerType !== "proof") continue;
      if (!s.proofSteps || s.proofSteps.length === 0 || !s.proofMeta?.given?.trim() || !s.proofMeta?.toProve?.trim()) {
        throw new Error("בסעיף הוכחה חסרים נתון/להוכיח או שלבי הוכחה");
      }
    }
  }

  const compoundId = await ctx.db.insert("compoundQuestions", {
    topicIds: [topicId],
    difficulty,
    tags,
    preamble,
    preambleParams: [],
    sections,
    fullSolution,
  });
  await ctx.db.patch(row._id, { status: "approved", publishedCompoundId: compoundId });

  // Crop mode's scanned question image is the only surviving copy of the
  // figure. ctx.storage.store needs an action (mutations can't write blobs),
  // so hand the base64 off to a scheduled action rather than blocking publish.
  if (row.questionImageBase64) {
    await ctx.scheduler.runAfter(0, internal.packetPipeline.uploadFigureImage, {
      compoundId,
      base64: row.questionImageBase64,
    });
  }

  return { questionId: null, compoundId };
}
