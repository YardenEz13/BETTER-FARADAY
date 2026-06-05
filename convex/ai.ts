import { internalAction, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: conversationText }] }],
            systemInstruction: { parts: [{ text: GEMINI_INSTRUCTIONS }] },
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            }
          })
        });

        if (!response.ok) {
          console.error(`Gemini API error for chat ${chatInfo.chatId}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch(e) {
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

