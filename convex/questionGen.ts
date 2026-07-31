// ── Autonomous question-bank growth ──────────────────────────────────────
// A cron (every 2h, convex/crons.ts) asks Gemini for new bagrut-style
// questions written in the style of the ones already in the bank, inserts
// whatever survives validation, then kicks the themed-precompute pipeline so
// the new rows get personalized variants like every other question.
//
// Why this exists: the seeded bank is ~20 questions per topic and
// `questions.getNextQuestion` falls back to repeats once a topic's pool is
// dry, so a student practising daily sees repeats inside week one. Growth has
// to happen without a human authoring each question.
//
// What this deliberately does NOT do: prove the answer key is right. Nothing
// automated can. Generated rows carry `generatedAt` so a reviewer can find
// them, and the student-facing report button (convex/questionReports.ts) is
// the backstop for whatever slips through.
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { GEMINI_MODELS, generateWithFallback } from "./geminiModels";

/** Per (topic, difficulty) target. 15 × 4 bands ≈ 60 per topic — the volume a
 *  daily-practising student can't exhaust in a pilot month. Once every band is
 *  full the cron costs one indexed count and returns. */
const TARGET_PER_BAND = 15;
/** Difficulty bands the adaptive engine actually walks. The seeded bank uses
 *  1-4; band 5 exists in the schema but no question or session ever reaches it. */
const BANDS = [1, 2, 3, 4];
/** Questions requested per run. Small on purpose: every generated question is
 *  unreviewed until a human reads it, so a trickle keeps the review queue
 *  human-sized. 4/run × ~19 runs/day (75-min cron) fills the whole bank in
 *  under two days. */
const BATCH_SIZE = 4;
/** Existing questions shown to the model as style exemplars. */
const EXEMPLAR_COUNT = 4;

export type GeneratedQuestion = {
  stem: string;
  choices: string[];
  correctIndex: number;
  solutionSteps: string[];
  hint: string;
  explanation: string;
};

/** The thinnest band plus everything needed to fill it. Spelled out rather
 *  than inferred: `generateBatch` calls `pickGap` from this same module, and
 *  self-referential inference through `internal.*` collapses the generated
 *  API types to `any` across the whole app. */
export type Gap = {
  topicId: Id<"topics">;
  topicHe: string;
  difficulty: number;
  have: number;
  want: number;
  exemplars: GeneratedQuestion[];
  existingStems: string[];
};

type BatchResult = {
  inserted: number;
  reason: "ok" | "no-api-key" | "ai-disabled" | "bank-full" | "gemini-error"
    | "empty-response" | "bad-json" | "all-rejected";
};

/** Whitespace-insensitive key for "is this the same question". */
export function stemKey(stem: string): string {
  return stem.replace(/\s+/g, " ").trim();
}

/**
 * Keeps only rows that are structurally usable and genuinely new.
 *
 * Pure so it can be tested without Convex or Gemini — see questionGen.test.ts.
 * This is a shape gate, not a correctness gate: it cannot tell whether
 * `correctIndex` points at the right answer, only that it points at an answer.
 */
export function validateGenerated(
  raw: unknown,
  existingStems: readonly string[],
): { accepted: GeneratedQuestion[]; rejected: string[] } {
  const accepted: GeneratedQuestion[] = [];
  const rejected: string[] = [];
  const seen = new Set(existingStems.map(stemKey));

  if (!Array.isArray(raw)) return { accepted, rejected: ["response was not an array"] };

  for (const item of raw) {
    const q = item as Partial<GeneratedQuestion>;
    const stem = typeof q?.stem === "string" ? q.stem.trim() : "";
    const choices = Array.isArray(q?.choices) ? q.choices.map((c) => String(c ?? "").trim()) : [];
    const steps = Array.isArray(q?.solutionSteps) ? q.solutionSteps.map((s) => String(s ?? "").trim()) : [];
    const hint = typeof q?.hint === "string" ? q.hint.trim() : "";
    const explanation = typeof q?.explanation === "string" ? q.explanation.trim() : "";
    const correctIndex = typeof q?.correctIndex === "number" ? q.correctIndex : -1;
    const label = stem.slice(0, 60) || "(empty stem)";

    if (stem.length < 10) { rejected.push(`${label}: stem too short`); continue; }
    if (choices.length !== 4 || choices.some((c) => c === "")) { rejected.push(`${label}: needs 4 non-empty choices`); continue; }
    if (new Set(choices).size !== 4) { rejected.push(`${label}: duplicate choices`); continue; }
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) { rejected.push(`${label}: correctIndex out of range`); continue; }
    if (steps.length === 0 || steps.some((s) => s === "")) { rejected.push(`${label}: empty solution steps`); continue; }
    if (hint === "" || explanation === "") { rejected.push(`${label}: missing hint/explanation`); continue; }

    const key = stemKey(stem);
    if (seen.has(key)) { rejected.push(`${label}: duplicate of an existing question`); continue; }
    seen.add(key); // also dedups within this batch

    accepted.push({ stem, choices, correctIndex, solutionSteps: steps, hint, explanation });
  }

  return { accepted, rejected };
}

