import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GEMINI_MODELS, generateWithFallback } from "./geminiModels";

const THEMES = [
  "כדורגל", "חברים", "מינקראפט", "מוזיקה פופ", "כדורסל",
  "הארי פוטר", "מרוצים", "בישול", "ריקוד", "חלל"
];

// How many questions one run examines. Reads per run are bounded by
// PAGE * (THEMES.length + 1) — 440 here — regardless of how big the bank gets.
const PAGE = 40;
const BATCH = 10; // question-theme pairs handed to Gemini per run

/**
 * Returns up to BATCH question-theme pairs that still need precomputation,
 * plus the cursor for where the next run should resume.
 *
 * This used to scan the ENTIRE cross-product every run: all questions x all 10
 * themes, one indexed point lookup per pair. Once the backlog was drained that
 * was ~3400 document reads to conclude there was nothing to do, against
 * Convex's 4096-read ceiling — i.e. it was ~300 eligible questions away from
 * failing outright, and questionGen adds questions uncapped. Now it walks one
 * bounded page per run and threads a cursor forward through the scheduler, so
 * cost per run is flat as the bank grows.
 *
 * Only the single largest theme group is returned, so the caller still makes
 * one Gemini call per run rather than up to BATCH one-question calls.
 */
export const getMissingPrecomputations = internalQuery({
  args: {
    table: v.optional(v.string()),                        // "questions" | "compoundQuestions"
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const onCompound = args.table === "compoundQuestions";
    const cursor = args.cursor ?? null;

    const result = onCompound
      ? await ctx.db.query("compoundQuestions").paginate({ numItems: PAGE, cursor })
      : await ctx.db.query("questions").paginate({ numItems: PAGE, cursor });

    // Group this page's gaps by theme so one run == one theme == one API call.
    const byTheme = new Map<string, { questionId: string; theme: string; originalText: string }[]>();
    for (const q of result.page) {
      const originalText = onCompound
        ? (q as { preamble?: string }).preamble
        : (q as { stem?: string }).stem;
      if (!originalText) continue;

      for (const theme of THEMES) {
        const existing = await ctx.db
          .query("precomputedThemedQuestions")
          .withIndex("by_question_theme", qb => qb.eq("questionId", q._id).eq("theme", theme))
          .first();
        if (existing) continue;
        const bucket = byTheme.get(theme) ?? [];
        bucket.push({ questionId: q._id, theme, originalText });
        byTheme.set(theme, bucket);
      }
    }

    let missing: { questionId: string; theme: string; originalText: string }[] = [];
    for (const bucket of byTheme.values()) {
      if (bucket.length > missing.length) missing = bucket;
    }
    missing = missing.slice(0, BATCH);

    // Stay on this page while it still has gaps — the next run re-reads it with
    // fewer left. Only advance once the page is fully precomputed, so a page is
    // never half-done and abandoned. questions exhausted -> compoundQuestions;
    // both exhausted -> next=null, which tells the caller the sweep is complete.
    const next = missing.length > 0
      ? { table: onCompound ? "compoundQuestions" : "questions", cursor }
      : result.isDone
        ? (onCompound ? null : { table: "compoundQuestions", cursor: null })
        : { table: onCompound ? "compoundQuestions" : "questions", cursor: result.continueCursor };

    return { missing, next };
  }
});

// Saves a batch of precomputed variants into the database
export const savePrecomputedBatch = internalMutation({
  args: {
    results: v.array(v.object({
      id: v.string(),
      rewritten: v.string(),
      theme: v.string(),
    }))
  },
  handler: async (ctx, { results }) => {
    let count = 0;
    for (const res of results) {
      // Ensure we don't insert duplicates if somehow it ran twice
      const existing = await ctx.db
        .query("precomputedThemedQuestions")
        .withIndex("by_question_theme", q => q.eq("questionId", res.id).eq("theme", res.theme))
        .first();
        
      if (!existing) {
        await ctx.db.insert("precomputedThemedQuestions", {
          questionId: res.id,
          theme: res.theme,
          personalizedText: res.rewritten
        });
        count++;
      }
    }
    return count;
  }
});

