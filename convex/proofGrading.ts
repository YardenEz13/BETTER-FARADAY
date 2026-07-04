import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GEMINI_MODELS, generateWithFallback } from "./geminiModels";

// ── Public query: saved proof progress for a section (for UI hydration) ──
export const getSavedSteps = query({
  args: {
    assignedQuestionId: v.id("assignedQuestions"),
    sectionLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const aq = await ctx.db.get(args.assignedQuestionId);
    if (!aq) return [];
    const answer = (aq.answers ?? []).find((a) => a.sectionLabel === args.sectionLabel);
    return answer?.proofStepResults ?? [];
  },
});

// ── Internal query: fetch every expected proof step for a section ──
export const getExpectedSteps = internalQuery({
  args: {
    assignedQuestionId: v.id("assignedQuestions"),
    sectionLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const aq = await ctx.db.get(args.assignedQuestionId);
    if (!aq?.compoundQuestionId) return null;

    const cq = await ctx.db.get(aq.compoundQuestionId);
    if (!cq) return null;

    const section = cq.sections.find((s) => s.label === args.sectionLabel);
    return section?.proofSteps ?? null;
  },
});

export interface ProofStepResult {
  stepIndex: number;
  claimCorrect: boolean;
  reasonCorrect: boolean;
  stepScore: number;
  feedback: string;
}

// ── Internal mutation: persist a whole section's grading results in one write ──
export const saveSectionResults = internalMutation({
  args: {
    assignedQuestionId: v.id("assignedQuestions"),
    sectionLabel: v.string(),
    results: v.array(
      v.object({
        stepIndex: v.number(),
        studentClaim: v.string(),
        studentReason: v.string(),
        claimCorrect: v.boolean(),
        reasonCorrect: v.boolean(),
        stepScore: v.number(),
        feedback: v.string(),
      }),
    ),
    totalSteps: v.number(),
  },
  handler: async (ctx, args) => {
    const aq = await ctx.db.get(args.assignedQuestionId);
    if (!aq) throw new Error("Assigned question not found");

    const existingAnswers = aq.answers ?? [];
    const allStepsDone = args.results.length === args.totalSteps;
    const allStepsPass = args.results.every((r) => r.stepScore >= 0.5);
    const isCorrect = allStepsDone && allStepsPass;
    const firstClaim = args.results[0]?.studentClaim ?? "";

    const sectionAnswerIdx = existingAnswers.findIndex(
      (a) => a.sectionLabel === args.sectionLabel
    );

    const newAnswer = {
      sectionLabel: args.sectionLabel,
      studentAnswer: firstClaim,
      isCorrect,
      timeMs: sectionAnswerIdx === -1 ? 0 : existingAnswers[sectionAnswerIdx].timeMs,
      hintsUsed: sectionAnswerIdx === -1 ? 0 : existingAnswers[sectionAnswerIdx].hintsUsed,
      proofStepResults: args.results,
    };

    if (sectionAnswerIdx === -1) {
      existingAnswers.push(newAnswer);
    } else {
      existingAnswers[sectionAnswerIdx] = newAnswer;
    }

    await ctx.db.patch(args.assignedQuestionId, {
      answers: existingAnswers,
      status: "in_progress",
    });
  },
});

// ── Public action: grade every step of a proof section in ONE Gemini call ──
// Previously each step was graded (and retried) individually — a 3-step proof
// could cost 3+ API calls before the student even finished. Grading the whole
// section at once, only when the student submits it, costs exactly one call
// per attempt regardless of step count.
export const gradeProofSection = action({
  args: {
    assignedQuestionId: v.id("assignedQuestions"),
    sectionLabel: v.string(),
    steps: v.array(
      v.object({
        stepIndex: v.number(),
        studentClaim: v.string(),
        studentReason: v.string(),
      }),
    ),
  },
  handler: async (ctx, args): Promise<ProofStepResult[]> => {
    const expected = await ctx.runQuery(internal.proofGrading.getExpectedSteps, {
      assignedQuestionId: args.assignedQuestionId,
      sectionLabel: args.sectionLabel,
    });
    if (!expected || expected.length === 0) {
      throw new Error("Proof steps not found for this section");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const stepsBlock = args.steps
      .map((s, i) => {
        const exp = expected.find((e) => e.stepIndex === s.stepIndex);
        return `צעד ${i + 1} (stepIndex=${s.stepIndex}):
טענה צפויה: ${exp?.expectedClaim ?? "?"}
הצדקה צפויה: ${exp?.expectedReason ?? "?"}
תשובת התלמיד — טענה: ${s.studentClaim}
תשובת התלמיד — הצדקה: ${s.studentReason}`;
      })
      .join("\n\n");

    const prompt = `אתה בודק הוכחה גיאומטרית שלמה, צעד אחר צעד. ענה אך ורק ב-JSON תקין ללא עטיפת markdown.

${stepsBlock}

עבור כל צעד קבע בנפרד:
1. claimCorrect — האם הטענה של התלמיד נכונה מתמטית ומתאימה לצעד זה? (true/false)
2. reasonCorrect — האם ההצדקה/המשפט שהתלמיד ציין נכון ורלוונטי לצעד זה? (true/false)
3. feedback — משוב קצר בעברית (1-2 משפטים) לצעד הזה בלבד, תן עידוד אם נכון, רמז מכוון אם שגוי.
4. stepScore — 0 אם שניהם שגויים, 0.5 אם אחד נכון, 1 אם שניהם נכונים.

החזר מערך JSON אחד, באורך ${args.steps.length}, בדיוק באותו סדר כמו הצעדים למעלה:
[{"stepIndex": number, "claimCorrect": bool, "reasonCorrect": bool, "feedback": "...", "stepScore": 0|0.5|1}, ...]`;

    const result = await generateWithFallback(
      apiKey,
      GEMINI_MODELS.grading,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      },
      { maxAttemptsPerModel: 3 },
    );

    if (!result.ok) {
      throw new Error(result.error || "Gemini grading failed");
    }

    const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Gemini returned invalid JSON");
    }
    if (!Array.isArray(parsed)) throw new Error("Gemini did not return a JSON array");

    const results: ProofStepResult[] = args.steps.map((s, i) => {
      const p = (parsed[i] ?? {}) as Record<string, unknown>;
      const claimCorrect = Boolean(p.claimCorrect);
      const reasonCorrect = Boolean(p.reasonCorrect);
      const rawScore = Number(p.stepScore);
      const stepScore = [0, 0.5, 1].includes(rawScore)
        ? rawScore
        : claimCorrect && reasonCorrect
          ? 1
          : claimCorrect || reasonCorrect
            ? 0.5
            : 0;
      return {
        stepIndex: s.stepIndex,
        claimCorrect,
        reasonCorrect,
        stepScore,
        feedback: String(p.feedback ?? ""),
      };
    });

    await ctx.runMutation(internal.proofGrading.saveSectionResults, {
      assignedQuestionId: args.assignedQuestionId,
      sectionLabel: args.sectionLabel,
      totalSteps: expected.length,
      results: results.map((r, i) => ({
        ...r,
        studentClaim: args.steps[i].studentClaim,
        studentReason: args.steps[i].studentReason,
      })),
    });

    return results;
  },
});
