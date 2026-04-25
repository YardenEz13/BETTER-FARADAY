import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const generate = mutation({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    const topics = await ctx.db.query("topics").collect();
    const questions = await ctx.db.query("questions").collect();

    if (!students.length || !topics.length || !questions.length) {
      return { message: "Database must be seeded first." };
    }

    const now = Date.now();
    let attemptCount = 0;
    let chatCount = 0;

    for (const student of students) {
      const numSessions = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < numSessions; i++) {
        const topic = topics[Math.floor(Math.random() * topics.length)];
        const topicQuestions = questions.filter(q => q.topicId === topic._id);
        if (topicQuestions.length === 0) continue;

        const sessionStart = now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
        const numAttempts = Math.floor(Math.random() * 4) + 2;
        let correctCount = 0;

        for (let j = 0; j < numAttempts; j++) {
          const q = topicQuestions[Math.floor(Math.random() * topicQuestions.length)];
          const isCorrect = Math.random() > 0.3;
          if (isCorrect) correctCount++;
          
          await ctx.db.insert("attempts", {
            studentId: student._id,
            questionId: q._id,
            topicId: topic._id,
            isCorrect,
            choiceIndex: isCorrect ? q.correctIndex : (q.correctIndex + 1) % 4,
            timeMs: Math.floor(Math.random() * 120000) + 10000,
            hintsUsed: Math.floor(Math.random() * 2),
            difficulty: q.difficulty,
          });
          attemptCount++;
        }

        await ctx.db.insert("sessions", {
          studentId: student._id,
          topicId: topic._id,
          startedAt: sessionStart,
          endedAt: sessionStart + Math.floor(Math.random() * 900000) + 300000,
          questionsAttempted: numAttempts,
          correctCount,
          currentDifficulty: Math.floor(Math.random() * 3) + 2,
        });

        if (Math.random() > 0.4) {
          const chatId = await ctx.db.insert("aiChats", {
            studentId: student._id,
            topicId: topic._id,
            agentType: "practice",
            title: `תרגול: ${topic.nameHe}`,
            startedAt: sessionStart + 60000,
            endedAt: sessionStart + 300000,
            messageCount: Math.floor(Math.random() * 8) + 4,
            metrics: {
              confusionScore: Math.random() * 10,
              topicsCovered: [topic.nameHe],
              questionsAsked: Math.floor(Math.random() * 3) + 1,
              avgResponseLength: 150,
              sentiment: Math.random() > 0.5 ? "confident" : "frustrated",
              keyStrugglePoints: ["הבנת השאלה", "חישוב אלגברי"],
              engagementScore: Math.floor(Math.random() * 40) + 60,
              progressionSignal: (Math.random() > 0.5) ? "improving" : "stuck",
              conceptMentions: [topic.nameHe],
              totalDurationMs: 240000,
              questionDepth: 3,
              independenceRatio: Math.random() * 0.5 + 0.3,
              gemmaAnalysisSummary: "התלמיד הבין את הקונספט הכללי אך התקשה בחישוב הסופי.",
            }
          });

          await ctx.db.insert("sessionBriefs", {
            chatId,
            studentId: student._id,
            topicId: topic._id,
            createdAt: sessionStart + 300000,
            totalCycles: 1,
            totalMessages: 6,
            totalDurationMs: 240000,
            partialBriefs: [],
            approach: "חקירה מונחית",
            frictionPoints: ["שלב ההצבה במשוואה"],
            autonomyLevel: Math.floor(Math.random() * 3) + 2,
            solutionAccuracy: (Math.random() > 0.5) ? 5 : 2,
            keyInsight: "זקוק ליותר תרגול בזיהוי הנוסחה הנכונה",
            recommendedAction: "תרגול שאלות דומות ברמה נמוכה יותר",
            selfAssessment: (Math.random() > 0.5) ? "היה סבבה" : "קצת קשה",
          });
          chatCount++;
        }
      }
    }

    return { message: `Generated ${attemptCount} attempts and ${chatCount} chats for ${students.length} students.` };
  }
});
