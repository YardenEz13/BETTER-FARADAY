import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { GEMINI_MODELS, generateWithFallback } from "./geminiModels";

const THEMES = [
  "כדורגל", "חברים", "מינקראפט", "מוזיקה פופ", "כדורסל",
  "הארי פוטר", "מרוצים", "בישול", "ריקוד", "חלל"
];

// Returns a batch of up to 10 question-theme pairs that need precomputation
export const getMissingPrecomputations = internalQuery({
  args: {},
  handler: async (ctx) => {
    const missing: { questionId: string; theme: string; originalText: string }[] = [];
    
    // Fetch all questions
    const legacyQs = await ctx.db.query("questions").collect();
    const compoundQs = await ctx.db.query("compoundQuestions").collect();
    
    // Check missing themes
    for (const theme of THEMES) {
      for (const q of legacyQs) {
        if (!q.stem) continue;
        const existing = await ctx.db
          .query("precomputedThemedQuestions")
          .withIndex("by_question_theme", qb => qb.eq("questionId", q._id).eq("theme", theme))
          .first();
        
        if (!existing) {
          missing.push({ questionId: q._id, theme, originalText: q.stem });
          if (missing.length >= 10) return missing;
        }
      }

      for (const q of compoundQs) {
        if (!q.preamble) continue;
        const existing = await ctx.db
          .query("precomputedThemedQuestions")
          .withIndex("by_question_theme", qb => qb.eq("questionId", q._id).eq("theme", theme))
          .first();
        
        if (!existing) {
          missing.push({ questionId: q._id, theme, originalText: q.preamble });
          if (missing.length >= 10) return missing;
        }
      }
    }
    
    return missing;
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
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[precomputeThemeBatch] GEMINI_API_KEY not set. Skipping.");
      return;
    }

    const missing = await ctx.runQuery(internal.precompute.getMissingPrecomputations);
    if (missing.length === 0) {
      console.log("[precomputeThemeBatch] All questions and themes are precomputed!");
      return;
    }

    // Group the missing questions by theme (they usually are of the same theme because of the loop order, but just in case)
    const byTheme: Record<string, typeof missing> = {};
    for (const item of missing) {
      if (!byTheme[item.theme]) byTheme[item.theme] = [];
      byTheme[item.theme].push(item);
    }

    let allResults: { id: string; rewritten: string; theme: string }[] = [];

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

    // Schedule the next batch in 300 seconds (5 minute delay to respect limits heavily)
    await ctx.scheduler.runAfter(300000, internal.precompute.precomputeThemeBatch);
  }
});

// A manual trigger to kickstart the pipeline
export const startPrecomputePipeline = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.precompute.precomputeThemeBatch);
    return "Pipeline started!";
  }
});
