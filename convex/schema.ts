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
});
