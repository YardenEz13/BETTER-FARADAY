import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { packetDraft } from "./packetValidators";

export default defineSchema({
  classrooms: defineTable({
    name: v.string(),
    teacherName: v.string(),
    leaderboardEnabled: v.optional(v.boolean()), // teacher master switch; default ON when unset
  }),

  students: defineTable({
    name: v.string(),
    classroomId: v.id("classrooms"),
    avatarColor: v.string(),
    currentTopicId: v.optional(v.id("topics")),
    streak: v.number(),
    level: v.optional(v.number()), // 1-5: מתחיל, חוקר, מתקדם, מומחה, מאסטר
    homeworkTheme: v.optional(v.string()), // e.g. "כדורגל", "חברים" — used to personalize homework questions
    // ── Gamification (denormalized; optional so existing rows stay valid) ──
    xp: v.optional(v.number()),            // total XP earned (sum of positive xpEvents)
    xpSpent: v.optional(v.number()),       // total XP spent in the shop
    lastActiveDate: v.optional(v.string()),// YYYY-MM-DD in Israel time — streak bookkeeping
    streakFreezes: v.optional(v.number()), // available streak-freeze charges (from shop)
    equippedTheme: v.optional(v.string()), // shop theme key currently applied to the learning map ("electric" | "night"); absent = default backdrop
    onboardedAt: v.optional(v.number()),   // ms epoch when the first-run welcome wizard was completed; absent = show onboarding
    dailyGoal: v.optional(v.number()),     // questions-per-day target (5-30); absent = DEFAULT_DAILY_GOAL
    hideFromLeaderboard: v.optional(v.boolean()), // per-student opt-out of the weekly class leaderboard
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
    source: v.optional(v.string()), // e.g. "review" — distinguishes review-deck answers
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
    // Debounce latch: when a recompute is queued this holds its due-time so
    // additional briefs inside the window don't queue duplicate recomputes.
    recomputeScheduledAt: v.optional(v.number()),

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
    // The original scanned/cropped figure (packet import, crop mode). Stored as
    // a file, not inline base64 — this doc is loaded on every homework fetch,
    // so an inline image would bloat every read of the question.
    figureImageStorageId: v.optional(v.id("_storage")),
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
        diagramSvg: v.optional(v.string()), // inline SVG string for the geometric figure
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

  // ── Bagrut exam simulation (מתכונת) attempts ──
  // One row per exam sitting. compoundQuestionIds are frozen at start time; the
  // per-question / per-section student work + grading lives inline in perQuestion
  // (bounded: 2-3 questions, a handful of sections each). Solutions are NEVER
  // returned to the client while status is "in_progress" — see convex/exams.ts.
  examAttempts: defineTable({
    studentId: v.id("students"),
    compoundQuestionIds: v.array(v.id("compoundQuestions")),
    startedAt: v.number(),
    durationMinutes: v.number(),          // allotted time (30 * question count)
    submittedAt: v.optional(v.number()),
    status: v.string(),                   // "in_progress" | "submitted" | "expired"
    perQuestion: v.array(v.object({
      compoundQuestionId: v.id("compoundQuestions"),
      sectionResults: v.array(v.object({
        sectionLabel: v.string(),
        studentAnswer: v.string(),
        isCorrect: v.optional(v.boolean()),    // absent = self-check (proof/expression)
        pointsEarned: v.optional(v.number()),
        pointsPossible: v.number(),
        selfGraded: v.optional(v.boolean()),   // student self-assessed this section
        needsSelfCheck: v.optional(v.boolean()),// shown as "בדיקה עצמית"
      })),
      totalEarned: v.number(),
      totalPossible: v.number(),
    })),
    finalScore: v.optional(v.number()),   // 0-100, weighted by points
  }).index("by_student", ["studentId"]),

  // ── Homework assignments ──
  homework: defineTable({
    classroomId: v.id("classrooms"),
    title: v.string(),
    topicIds: v.array(v.id("topics")),
    teacherNotes: v.optional(v.string()),
    questionCount: v.number(),            // target per student (3-4)
    createdAt: v.number(),
    deadline: v.number(),
    status: v.string(),                   // "draft" | "scheduled" | "active" | "closed" | "graded"
    // When set, the homework is inserted as "scheduled" and auto-published at
    // this ms-epoch via internal.homework.publishScheduled. Absent for drafts
    // and for homework published immediately.
    publishAt: v.optional(v.number()),
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

  // ── Teacher Weekly Digest (per-class, last-7-days summary) ──
  // One row per classroom per generation. The whole rendered summary lives in
  // the typed `payload` object (bounded: fixed-size totals + at most a handful
  // of per-topic / top-3 student entries), so a single index-based read gives
  // the dashboard everything the digest card needs.
  weeklyDigests: defineTable({
    classroomId: v.id("classrooms"),
    weekStart: v.number(),        // ms — start of the 7-day window
    generatedAt: v.number(),
    payload: v.object({
      // Headline totals for the week
      totals: v.object({
        activeStudents: v.number(),
        totalStudents: v.number(),
        attempts: v.number(),
        accuracy: v.number(),          // 0-100, class accuracy this week
        accuracyDelta: v.number(),     // vs previous week (points)
        homeworkCompletion: v.number(),// 0-100, submitted / assigned
      }),
      // Per-topic accuracy this week vs previous week
      topicDeltas: v.array(v.object({
        topicId: v.id("topics"),
        name: v.string(),
        pct: v.number(),               // 0-100 this week
        delta: v.number(),             // points vs previous week
        attempts: v.number(),
      })),
      // Top 3 struggling / improving students (one-line Hebrew reasons)
      struggling: v.array(v.object({
        studentId: v.id("students"),
        name: v.string(),
        avatarColor: v.string(),
        acc: v.number(),               // 0-100 this week
        trend: v.number(),             // points vs previous week
        reason: v.string(),
      })),
      improving: v.array(v.object({
        studentId: v.id("students"),
        name: v.string(),
        avatarColor: v.string(),
        acc: v.number(),
        trend: v.number(),
        reason: v.string(),
      })),
      // Notable events (streak milestones, pending level suggestions, …)
      notableEvents: v.array(v.object({
        kind: v.string(),              // "streak" | "level" | "homework"
        who: v.string(),
        text: v.string(),
      })),
      // 2-4 rule-based recommended teacher actions
      recommendedActions: v.array(v.object({
        priority: v.string(),          // "high" | "medium" | "low"
        text: v.string(),
      })),
    }),
  }).index("by_classroom", ["classroomId"]),

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

  // ── Full-PDF packet import (מטלת קיץ): one uploaded multi-page PDF → AI
  // extracts EVERY question, solves each into the app's existing formats, and
  // stages them for teacher review before publishing to `questions` /
  // `compoundQuestions`. Unlike `pdfAssignments` (teacher manually crops each
  // question), this is an AI-driven bulk extractor. The pipeline runs as
  // scheduler-chained internalActions (inventory → solve chunks → optional
  // verify), keyed off the per-question rows below — the packet row itself
  // holds NO inventory/chunk blob (see the no-unbounded-array guideline).
  packetImports: defineTable({
    classroomId: v.id("classrooms"),
    sourceName: v.string(),                 // original PDF filename
    pdfStorageId: v.id("_storage"),         // full source PDF (file storage)
    // "auto" = AI reads the whole PDF itself (inventory → solve chunks).
    // "crops" = teacher crops each question + its answer-key snippet, then ONE
    // Gemini call structures the batch (no solving — answers come from crops).
    mode: v.optional(v.string()),           // "auto" (default) | "crops"
    status: v.string(),                     // "cropping" | "inventory" | "solving" | "verifying" | "review" | "failed" | "cancelled"
    pageCount: v.optional(v.number()),
    totalQuestions: v.optional(v.number()), // set at inventory time; progress is derived from row status counts
    verifyEnabled: v.boolean(),             // run the independent-solve verification pass
    error: v.optional(v.string()),
    // Auto mode: the source PDF uploaded once to the Gemini Files API, then
    // referenced by URI in every inventory/solve call instead of re-inlining the
    // base64 PDF per request (major egress cut). Re-uploaded when past expiry.
    pdfFileUri: v.optional(v.string()),
    pdfFileName: v.optional(v.string()),      // "files/…" handle for files.get/delete
    pdfFileExpiresAt: v.optional(v.number()), // ms epoch; Files API stores ~48h
    createdAt: v.number(),
  }).index("by_classroom", ["classroomId"]),

  // ── One extracted question from a packet (also the inventory record) ──
  // Inserted at inventory time (status "pending", draft absent), then patched
  // with the solved `draft` once its chunk lands. Proof questions land as
  // "proof_unverified" and require an explicit teacher confirmation before
  // approve. The `draft` union mirrors the publish targets exactly.
  packetImportQuestions: defineTable({
    packetId: v.id("packetImports"),
    classroomId: v.id("classrooms"),
    sourceLabel: v.string(),                // normalized key (see normalizeLabel) — used to match solve results
    sourceLabelRaw: v.string(),             // as printed in the packet, for display
    orderIndex: v.number(),                 // packet reading order
    pageStart: v.number(),
    pageEnd: v.number(),
    kind: v.string(),                       // "simple" | "compound" | "proof"
    status: v.string(),                     // "pending" | "review" | "flagged" | "proof_unverified" | "approved" | "discarded" | "failed"
    topicHe: v.string(),                    // model's topic guess (verbatim from the injected topic list)
    topicId: v.optional(v.id("topics")),    // resolved via exact/fuzzy nameHe match; unset blocks approve
    draft: v.optional(packetDraft),
    // Crop mode: teacher-cropped JPEGs (base64, no data-URL prefix). The answer
    // crop is the authoritative answer key — the AI transcribes, never re-solves.
    // Kept per-row (≤1MB doc limit) and EXCLUDED from list queries (size).
    questionImageBase64: v.optional(v.string()),
    answerImageBase64: v.optional(v.string()),
    editedByTeacher: v.optional(v.boolean()), // guards against late pipeline writes clobbering manual edits
    proofReviewedAt: v.optional(v.number()),  // set when the teacher confirms the proof steps (approve gate)
    verification: v.optional(v.object({
      verdict: v.string(),                  // "match" | "mismatch" | "skipped" | "proof_checked" | "proof_mismatch"
      detail: v.optional(v.string()),       // Hebrew note surfaced to the teacher
    })),
    publishedQuestionId: v.optional(v.id("questions")),
    publishedCompoundId: v.optional(v.id("compoundQuestions")),
    errorMessage: v.optional(v.string()),
    // Heartbeat: refreshed by every pipeline action that picks the row up while
    // "pending". The stale-packet cron treats a pending row whose heartbeat is
    // older than STALE_PENDING_MS as orphaned (action hit the 10-min ceiling).
    pendingSince: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_packet", ["packetId"])
    .index("by_packet_status", ["packetId", "status"]),

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

  // ── Parent report capability links (long-lived, revocable) ──
  // Same capability-URL philosophy as bridgeSessions, but LONG-lived: a parent
  // opens /parent/<token> to see a warm weekly snapshot of their child. The
  // token is the ONLY key — the report query never exposes studentId. Revoke by
  // stamping revokedAt (row kept for audit). One active link per student.
  parentLinks: defineTable({
    studentId: v.id("students"),
    token: v.string(),                 // random, unguessable — in the /parent URL
    createdAt: v.number(),
    revokedAt: v.optional(v.number()), // set on revoke; absent = active
    lastViewedAt: v.optional(v.number()),
  }).index("by_token", ["token"])
    .index("by_student", ["studentId"]),

  // ── XP ledger: append-only log of every XP change (earn or spend) ──
  // students.xp / students.xpSpent are denormalized rollups of these rows.
  xpEvents: defineTable({
    studentId: v.id("students"),
    amount: v.number(),   // positive = earned, negative = spent (e.g. "purchase")
    reason: v.string(),   // "attempt_correct" | "attempt_wrong" | "streak_day" | "homework_submitted" | "level_up_bonus" | "purchase" | "review_correct"
    refId: v.optional(v.string()), // loose ref to the source doc (questionId, itemId, …)
    createdAt: v.number(),
  }).index("by_student", ["studentId"]),

  // ── XP shop catalogue ──
  shopItems: defineTable({
    name: v.string(),        // Hebrew display name
    description: v.string(),
    icon: v.string(),        // lucide icon name or emoji
    category: v.string(),    // "avatar_color" | "theme" | "streak_freeze" | "badge"
    // Machine-usable payload for equippable items. avatar_color → the CSS color
    // string written to students.avatarColor (hex, matching AVATAR_COLORS).
    // theme → the equippedTheme key ("electric" | "night"). Absent for others.
    value: v.optional(v.string()),
    price: v.number(),
    sortOrder: v.number(),
    active: v.boolean(),
  }).index("by_active", ["active"]),

  // ── Notification read-state (per student, per derived notification key) ──
  // Notifications themselves are DERIVED at read time (no stored notification
  // rows). This table only records which stable keys a student has dismissed /
  // read, keyed by the same stable string the query emits (e.g. "hw_<id>",
  // "streak_<israelDate>"). Read is a bounded index scan by student.
  notificationReads: defineTable({
    studentId: v.id("students"),
    notificationKey: v.string(),
    readAt: v.number(),
  }).index("by_student", ["studentId"])
    .index("by_student_key", ["studentId", "notificationKey"]),

  // ── Purchases (one row per acquisition) ──
  purchases: defineTable({
    studentId: v.id("students"),
    itemId: v.id("shopItems"),
    price: v.number(),
    createdAt: v.number(),
    consumed: v.optional(v.boolean()), // for consumables (streak_freeze)
  }).index("by_student", ["studentId"])
    .index("by_student_item", ["studentId", "itemId"]),

  // ── System flags (kill-switches / feature toggles) ──
  // Single-row-per-key table so ops can flip Faraday off without a deploy.
  // Checked by convex/http.ts on every Gemini proxy request.
  systemFlags: defineTable({
    key: v.string(),
    enabled: v.boolean(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // ── Live class mode (שיעור חי) ──
  // Teacher broadcasts one question to the whole classroom; answers stream in
  // live (Convex reactivity does the heavy lifting). One active session per
  // classroom at a time; one answer per student per session.
  liveSessions: defineTable({
    classroomId: v.id("classrooms"),
    questionId: v.id("questions"),
    status: v.union(v.literal("active"), v.literal("ended")),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  }).index("by_classroom", ["classroomId"]),

  liveAnswers: defineTable({
    sessionId: v.id("liveSessions"),
    studentId: v.id("students"),
    choiceIndex: v.number(),
    isCorrect: v.boolean(),
    answeredAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_student", ["sessionId", "studentId"]),
});