// The main action that fetches missing pairs, calls Gemini, and schedules the next batch
export const precomputeThemeBatch = internalAction({
  args: {
    table: v.optional(v.string()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[precomputeThemeBatch] GEMINI_API_KEY not set. Skipping.");
      return;
    }

    const { missing, next } = await ctx.runQuery(
      internal.precompute.getMissingPrecomputations,
      { table: args.table, cursor: args.cursor },
    );

    // Nothing on this page. `next` is what distinguishes "this slice was already
    // done" from "the whole sweep is done" — only the latter stops the pipeline.
    // No Gemini call happened, so skip the rate-limit delay and walk on quickly.
    if (missing.length === 0) {
      if (next) {
        await ctx.scheduler.runAfter(1000, internal.precompute.precomputeThemeBatch, next);
      } else {
        console.log("[precomputeThemeBatch] All questions and themes are precomputed!");
      }
      return;
    }

    // Group the missing questions by theme (they usually are of the same theme because of the loop order, but just in case)
    const byTheme: Record<string, typeof missing> = {};
    for (const item of missing) {
      if (!byTheme[item.theme]) byTheme[item.theme] = [];
      byTheme[item.theme].push(item);
    }

    const allResults: { id: string; rewritten: string; theme: string }[] = [];

    // Process each theme group
    for (const [theme, items] of Object.entries(byTheme)) {
      const inputs = items.map(i => ({
        id: i.questionId,
        original: i.originalText
      }));

      const systemPrompt = `אתה עוזר לכתוב מחדש שאלות מתמטיקה בעברית בצורה מהנה לתלמידים.
כללי ברזל:
1. שמור את כל הנוסחאות המתמטיות בדיוק כפי שהן — אל תשנה שום דבר בין סימני $ ... $ או \\[ ... \\].
2. שמור את מבנה השאלה — אל תוסיף פסקאות חדשות, אל תקצר.
3. הוסף רק הקשר נושאי מהנה: שמות שחקנים, מועדונים, דמויות מהסדרה, וכד' — בהתאם לנושא שנבחר.
4. כתוב בעברית בלבד. החזר JSON מדויק ללא שום טקסט נוסף.`;

      const userPrompt = `נושא: ${theme}

השאלות (בפורמט JSON):
${JSON.stringify(inputs, null, 2)}

החזר את אותו ה-JSON עם השאלות משוכתבות בהקשר של "${theme}". חובה להחזיר מערך JSON של אובייקטים המכילים 'id' ו-'rewritten' לכל שאלה.`;

      try {
        const result = await generateWithFallback(apiKey, GEMINI_MODELS.rewrite, {
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  rewritten: { type: "STRING" }
                },
                required: ["id", "rewritten"]
              }
            }
          },
        });
        await ctx.runMutation(internal.aiUsage.record, {
          task: "rewrite",
          ok: result.ok,
          promptTokens: result.ok ? (result.data?.usageMetadata?.promptTokenCount ?? 0) : 0,
          outputTokens: result.ok ? (result.data?.usageMetadata?.candidatesTokenCount ?? 0) : 0,
        });

        if (!result.ok) {
          console.error(`[precomputeThemeBatch] Gemini error ${result.status} for theme ${theme}: ${result.error}`);
          continue;
        }

        const data = result.data;
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) continue;

        const results: { id: string; rewritten: string }[] = JSON.parse(responseText);
        for (const res of results) {
          allResults.push({ id: res.id, rewritten: res.rewritten, theme });
        }
      } catch (err) {
        console.error(`[precomputeThemeBatch] Failed for theme ${theme}:`, err);
      }
    }

    if (allResults.length > 0) {
      const savedCount = await ctx.runMutation(internal.precompute.savePrecomputedBatch, { results: allResults });
      console.log(`[precomputeThemeBatch] Saved ${savedCount} precomputed variations.`);
    }

    // We just called Gemini, so take the full 5-minute delay to respect rate
    // limits. Batch size is no longer the continue/stop signal — with a paged
    // scan a short batch just means a sparse page, not a drained backlog; only
    // `next === null` (both tables walked to the end) ends the pipeline.
    if (next) {
      await ctx.scheduler.runAfter(300000, internal.precompute.precomputeThemeBatch, next);
    } else {
      console.log("[precomputeThemeBatch] Backlog drained; pipeline stopped.");
    }
  }
});

// Manual trigger for backfills: `npx convex run precompute:startPrecomputePipeline`.
// Internal on purpose — it kicks off Gemini spend, so it must not be callable
// from the public client API. Question-creation paths (teacherImport,
// packetPublish) schedule precomputeThemeBatch directly.
export const startPrecomputePipeline = internalMutation({
  args: {},
  handler: async (ctx) => {
    // No cursor: start the sweep from the first page of `questions`.
    await ctx.scheduler.runAfter(0, internal.precompute.precomputeThemeBatch, {});
    return "Pipeline started!";
  }
});
