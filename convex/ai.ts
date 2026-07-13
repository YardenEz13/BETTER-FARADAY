import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { GEMINI_MODELS, generateWithFallback } from "./geminiModels";

// Mocking some prompts so the server knows what to expect
const GEMINI_INSTRUCTIONS = `אתה מערכת אנליזה פדגוגית. נתח את שיחת התלמיד והמורה והחזר אך ורק JSON תקין.
הפקד להחזיר JSON ללא עטיפת markdown.

מבנה ה-JSON הנדרש:
{
  "confusionScore": number (0-100),
  "topicsCovered": string[],
  "questionsAsked": number,
  "avgResponseLength": number,
  "sentiment": "frustrated" | "neutral" | "confident",
  "keyStrugglePoints": string[],
  "engagementScore": number (0-100),
  "progressionSignal": "improving" | "stuck" | "learning",
  "conceptMentions": string[],
  "questionDepth": number (1-5),
  "independenceRatio": number (0-1),
  "gemmaAnalysisSummary": string (1-2 sentences),
  "missingKnowledge": string[],
  "teacherActionItem": string
}`;

export const processAbandonedChats = internalAction({
  args: {},
  handler: async (ctx) => {
    const { deletedCount, chatsToProcess } = await ctx.runMutation(internal.aiChat.findChatsToCleanup);
    console.log(`[cleanup] Deleted ${deletedCount} empty chats. Found ${chatsToProcess.length} abandoned chats to process.`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not set. Cannot process abandoned chats.");
      return;
    }

    for (const chatInfo of chatsToProcess) {
      try {
        const messages = await ctx.runQuery(internal.aiChat.getChatMessagesForAnalysis, { chatId: chatInfo.chatId });
        
        let conversationText = `הקשר לשאלה/נושא: ${chatInfo.context}\n\n`;
        conversationText += messages.map((m: any) => `${m.role === 'user' ? 'תלמיד' : 'מורה'}: ${m.content}`).join("\n");

        const result = await generateWithFallback(apiKey, GEMINI_MODELS.analysis, {
          contents: [{ role: "user", parts: [{ text: conversationText }] }],
          systemInstruction: { parts: [{ text: GEMINI_INSTRUCTIONS }] },
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          }
        });

        if (!result.ok) {
          console.error(`Gemini API error for chat ${chatInfo.chatId}: ${result.status} ${result.error}`);
          continue;
        }

        const data = result.data;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
           console.error(`Failed to parse Gemini JSON for chat ${chatInfo.chatId}`, text);
           continue;
        }

        // Save metrics and close chat
        await ctx.runMutation(internal.aiChat.endChatInternal, {
          chatId: chatInfo.chatId,
          metrics: {
            confusionScore: parsed.confusionScore ?? 50,
            topicsCovered: parsed.topicsCovered ?? [],
            questionsAsked: parsed.questionsAsked ?? 0,
            avgResponseLength: parsed.avgResponseLength ?? 0,
            sentiment: parsed.sentiment ?? "neutral",
            keyStrugglePoints: parsed.keyStrugglePoints ?? [],
            engagementScore: parsed.engagementScore ?? 50,
            progressionSignal: parsed.progressionSignal ?? "stuck",
            conceptMentions: parsed.conceptMentions ?? [],
            totalDurationMs: 0, // Abandoned, not tracked precisely
            questionDepth: parsed.questionDepth ?? 1,
            independenceRatio: parsed.independenceRatio ?? 0,
            gemmaAnalysisSummary: parsed.gemmaAnalysisSummary || "התלמיד נטש את השיחה.",
            missingKnowledge: parsed.missingKnowledge ?? [],
            teacherActionItem: parsed.teacherActionItem || "לברר עם התלמיד מדוע עזב את השיחה באמצע.",
          }
        });
        
        console.log(`[cleanup] Successfully processed abandoned chat ${chatInfo.chatId}`);

      } catch (err) {
        console.error(`Failed to process abandoned chat ${chatInfo.chatId}:`, err);
      }
    }
  }
});

