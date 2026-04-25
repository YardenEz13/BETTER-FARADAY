import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  classrooms: defineTable({
    name: v.string(),
    teacherName: v.string(),
  }),

  students: defineTable({
    name: v.string(),
    classroomId: v.id("classrooms"),
    avatarColor: v.string(),
    currentTopicId: v.optional(v.id("topics")),
    streak: v.number(),
  }).index("by_classroom", ["classroomId"]),

  topics: defineTable({
    name: v.string(),
    nameHe: v.string(),
    order: v.number(),
    description: v.string(),
    icon: v.string(),
  }),

  questions: defineTable({
    topicId: v.id("topics"),
    difficulty: v.number(), // 1-5
    stem: v.string(),
    choices: v.array(v.string()),
    correctIndex: v.number(),
    solutionSteps: v.array(v.string()),
    hint: v.string(),
    explanation: v.string(),
  }).index("by_topic", ["topicId"]).index("by_topic_difficulty", ["topicId", "difficulty"]),

  attempts: defineTable({
    studentId: v.id("students"),
    questionId: v.id("questions"),
    topicId: v.id("topics"),
    isCorrect: v.boolean(),
    choiceIndex: v.number(),
    timeMs: v.number(),
    hintsUsed: v.number(),
    difficulty: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_student_topic", ["studentId", "topicId"])
    .index("by_question", ["questionId"]),

  hintRequests: defineTable({
    studentId: v.id("students"),
    questionId: v.id("questions"),
    studentInput: v.string(),
    aiHint: v.string(),
  }).index("by_student", ["studentId"]),

  sessions: defineTable({
    studentId: v.id("students"),
    topicId: v.id("topics"),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    questionsAttempted: v.number(),
    correctCount: v.number(),
    currentDifficulty: v.number(),
  }).index("by_student", ["studentId"]),

  // ── AI Chat tables ──
  aiChats: defineTable({
    studentId: v.id("students"),
    topicId: v.optional(v.id("topics")),
    questionId: v.optional(v.id("questions")),
    agentType: v.string(), // "practice" | "homework"
    title: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    messageCount: v.number(),
    metrics: v.optional(v.object({
      confusionScore: v.number(),
      topicsCovered: v.array(v.string()),
      questionsAsked: v.number(),
      avgResponseLength: v.number(),
      sentiment: v.string(),
      keyStrugglePoints: v.array(v.string()),
      // Enhanced fields (Gemma-generated)
      engagementScore: v.optional(v.number()),
      progressionSignal: v.optional(v.string()),
      conceptMentions: v.optional(v.array(v.string())),
      totalDurationMs: v.optional(v.number()),
      questionDepth: v.optional(v.number()),
      independenceRatio: v.optional(v.number()),
      gemmaAnalysisSummary: v.optional(v.string()),
    })),
  }).index("by_student", ["studentId"])
    .index("by_topic", ["topicId"])
    .index("by_agent", ["agentType"])
    .index("by_student_agent", ["studentId", "agentType"]),

  aiMessages: defineTable({
    chatId: v.id("aiChats"),
    role: v.string(), // "user" | "assistant" | "system"
    content: v.string(),
    timestamp: v.number(),
  }).index("by_chat", ["chatId"]),

  // ── Session Briefs (composite pedagogical summary per conversation) ──
  sessionBriefs: defineTable({
    chatId: v.id("aiChats"),
    studentId: v.id("students"),
    topicId: v.optional(v.id("topics")),
    createdAt: v.number(),

    // Cycle metadata
    totalCycles: v.number(),
    totalMessages: v.number(),
    totalDurationMs: v.number(),
    partialBriefs: v.array(v.object({
      sessionIndex: v.number(),
      messageCount: v.number(),
      durationMs: v.number(),
      summary: v.string(),
      triggerReason: v.string(), // "message_count" | "time" | "token_saturation" | "question_change"
    })),

    // Pedagogical Analysis
    approach: v.string(),
    frictionPoints: v.array(v.string()),
    autonomyLevel: v.number(),         // 1-5
    solutionAccuracy: v.number(),      // 1-5
    keyInsight: v.string(),
    recommendedAction: v.optional(v.string()),

    // Student's own voice
    selfAssessment: v.string(),
  })
    .index("by_student", ["studentId"])
    .index("by_student_topic", ["studentId", "topicId"])
    .index("by_chat", ["chatId"]),

  // ── Student Power Map (aggregated longitudinal profile, scheduled) ──
  studentPowerMap: defineTable({
    studentId: v.id("students"),
    lastUpdatedAt: v.number(),

    // Strength vs. Weakness Heatmap
    topicMastery: v.array(v.object({
      topicId: v.id("topics"),
      topicName: v.string(),
      masteryScore: v.number(),         // 0-100
      errorFrequency: v.number(),
      avgAccuracy: v.number(),          // 1-5
      sessionCount: v.number(),
      lastSessionAt: v.number(),
      trend: v.string(),                // "improving" | "stable" | "declining"
    })),

    // Progress Velocity
    progressVelocity: v.object({
      overall: v.number(),              // sessions per week
      accuracyDelta: v.number(),
      autonomyDelta: v.number(),
      weeklySnapshots: v.array(v.object({
        weekStart: v.number(),
        avgAccuracy: v.number(),
        avgAutonomy: v.number(),
        sessionCount: v.number(),
        topFriction: v.string(),
      })),
    }),

    // Engagement Metrics
    engagement: v.object({
      totalSessions: v.number(),
      totalMessages: v.number(),
      avgSessionDuration: v.number(),
      inquiryStyle: v.string(),         // "explorer" | "direct" | "passive"
      inquiryEvolution: v.array(v.object({
        date: v.number(),
        style: v.string(),
      })),
      frustrationTrend: v.string(),     // "decreasing" | "stable" | "increasing"
    }),
  })
    .index("by_student", ["studentId"]),
});
