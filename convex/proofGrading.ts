import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GEMINI_MODELS } from "./geminiModels";

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

// ── Internal query: fetch the expected proof step ──
export const getExpectedStep = internalQuery({
  args: {
    assignedQuestionId: v.id("assignedQuestions"),
    sectionLabel: v.string(),
    stepIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const aq = await ctx.db.get(args.assignedQuestionId);
    if (!aq?.compoundQuestionId) return null;

    const cq = await ctx.db.get(aq.compoundQuestionId);
    if (!cq) return null;

    const section = cq.sections.find((s) => s.label === args.sectionLabel);
    if (!section?.proofSteps) return null;

    const step = section.proofSteps.find((s) => s.stepIndex === args.stepIndex);
    return step ?? null;
  },
});

// ── Internal mutation: persist per-step grading result ──
export const saveStepResult = internalMutation({
  args: {
    assignedQuestionId: v.id("assignedQuestions"),
    sectionLabel: v.string(),
    stepIndex: v.number(),
    studentClaim: v.string(),
    studentReason: v.string(),
    claimCorrect: v.boolean(),
    reasonCorrect: v.boolean(),
    stepScore: v.number(),
    feedback: v.string(),
    totalSteps: v.number(),
  },
  handler: async (ctx, args) => {
    const aq = await ctx.db.get(args.assignedQuestionId);
    if (!aq) throw new Error("Assigned question not found");

    const existingAnswers = aq.answers ?? [];

    const newStepResult = {
      stepIndex: args.stepIndex,
      studentClaim: args.studentClaim,
      studentReason: args.studentReason,
      claimCorrect: args.claimCorrect,
      reasonCorrect: args.reasonCorrect,
      stepScore: args.stepScore,
      feedback: args.feedback,
    };

    const sectionAnswerIdx = existingAnswers.findIndex(
      (a) => a.sectionLabel === args.sectionLabel
    );

    if (sectionAnswerIdx === -1) {
      // Create answer entry for this section
      existingAnswers.push({
        sectionLabel: args.sectionLabel,
        studentAnswer: args.studentClaim,
        isCorrect: false,
        timeMs: 0,
        hintsUsed: 0,
        proofStepResults: [newStepResult],
      });
    } else {
      const existing = existingAnswers[sectionAnswerIdx];
      const existingStepResults = existing.proofStepResults ?? [];
      const filtered = existingStepResults.filter(
        (r) => r.stepIndex !== args.stepIndex
      );
      filtered.push(newStepResult);

      // Section is correct when all steps have stepScore >= 0.5
      const allStepsDone = filtered.length === args.totalSteps;
      const allStepsPass = filtered.every((r) => r.stepScore >= 0.5);

      existingAnswers[sectionAnswerIdx] = {
        ...existing,
        proofStepResults: filtered,
        isCorrect: allStepsDone && allStepsPass,
      };
    }

    await ctx.db.patch(args.assignedQuestionId, {
      answers: existingAnswers,
      status: "in_progress",
    });
  },
});

// ── Public action: grade a single proof step via Gemini ──
export const gradeProofStep = action({
  args: {
    assignedQuestionId: v.id("assignedQuestions"),
    sectionLabel: v.string(),
    stepIndex: v.number(),
    studentClaim: v.string(),
    studentReason: v.string(),
  },
  handler: async (ctx, args): Promise<{
    claimCorrect: boolean;
    reasonCorrect: boolean;
    stepScore: number;
    feedback: string;
  }> => {
    const step = await ctx.runQuery(internal.proofGrading.getExpectedStep, {
      assignedQuestionId: args.assignedQuestionId,
      sectionLabel: args.sectionLabel,
      stepIndex: args.stepIndex,
    });

    if (!step) {
      throw new Error("Proof step not found for this section");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const prompt = `אתה בודק צעד אחד בהוכחה גיאומטרית. ענה אך ורק ב-JSON תקין ללא עטיפת markdown.

הצעד הצפוי:
- טענה: ${step.expectedClaim}
- הצדקה: ${step.expectedReason}

תשובת התלמיד:
- טענה: ${args.studentClaim}
- הצדקה: ${args.studentReason}

הוראות הערכה:
1. claimCorrect — האם הטענה של התלמיד נכונה מתמטית ומתאימה לצעד זה? (true/false)
2. reasonCorrect — האם ההצדקה/המשפט שהתלמיד ציין נכון ורלוונטי לצעד זה? (true/false)
3. feedback — משוב קצר בעברית (1-2 משפטים), תן עידוד אם נכון, רמז מכוון אם שגוי.
4. stepScore — 0 אם שניהם שגויים, 0.5 אם אחד נכון, 1 אם שניהם נכונים.

החזר JSON בדיוק:
{"claimCorrect": bool, "reasonCorrect": bool, "feedback": "...", "stepScore": 0|0.5|1}`;

    // Try each model; on transient errors (429 rate-limit, 5xx overload) retry
    // with backoff and fall through to the next model. 503 = Gemini overloaded,
    // very common and transient — must not fail the student's step.
    const models = GEMINI_MODELS.grading;
    const TRANSIENT = new Set([429, 500, 502, 503, 504]);
    const MAX_ATTEMPTS_PER_MODEL = 3;
    let lastError = "";

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt++) {
        let res: Response;
        try {
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
              },
            }),
          });
        } catch (e) {
          lastError = `Gemini ${model} fetch failed: ${String(e)}`;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }

        if (!res.ok) {
          lastError = `Gemini ${model} returned ${res.status}`;
          if (TRANSIENT.has(res.status)) {
            // backoff then retry same model; loop exhaustion falls to next model
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            continue;
          }
          break; // non-transient (e.g. 400/403) → next model won't help much, but try
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

        let parsed: { claimCorrect: boolean; reasonCorrect: boolean; stepScore: number; feedback: string };
        try {
          parsed = JSON.parse(text);
        } catch {
          lastError = "Gemini returned invalid JSON";
          break; // try next model
        }

        const claimCorrect = Boolean(parsed.claimCorrect);
        const reasonCorrect = Boolean(parsed.reasonCorrect);
        const rawScore = Number(parsed.stepScore);
        const stepScore = [0, 0.5, 1].includes(rawScore) ? rawScore : (claimCorrect && reasonCorrect ? 1 : claimCorrect || reasonCorrect ? 0.5 : 0);
        const feedback = String(parsed.feedback ?? "");

        const totalSteps = await ctx.runQuery(internal.proofGrading.getTotalSteps, {
          assignedQuestionId: args.assignedQuestionId,
          sectionLabel: args.sectionLabel,
        });

        await ctx.runMutation(internal.proofGrading.saveStepResult, {
          assignedQuestionId: args.assignedQuestionId,
          sectionLabel: args.sectionLabel,
          stepIndex: args.stepIndex,
          studentClaim: args.studentClaim,
          studentReason: args.studentReason,
          claimCorrect,
          reasonCorrect,
          stepScore,
          feedback,
          totalSteps: totalSteps ?? 1,
        });

        return { claimCorrect, reasonCorrect, stepScore, feedback };
      }
    }

    throw new Error(lastError || "Gemini grading failed");
  },
});

// ── Internal query: get total proof steps count for a section ──
export const getTotalSteps = internalQuery({
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
    return section?.proofSteps?.length ?? null;
  },
});
