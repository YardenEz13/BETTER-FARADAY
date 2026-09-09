import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GEMINI_MODELS, generateWithFallback } from "./geminiModels";
import { matchAnswer } from "./answerMatch";

/**
 * The last rung of the answer-checking ladder.
 *
 * `homework.submitAnswer` decides with `answerMatch` — canonicalise, parse,
 * evaluate. That settles almost everything, deterministically and for free.
 * What it cannot settle is an answer it could not *parse*: a student who wrote
 * "שיפוע חיובי", or a stored `correctAnswer` that is prose rather than maths.
 * Those come here for exactly one Gemini opinion.
 *
 * Deliberately not called on every wrong answer. A confidently wrong answer is
 * wrong, and buying a second opinion on every miss would spend most of the
 * project's Gemini budget re-confirming arithmetic. Only `verdict: "unparsed"`
 * escalates — `submitAnswer` returns `canAdjudicate` to say so.
 *
 * A disagreement here is also a signal about the *question*, not just the
 * answer: if the model says a student's answer is equivalent to a
 * `correctAnswer` our parser choked on, that row is usually badly formatted.
 * Those get logged to `questionReports` for the same teacher queue that
 * student reports land in — the bank is machine-authored and unreviewed, so
 * this is a free review lead.
 */

export const adjudicateAnswer = action({
  args: {
    assignedQuestionId: v.id("assignedQuestions"),
    sectionLabel: v.string(),
    studentAnswer: v.string(),
    studentId: v.optional(v.id("students")),
  },
  returns: v.object({
    isCorrect: v.boolean(),
    note: v.optional(v.string()),
    /** False when the model could not be reached — the UI keeps the
     *  deterministic verdict rather than inventing one. */
    decided: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{ isCorrect: boolean; note?: string; decided: boolean }> => {
    const section = await ctx.runQuery(internal.answerCheck.getSection, {
      assignedQuestionId: args.assignedQuestionId,
      sectionLabel: args.sectionLabel,
    });
    if (!section) return { isCorrect: false, decided: false };

    // Re-run the cheap path first: the client may be a version behind, and a
    // deterministic yes here saves the call entirely.
    const local = matchAnswer(section.correctAnswer, args.studentAnswer, section.answerType);
    if (local.correct) {
      await ctx.runMutation(internal.answerCheck.recordVerdict, {
        assignedQuestionId: args.assignedQuestionId,
        sectionLabel: args.sectionLabel,
        isCorrect: true,
        verdict: local.verdict,
      });
      return { isCorrect: true, note: local.note, decided: true };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { isCorrect: false, decided: false };

    const prompt = `אתה בודק תשובה של תלמיד תיכון בשאלת מתמטיקה. ענה אך ורק ב-JSON תקין ללא עטיפת markdown.

השאלה: ${section.prompt}
התשובה הנכונה כפי שהיא שמורה במאגר: ${section.correctAnswer}
תשובת התלמיד: ${args.studentAnswer}

התלמיד כותב בכתב ידו החופשי, לפעמים בעברית ולפעמים בסימונים משלו. קבע האם התשובה שלו **שקולה מתמטית** לתשובה הנכונה — לא האם היא כתובה באותה צורה.

קבל כנכונה תשובה ש:
- שקולה מתמטית (למשל 2√2 מול √8, או 0.5 מול 1/2)
- מנוסחת במילים במקום בסימנים, אם המשמעות זהה
- מעוגלת באופן סביר

דחה תשובה ש:
- מספרית או מתמטית שונה
- עונה על שאלה אחרת
- ריקה או חסרת משמעות

החזר: {"isCorrect": bool, "reason": "משפט אחד בעברית", "storedAnswerLooksMalformed": bool}
storedAnswerLooksMalformed = true אם התשובה השמורה במאגר עצמה נראית שגויה, חסרה או לא מנוסחת כתשובה מתמטית.`;

    const result = await generateWithFallback(
      apiKey,
      GEMINI_MODELS.grading,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      },
      { maxAttemptsPerModel: 2 },
    );
    await ctx.runMutation(internal.aiUsage.record, {
      task: "grading",
      ok: result.ok,
      promptTokens: result.ok ? (result.data?.usageMetadata?.promptTokenCount ?? 0) : 0,
      outputTokens: result.ok ? (result.data?.usageMetadata?.candidatesTokenCount ?? 0) : 0,
    });
    if (!result.ok) return { isCorrect: false, decided: false };

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(result.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
    } catch {
      return { isCorrect: false, decided: false };
    }

    const isCorrect = Boolean(parsed.isCorrect);
    const note = typeof parsed.reason === "string" ? parsed.reason : undefined;

    await ctx.runMutation(internal.answerCheck.recordVerdict, {
      assignedQuestionId: args.assignedQuestionId,
      sectionLabel: args.sectionLabel,
      isCorrect,
      verdict: "ai",
    });

    // The parser could not read the stored answer AND the model accepted a
    // student answer against it, or the model itself flagged the row — either
    // way the question, not the student, is the thing to look at.
    if (isCorrect || parsed.storedAnswerLooksMalformed === true) {
      await ctx.runMutation(internal.answerCheck.flagQuestion, {
        questionId: section.compoundQuestionId,
        studentId: args.studentId,
        note: `סעיף ${args.sectionLabel}: התשובה השמורה "${section.correctAnswer}" לא ניתנת לפענוח אוטומטי (תשובת התלמיד: "${args.studentAnswer}")`,
      });
    }

    return { isCorrect, note, decided: true };
  },
});

// ── Internal: the section being adjudicated, with its stored answer ──
export const getSection = internalQuery({
  args: {
    assignedQuestionId: v.id("assignedQuestions"),
    sectionLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const aq = await ctx.db.get(args.assignedQuestionId);
    if (!aq?.compoundQuestionId) return null;
    const cq = await ctx.db.get(aq.compoundQuestionId);
    const section = cq?.sections.find((s) => s.label === args.sectionLabel);
    if (!section || !cq) return null;
    return {
      prompt: section.prompt,
      correctAnswer: section.correctAnswer,
      answerType: section.answerType,
      compoundQuestionId: cq._id as string,
    };
  },
});

// ── Internal: overwrite the recorded verdict for one section ──
export const recordVerdict = internalMutation({
  args: {
    assignedQuestionId: v.id("assignedQuestions"),
    sectionLabel: v.string(),
    isCorrect: v.boolean(),
    verdict: v.string(),
  },
  handler: async (ctx, args) => {
    const aq = await ctx.db.get(args.assignedQuestionId);
    if (!aq) return;
    const answers = (aq.answers ?? []).map((a) =>
      a.sectionLabel === args.sectionLabel
        ? { ...a, isCorrect: args.isCorrect, matchVerdict: args.verdict }
        : a,
    );
    await ctx.db.patch(args.assignedQuestionId, { answers });
  },
});

/** Marks a report this module raised, so student reports are not deduped against it. */
const AUTO_FLAG_PREFIX = "בדיקה אוטומטית: ";

// ── Internal: raise a question-quality flag, deduplicated ──
export const flagQuestion = internalMutation({
  args: {
    questionId: v.string(),
    studentId: v.optional(v.id("students")),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    // One open flag per question is enough to get it looked at; a whole class
    // hitting the same bad row should not bury the teacher's queue.
    const existing = await ctx.db
      .query("questionReports")
      .withIndex("by_question", (q) => q.eq("questionId", args.questionId))
      .collect();
    if (existing.some((r) => r.resolvedAt === undefined && r.note?.startsWith(AUTO_FLAG_PREFIX))) return;

    await ctx.db.insert("questionReports", {
      questionId: args.questionId,
      studentId: args.studentId,
      // An existing reason, not a new one: this IS broken maths in the stored
      // row, and adding a reason the teacher triage UI does not know how to
      // label would show up there as a blank chip.
      reason: "broken_math",
      note: (AUTO_FLAG_PREFIX + args.note).slice(0, 300),
      route: "homework",
      createdAt: Date.now(),
    });
  },
});
