export type AgentType = "practice" | "homework";

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

  // Student self-assessment
  selfAssessment: string;
}
