import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GEMINI_MODELS, generateWithFallback } from "./geminiModels";
import { judgeReason, resolveTheorem, theoremById, type ReasonJudgement } from "./geometryTheorems";

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
  /** Set when the justification was right but informally worded — the student
   *  keeps full credit and is shown the formal name. */
  reasonPhrasingNote?: string;
  /** Theorem id from geometryTheorems, when one was recognised. */
  matchedTheoremId?: string;
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
        reasonPhrasingNote: v.optional(v.string()),
        matchedTheoremId: v.optional(v.string()),
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

/**
 * Combine the deterministic justification verdict with the model's reading of
 * the step. Exported and pure so the merge rules are testable without Gemini.
 *
 * The deterministic pass wins on the justification wherever it has an opinion:
 * it matched theorem *identity*, which is not a judgement call, and it is the
 * half the model was getting wrong. The score is recomputed rather than taken
 * from the model, which scored against its own `reasonCorrect` — the value we
 * may have just overridden.
 */
export function mergeStepResult(
  stepIndex: number,
  det: ReasonJudgement,
  model: Record<string, unknown>,
): ProofStepResult {
  const claimCorrect = Boolean(model.claimCorrect);
  const reasonCorrect = det.agrees ? true : det.knownButDifferent ? false : Boolean(model.reasonCorrect);
  const stepScore = claimCorrect && reasonCorrect ? 1 : claimCorrect || reasonCorrect ? 0.5 : 0;

  const modelTheorem =
    typeof model.matchedTheorem === "string" && model.matchedTheorem.trim() ? model.matchedTheorem.trim() : "";
  const matchedTheoremId = det.matchedId ?? (modelTheorem ? resolveTheorem(modelTheorem) ?? undefined : undefined);
  // Prefer our own canonical name over the model's paraphrase of it.
  const reasonPhrasingNote = det.phrasingNote
    ?? (reasonCorrect && !det.agrees && matchedTheoremId
      ? `בניסוח הרשמי: ${theoremById(matchedTheoremId)?.canonicalHe ?? modelTheorem}`
      : undefined);

  return {
    stepIndex,
    claimCorrect,
    reasonCorrect,
    stepScore,
    feedback: String(model.feedback ?? ""),
    reasonPhrasingNote,
    matchedTheoremId,
  };
}

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

    /* ── Deterministic justification pass, before any model call ──
       A justification names a theorem. If the student's wording resolves to
       the same theorem as one of the acceptable reasons, it is right — full
       stop, no model, no cost, no disagreement to appeal. This is the fix for
       the actual complaint: the grader used to see one `expectedReason` string
       and mark "צלע זווית צלע" wrong against "צ.ז.צ (SAS)".

       The model is still asked about every step (it has to judge the *claim*,
       which is free maths text), but where this pass has already recognised
       the theorem, its opinion on the reason is overridden below. */
    const reasonPass = args.steps.map((s) => {
      const exp = expected.find((e) => e.stepIndex === s.stepIndex);
      return judgeReason([exp?.expectedReason ?? "", ...(exp?.acceptableReasons ?? [])], s.studentReason);
    });

    const stepsBlock = args.steps
      .map((s, i) => {
        const exp = expected.find((e) => e.stepIndex === s.stepIndex);
        const acceptable = [exp?.expectedReason ?? "?", ...(exp?.acceptableReasons ?? [])];
        return `צעד ${i + 1} (stepIndex=${s.stepIndex}):
טענה צפויה: ${exp?.expectedClaim ?? "?"}
הצדקות קבילות (אחת מהן מספיקה, וגם כל הצדקה נכונה אחרת): ${acceptable.join(" | ")}
תשובת התלמיד — טענה: ${s.studentClaim}
תשובת התלמיד — הצדקה: ${s.studentReason}`;
      })
      .join("\n\n");

    const prompt = `אתה בודק הוכחה גיאומטרית שלמה, צעד אחר צעד. ענה אך ורק ב-JSON תקין ללא עטיפת markdown.

${stepsBlock}

חשוב מאוד — התלמיד הוא תלמיד תיכון שכותב במילים שלו, לא מעתיק מספר. "ההצדקה הצפויה" היא **ניסוח אחד אפשרי**, לא הניסוח היחיד הקביל.

סמן reasonCorrect = true כאשר ההצדקה של התלמיד **מספיקה מתמטית** כדי לבסס את הטענה בצעד — גם אם:
- היא מנוסחת אחרת לגמרי מהניסוח הצפוי
- היא משתמשת בקיצור (צ.ז.צ, צזצ, SAS) או בכתיב מלא (צלע זווית צלע)
- היא כתובה כמשפט שלם ("כי במקבילית האלכסונים חוצים זה את זה")
- היא מנסחת את אותו משפט במילים לא רשמיות

סמן reasonCorrect = false רק כאשר:
- התלמיד מציין משפט **אחר** שאינו מבסס את הטענה
- ההצדקה מעגלית (מניחה את מה שצריך להוכיח)
- ההצדקה ריקה, לא רלוונטית או חסרת משמעות

עבור כל צעד קבע:
1. claimCorrect — האם הטענה של התלמיד נכונה מתמטית ומתאימה לצעד זה? (true/false)
2. reasonCorrect — לפי הכללים למעלה. (true/false)
3. matchedTheorem — שם המשפט הסטנדרטי שהתלמיד התכוון אליו, או "" אם לא זוהה משפט.
4. feedback — משוב קצר בעברית (1-2 משפטים) לצעד הזה בלבד. אם ההצדקה נכונה בתוכן אך לא בניסוח הרשמי — אמור זאת כמידע מועיל, לא כשגיאה.
5. stepScore — 0 אם שניהם שגויים, 0.5 אם אחד נכון, 1 אם שניהם נכונים.

החזר מערך JSON אחד, באורך ${args.steps.length}, בדיוק באותו סדר כמו הצעדים למעלה:
[{"stepIndex": number, "claimCorrect": bool, "reasonCorrect": bool, "matchedTheorem": "...", "feedback": "...", "stepScore": 0|0.5|1}, ...]`;

    const result = await generateWithFallback(
      apiKey,
      GEMINI_MODELS.grading,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      },
      { maxAttemptsPerModel: 3 },
    );
    await ctx.runMutation(internal.aiUsage.record, {
      task: "grading",
      ok: result.ok,
      promptTokens: result.ok ? (result.data?.usageMetadata?.promptTokenCount ?? 0) : 0,
      outputTokens: result.ok ? (result.data?.usageMetadata?.candidatesTokenCount ?? 0) : 0,
    });

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

    const results: ProofStepResult[] = args.steps.map((s, i) =>
      mergeStepResult(s.stepIndex, reasonPass[i], (parsed[i] ?? {}) as Record<string, unknown>),
    );

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