export const generateHint = mutation({
  args: {
    studentId: v.id("students"),
    questionId: v.id("questions"),
    studentInput: v.string(),
  },
  handler: async (ctx, { studentId, questionId, studentInput }) => {
    const question = await ctx.db.get(questionId);
    if (!question) throw new Error("Question not found");

    // Generate a mock contextual hint based on the question's actual hint field
    const mockHint = question.hint;

    await ctx.db.insert("hintRequests", {
      studentId,
      questionId,
      studentInput: studentInput || "(no input)",
      aiHint: mockHint,
    });

    return { hint: mockHint };
  },
});

// ── Personalized Homework: fetch assigned IDs for personalization ──
export const getAssignedQuestionsForPersonalization = internalQuery({
  args: {
    assignedIds: v.array(v.id("assignedQuestions")),
  },
  handler: async (ctx, { assignedIds }) => {
    const results = [];
    for (const id of assignedIds) {
      const aq = await ctx.db.get(id);
      if (!aq) continue;

      let originalStem: string | null = null;
      let originalPreamble: string | null = null;
      let questionType: "legacy" | "compound" = "legacy";

      if (aq.compoundQuestionId) {
        const cq = await ctx.db.get(aq.compoundQuestionId);
        if (cq) {
          originalPreamble = cq.preamble;
          questionType = "compound";
        }
      } else if (aq.questionId) {
        const q = await ctx.db.get(aq.questionId);
        if (q) {
          originalStem = q.stem;
          questionType = "legacy";
        }
      }

      const student = await ctx.db.get(aq.studentId);
      results.push({
        assignedId: id,
        originalStem,
        originalPreamble,
        questionType,
        theme: student?.homeworkTheme ?? null,
        studentId: aq.studentId,
      });
    }
    return results;
  },
});

// ── Save personalized text back to assignedQuestion ──
export const savePersonalizedText = internalMutation({
  args: {
    assignedId: v.id("assignedQuestions"),
    personalizedStem: v.optional(v.string()),
    personalizedPreamble: v.optional(v.string()),
    themeApplied: v.string(),
  },
  handler: async (ctx, { assignedId, personalizedStem, personalizedPreamble, themeApplied }) => {
    await ctx.db.patch(assignedId, {
      personalizedStem,
      personalizedPreamble,
      themeApplied,
    });
  },
});

// ── Main: personalize homework questions using Gemini ──
export const personalizeHomework = internalAction({
  args: {
    assignedIds: v.array(v.id("assignedQuestions")),
  },
  handler: async (ctx, { assignedIds }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[personalizeHomework] GEMINI_API_KEY not set. Skipping personalization.");
      return;
    }

    const questions = await ctx.runQuery(internal.ai.getAssignedQuestionsForPersonalization, {
      assignedIds,
    });

    // Group questions by theme
    const byTheme: Record<string, typeof questions> = {};
    for (const q of questions) {
      if (!q.theme) continue; // no theme set for this student — skip
      if (!byTheme[q.theme]) byTheme[q.theme] = [];
      byTheme[q.theme].push(q);
    }

    // Process each theme in a single batch call
    for (const [theme, themeQuestions] of Object.entries(byTheme)) {
      const inputs = themeQuestions.map(q => {
        return {
          id: q.assignedId,
          original: q.originalStem ?? q.originalPreamble ?? ""
        };
      }).filter(i => i.original !== "");

      if (inputs.length === 0) continue;

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
          console.error(`[personalizeHomework] Gemini error ${result.status} for theme ${theme}: ${result.error}`);
          continue;
        }

        const data = result.data;
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) continue;

        const results: { id: string; rewritten: string }[] = JSON.parse(responseText);

        for (const res of results) {
          const q = themeQuestions.find(tq => tq.assignedId === res.id);
          if (!q) continue;

          await ctx.runMutation(internal.ai.savePersonalizedText, {
            assignedId: q.assignedId,
            personalizedStem: q.questionType === "legacy" ? res.rewritten : undefined,
            personalizedPreamble: q.questionType === "compound" ? res.rewritten : undefined,
            themeApplied: theme,
          });
          console.log(`[personalizeHomework] ✓ Personalized ${q.assignedId} with theme "${theme}"`);
        }
      } catch (err) {
        console.error(`[personalizeHomework] Failed batch for theme ${theme}:`, err);
      }
    }
  },
});