/**
 * The emptiest (topic, difficulty) band still under target, plus the style
 * exemplars and the topic's existing stems for dedup. Null once the bank is
 * full — the cron then does nothing but this one read.
 */
export const pickGap = internalQuery({
  args: {},
  handler: async (ctx): Promise<Gap | null> => {
    const topics = await ctx.db.query("topics").collect();
    if (topics.length === 0) return null;

    let gap: { topicId: Id<"topics">; topicHe: string; difficulty: number; count: number } | null = null;

    for (const topic of topics) {
      for (const difficulty of BANDS) {
        const rows = await ctx.db
          .query("questions")
          .withIndex("by_topic_difficulty", (q) => q.eq("topicId", topic._id).eq("difficulty", difficulty))
          .collect();
        if (rows.length >= TARGET_PER_BAND) continue;
        if (!gap || rows.length < gap.count) {
          gap = { topicId: topic._id, topicHe: topic.nameHe, difficulty, count: rows.length };
        }
      }
    }

    if (!gap) return null;

    // Exemplars come from the whole topic, not just the target band — a band
    // with zero questions would otherwise get no style to copy.
    const topicQuestions = await ctx.db
      .query("questions")
      .withIndex("by_topic", (q) => q.eq("topicId", gap!.topicId))
      .collect();

    // Prefer same-band exemplars, fall back to the rest of the topic.
    const sameBand = topicQuestions.filter((q) => q.difficulty === gap!.difficulty);
    const others = topicQuestions.filter((q) => q.difficulty !== gap!.difficulty);
    const exemplars = [...sameBand, ...others].slice(0, EXEMPLAR_COUNT).map((q) => ({
      stem: q.stem,
      choices: q.choices,
      correctIndex: q.correctIndex,
      solutionSteps: q.solutionSteps,
      hint: q.hint,
      explanation: q.explanation,
    }));

    return {
      topicId: gap.topicId,
      topicHe: gap.topicHe,
      difficulty: gap.difficulty,
      have: gap.count,
      want: TARGET_PER_BAND,
      exemplars,
      existingStems: topicQuestions.map((q) => q.stem),
    };
  },
});

/** Inserts validated questions, re-checking dedup inside the transaction. */
export const insertGenerated = internalMutation({
  args: {
    topicId: v.id("topics"),
    difficulty: v.number(),
    questions: v.array(
      v.object({
        stem: v.string(),
        choices: v.array(v.string()),
        correctIndex: v.number(),
        solutionSteps: v.array(v.string()),
        hint: v.string(),
        explanation: v.string(),
      }),
    ),
  },
  handler: async (ctx, { topicId, difficulty, questions }): Promise<number> => {
    const existing = await ctx.db
      .query("questions")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .collect();
    const seen = new Set(existing.map((q) => stemKey(q.stem)));

    let inserted = 0;
    for (const q of questions) {
      const key = stemKey(q.stem);
      if (seen.has(key)) continue; // another run beat us to it
      seen.add(key);
      await ctx.db.insert("questions", { topicId, difficulty, ...q, generatedAt: Date.now() });
      inserted++;
    }

    // New questions need themed variants like every other question. Same
    // trigger packetPublish uses; the pipeline self-schedules from there.
    if (inserted > 0) {
      await ctx.scheduler.runAfter(60_000, internal.precompute.precomputeThemeBatch, {});
    }
    return inserted;
  },
});

