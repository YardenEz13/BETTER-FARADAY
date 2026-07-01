export type AgentType = "practice" | "homework" | "proof";

export interface ChatMetrics {
  // Core heuristic metrics (always present)
  confusionScore: number;
  topicsCovered: string[];
  questionsAsked: number;
  avgResponseLength: number;
  sentiment: "frustrated" | "neutral" | "confident";
  keyStrugglePoints: string[];
  // Gemma-enhanced metrics (present when AI analysis succeeds)
  engagementScore?: number;          // 0-100
  progressionSignal?: "improving" | "stuck" | "declining";
  conceptMentions?: string[];        // Hebrew math terms detected
  totalDurationMs?: number;          // First to last message time
  questionDepth?: number;            // 1-5 how deep student probed
  independenceRatio?: number;        // 0-1 how much student showed own work
  gemmaAnalysisSummary?: string;     // Free-text summary from Gemma
  // Teacher-enriched fields
  missingKnowledge?: string[];       // Specific concepts/formulas the student doesn't know
  teacherActionItem?: string;        // Concrete recommended action for teacher
}

// ── Session Cycling Types ──

export interface PartialBrief {
  sessionIndex: number;
  messageCount: number;
  durationMs: number;
  summary: string;
  triggerReason: "message_count" | "time" | "token_saturation" | "question_change";
}

export interface CompositeBrief {
  // Cycle metadata
  totalCycles: number;
  totalMessages: number;
  totalDurationMs: number;
  partialBriefs: PartialBrief[];

  // Pedagogical analysis
  approach: string;
  frictionPoints: string[];
  autonomyLevel: number;          // 1-5
  solutionAccuracy: number;       // 1-5
  keyInsight: string;
  recommendedAction?: string;

  // Teacher-enriched analytics
  missingConcepts?: string[];       // Concepts the student is missing
  teacherActionItem?: string;       // Specific action for the teacher
  studentQuotes?: string[];         // Key quotes from the student that reveal understanding/confusion
  detailedStruggleAnalysis?: string; // Detailed description of where the student struggled
  nextSteps?: string[];             // Concrete next exercises/topics for the student

  // Student self-assessment
  selfAssessment: string;
}
