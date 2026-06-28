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
    level: v.optional(v.number()), // 1-5: מתחיל, חוקר, מתקדם, מומחה, מאסטר
    homeworkTheme: v.optional(v.string()), // e.g. "כדורגל", "חברים" — used to personalize homework questions
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

  precomputedThemedQuestions: defineTable({
    questionId: v.string(), // Works for both legacy and compound questions
    theme: v.string(),
    personalizedText: v.string(),
  }).index("by_question_theme", ["questionId", "theme"]),

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
      // Teacher-enriched fields
      missingKnowledge: v.optional(v.array(v.string())),
      teacherActionItem: v.optional(v.string()),
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

    // Teacher-enriched analytics
    missingConcepts: v.optional(v.array(v.string())),
    teacherActionItem: v.optional(v.string()),
    studentQuotes: v.optional(v.array(v.string())),
    detailedStruggleAnalysis: v.optional(v.string()),
    nextSteps: v.optional(v.array(v.string())),

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

  // ── Compound 581-style multi-section questions ──
  compoundQuestions: defineTable({
    topicIds: v.array(v.id("topics")),
    difficulty: v.number(),               // 1-5 overall
    tags: v.array(v.string()),            // ["פרמטר", "נקודות קיצון", "אסימפטוטה"]
    bagrutYear: v.optional(v.string()),   // e.g., "תשפ״ה קיץ מועד א"
    sourceBook: v.optional(v.string()),   // e.g., "יואל גבע עמ׳ 342"
    preamble: v.string(),                 // Shared context / function definition
    preambleParams: v.array(v.object({
      symbol: v.string(),                // "a", "b", "m"
      displayHe: v.string(),             // "הפרמטר a"
      type: v.string(),                  // "find" | "given" | "range"
      value: v.optional(v.string()),
    })),
    sections: v.array(v.object({
      label: v.string(),                  // "א", "ב", "ג", "ד"
      prompt: v.string(),                 // The sub-question text in Hebrew
      dependsOn: v.optional(v.array(v.string())),
      answerType: v.string(),             // "numeric" | "expression" | "range" | "proof" | "graph_description" | "coordinates"
      correctAnswer: v.string(),
      solutionSteps: v.array(v.string()),
      hints: v.array(v.string()),         // Progressive hints (gentle → almost gives it away)
      points: v.number(),                 // Bagrut-style point allocation
      skillsTested: v.array(v.string()),  // ["גזירה", "השוואה לאפס"]
      // Proof-specific fields (only when answerType === "proof")
      proofMeta: v.optional(v.object({
        given: v.string(),                // נתון
        toProve: v.string(),              // להוכיח
        diagramDescription: v.optional(v.string()),
      })),
      proofSteps: v.optional(v.array(v.object({
        stepIndex: v.number(),
        expectedClaim: v.string(),
        expectedReason: v.string(),
        clueIfWrong: v.optional(v.string()),
      }))),
    })),
    fullSolution: v.string(),
  }).index("by_difficulty", ["difficulty"]),

  // ── Homework assignments ──
  homework: defineTable({
    classroomId: v.id("classrooms"),
    title: v.string(),
    topicIds: v.array(v.id("topics")),
    teacherNotes: v.optional(v.string()),
    questionCount: v.number(),            // target per student (3-4)
    createdAt: v.number(),
    deadline: v.number(),
    status: v.string(),                   // "active" | "closed" | "graded"
    // Teacher-imported questions pinned to this homework — assigned to EVERY
    // student verbatim, before the mastery-based auto-fill runs.
    pinnedQuestionIds: v.optional(v.array(v.id("questions"))),
    pinnedCompoundIds: v.optional(v.array(v.id("compoundQuestions"))),
  }).index("by_classroom", ["classroomId"])
    .index("by_status", ["status"]),

  // ── Per-student question assignments within a homework ──
  assignedQuestions: defineTable({
    homeworkId: v.id("homework"),
    studentId: v.id("students"),
    questionId: v.optional(v.id("questions")),
    compoundQuestionId: v.optional(v.id("compoundQuestions")),
    assignedDifficulty: v.number(),
    personalizedReason: v.string(),       // "mastery 35% → difficulty 3"

    // AI-personalized question text (theme-based rewrite)
    personalizedStem: v.optional(v.string()),       // rewritten stem for legacy questions
    personalizedPreamble: v.optional(v.string()),   // rewritten preamble for compound questions
    themeApplied: v.optional(v.string()),           // the theme that was used, e.g. "כדורגל"

    // Student's work
    status: v.string(),                   // "pending" | "in_progress" | "submitted"
    submittedAt: v.optional(v.number()),
    answers: v.optional(v.array(v.object({
      sectionLabel: v.string(),
      studentAnswer: v.string(),
      isCorrect: v.optional(v.boolean()),
      timeMs: v.optional(v.number()),
      hintsUsed: v.number(),
      proofStepResults: v.optional(v.array(v.object({
        stepIndex: v.number(),
        studentClaim: v.string(),
        studentReason: v.string(),
        claimCorrect: v.optional(v.boolean()),
        reasonCorrect: v.optional(v.boolean()),
        stepScore: v.number(),            // 0 | 0.5 | 1
        feedback: v.optional(v.string()),
      }))),
    }))),
    score: v.optional(v.number()),        // 0-100
    aiInteractions: v.optional(v.number()),
  }).index("by_homework", ["homeworkId"])
    .index("by_student", ["studentId"])
    .index("by_homework_student", ["homeworkId", "studentId"]),

  // ── Teacher rundown (generated after deadline) ──
  homeworkRundowns: defineTable({
    homeworkId: v.id("homework"),
    classroomId: v.id("classrooms"),
    generatedAt: v.number(),
    classAvgScore: v.number(),
    completionRate: v.number(),
    avgTimeMinutes: v.number(),
    topicBreakdown: v.array(v.object({
      topicId: v.id("topics"),
      topicName: v.string(),
      avgScore: v.number(),
      hardestSection: v.string(),
      commonMistakes: v.array(v.string()),
    })),
    clusters: v.array(v.object({
      label: v.string(),
      studentIds: v.array(v.id("students")),
      recommendedAction: v.string(),
    })),
    flagged: v.array(v.object({
      studentId: v.id("students"),
      reason: v.string(),
    })),
  }).index("by_homework", ["homeworkId"]),

  // ── Level progression suggestions ──
  levelSuggestions: defineTable({
    studentId: v.id("students"),
    currentLevel: v.number(),
    suggestedLevel: v.number(),
    reason: v.string(),
    evidence: v.object({
      topicsMastered: v.number(),
      avgAccuracy: v.number(),
      homeworkAvgScore: v.number(),
      recentStreak: v.number(),
    }),
    status: v.string(),              // "pending" | "approved" | "rejected"
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
  }).index("by_student", ["studentId"])
    .index("by_status", ["status"]),

  // ── Feature 2: Teacher-imported questions (staging area for review) ──
  // A teacher uploads a photo/PDF of a textbook question; Gemini extracts it
  // into an editable draft. The teacher reviews/edits, then approves — which
  // publishes a real `questions` (multiple-choice) or `compoundQuestions`
  // (fill-in-the-blank) row that can be pinned to a homework assignment.
  teacherImportedQuestions: defineTable({
    classroomId: v.id("classrooms"),
    createdAt: v.number(),
    sourceType: v.string(),                 // "image" | "pdf"
    sourceName: v.optional(v.string()),     // original filename / teacher label
    status: v.string(),                     // "extracting" | "review" | "approved" | "failed" | "discarded"
    errorMessage: v.optional(v.string()),

    // Raw Gemini OCR/vision output, kept so the teacher can re-generate formats
    // without re-uploading the source image.
    rawExtractedText: v.optional(v.string()),

    // The structured, teacher-editable question. Shape mirrors `questions` so
    // publishing an approved multiple-choice draft is a direct insert.
    draft: v.optional(v.object({
      format: v.string(),                   // "multiple_choice" | "fill_blank"
      topicId: v.optional(v.id("topics")),
      difficulty: v.number(),               // 1-5
      stem: v.string(),
      choices: v.array(v.string()),         // MC only (empty array for fill_blank)
      correctIndex: v.optional(v.number()), // MC
      correctAnswer: v.optional(v.string()),// fill_blank
      solutionSteps: v.array(v.string()),
      hint: v.string(),
      explanation: v.string(),
    })),

    // Set on approval so we never double-publish the same import.
    publishedQuestionId: v.optional(v.id("questions")),
    publishedCompoundId: v.optional(v.id("compoundQuestions")),
  }).index("by_classroom", ["classroomId"])
    .index("by_classroom_status", ["classroomId", "status"]),

  // ── PDF personal assignments (single-student, image-per-question) ──
  // A teacher uploads a multi-page PDF (e.g. a summer workbook), crops each
  // question out as an image, and types the correct answer. The whole PDF is
  // saved to Convex file storage; each question is one small cropped JPEG plus
  // its answer. Unlike `homework`, this is assigned to ONE student — the target
  // is on the row itself, so it bypasses the classroom-wide fan-out entirely.
  pdfAssignments: defineTable({
    classroomId: v.id("classrooms"),
    studentId: v.id("students"),          // the single target student
    title: v.string(),
    pdfStorageId: v.optional(v.id("_storage")), // full source PDF (file storage)
    pdfFileName: v.optional(v.string()),
    createdAt: v.number(),
    deadline: v.optional(v.number()),
    status: v.string(),                   // "active" | "completed" | "closed"
    completedAt: v.optional(v.number()),  // set when the student answers every part
  })
    .index("by_student", ["studentId"])
    .index("by_classroom", ["classroomId"]),

  // ── One question = a cropped image + one or more answerable parts ──
  // A multi-part question (סעיף א/ב/ג sharing one figure) is a single image
  // with several labeled parts. A simple one-answer question is just one part
  // with an empty label. Student work is stored inline per part (there is
  // exactly one solver per assignment), graded part-by-part.
  pdfQuestions: defineTable({
    assignmentId: v.id("pdfAssignments"),
    order: v.number(),
    imageBase64: v.string(),              // cropped JPEG, kept under the 1MB doc limit
    imageMimeType: v.string(),            // "image/jpeg"
    parts: v.array(v.object({
      label: v.string(),                  // "א" / "ב" / "" for single-answer questions
      correctAnswer: v.string(),
      points: v.optional(v.number()),
      // Student's solve for this part — filled by submitPdfAnswer
      studentAnswer: v.optional(v.string()),
      isCorrect: v.optional(v.boolean()),
      answeredAt: v.optional(v.number()),
    })),
  }).index("by_assignment", ["assignmentId"]),

  // ── QR bridge: hand a handwritten-work photo from phone → desktop chat ──
  // Short-lived, single-use capability sessions. The desktop creates one and
  // shows its token as a QR; the phone opens /bridge/<token>, uploads a
  // compressed photo (base64, kept under the 1MB doc limit), and the desktop —
  // subscribed by token — pulls it into the chat. Rows are swept after expiry.
  bridgeSessions: defineTable({
    token: v.string(),                    // random, unguessable — in the QR URL
    studentId: v.id("students"),
    label: v.optional(v.string()),        // context shown on the phone, e.g. topic
    status: v.string(),                   // "pending" | "uploaded" | "consumed"
    imageBase64: v.optional(v.string()),  // compressed JPEG, cleared on consume
    imageMimeType: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),
});