const SYSTEM_PROMPT = `אתה מחבר שאלות מתמטיקה לבגרות ישראלית (3-4 יחידות), בעברית.
כללי ברזל:
1. כתוב שאלות חדשות לגמרי — אל תעתיק ואל תנסח מחדש את שאלות הדוגמה. העתק מהן רק את הסגנון, המבנה ורמת הקושי.
2. כל שאלה היא רב-ברירתית עם בדיוק 4 מסיחים שונים זה מזה, ותשובה נכונה אחת.
3. המסיחים השגויים חייבים לשקף טעויות אמיתיות של תלמידים (סימן הפוך, שימוש ב-n במקום n-1, בלבול בין נוסחאות) — לא מספרים אקראיים.
4. פתור את השאלה בעצמך שלב אחר שלב לפני שאתה קובע את correctIndex. correctIndex הוא האינדקס (0-3) של התשובה הנכונה במערך choices.
5. נוסחאות בפורמט LaTeX בין סימני $ ... $ בלבד.
6. solutionSteps: הפתרון המלא, שלב אחר שלב. hint: רמז אחד שלא מגלה את התשובה. explanation: הסבר קצר למה התשובה נכונה.
7. עברית בלבד. החזר JSON תקין בלבד, ללא טקסט נוסף.`;

/**
 * One generation run: find the thinnest band, ask Gemini to fill it, validate,
 * insert. Every exit path is a no-op rather than a throw — this runs on a
 * schedule with nobody watching, and a failed batch just means the next run
 * in two hours tries again.
 */
export const generateBatch = internalAction({
  args: {},
  handler: async (ctx): Promise<BatchResult> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[questionGen] GEMINI_API_KEY not set. Skipping.");
      return { inserted: 0, reason: "no-api-key" };
    }

    // The kill-switch that gates the tutor gates background spend too —
    // "AI off" has to mean no Gemini bill, not just no chat.
    const aiEnabled: boolean = await ctx.runQuery(internal.aiGate.isAiEnabled, {});
    if (!aiEnabled) return { inserted: 0, reason: "ai-disabled" };

    const gap: Gap | null = await ctx.runQuery(internal.questionGen.pickGap, {});
    if (!gap) {
      console.log("[questionGen] Bank is at target for every topic/difficulty. Nothing to do.");
      return { inserted: 0, reason: "bank-full" };
    }

    const userPrompt = `נושא: ${gap.topicHe}
רמת קושי: ${gap.difficulty} (בסולם 1-4)

שאלות קיימות מאותו נושא — לצורך סגנון בלבד. אסור לחזור עליהן:
${JSON.stringify(gap.exemplars, null, 2)}

כתוב ${BATCH_SIZE} שאלות חדשות בנושא "${gap.topicHe}" ברמת קושי ${gap.difficulty}.`;

    const result = await generateWithFallback(apiKey, GEMINI_MODELS.authoring, {
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.9, // variety matters more than determinism here
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              stem: { type: "STRING" },
              choices: { type: "ARRAY", items: { type: "STRING" } },
              correctIndex: { type: "INTEGER" },
              solutionSteps: { type: "ARRAY", items: { type: "STRING" } },
              hint: { type: "STRING" },
              explanation: { type: "STRING" },
            },
            required: ["stem", "choices", "correctIndex", "solutionSteps", "hint", "explanation"],
          },
        },
      },
    });

    await ctx.runMutation(internal.aiUsage.record, {
      task: "authoring",
      ok: result.ok,
      promptTokens: result.ok ? (result.data?.usageMetadata?.promptTokenCount ?? 0) : 0,
      outputTokens: result.ok ? (result.data?.usageMetadata?.candidatesTokenCount ?? 0) : 0,
    });

    if (!result.ok) {
      console.error(`[questionGen] Gemini error ${result.status}: ${result.error}`);
      return { inserted: 0, reason: "gemini-error" };
    }

    const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("[questionGen] Empty response body.");
      return { inserted: 0, reason: "empty-response" };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("[questionGen] Response was not valid JSON:", String(e));
      return { inserted: 0, reason: "bad-json" };
    }

    const { accepted, rejected } = validateGenerated(parsed, gap.existingStems);
    if (rejected.length > 0) console.warn(`[questionGen] Dropped ${rejected.length}: ${rejected.join("; ")}`);
    if (accepted.length === 0) return { inserted: 0, reason: "all-rejected" };

    const inserted: number = await ctx.runMutation(internal.questionGen.insertGenerated, {
      topicId: gap.topicId,
      difficulty: gap.difficulty,
      questions: accepted,
    });

    console.log(
      `[questionGen] ${gap.topicHe} d${gap.difficulty} (${gap.have}/${gap.want}) — ` +
      `model ${result.model}, +${inserted} question(s).`,
    );
    return { inserted, reason: "ok" };
  },
});
