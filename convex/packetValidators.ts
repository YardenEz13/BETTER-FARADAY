import { v } from "convex/values";

// ── Shared validators for the full-PDF packet import pipeline ──
// These are imported by both `schema.ts` (the `packetImportQuestions.draft`
// field) and the packet mutations/actions, so the extracted-draft shape can
// never drift from what publishing expects. The `packetSection` shape mirrors
// `compoundQuestions.sections` EXACTLY (including the required `points`,
// `skillsTested`, `correctAnswer` fields and the optional proof fields) so an
// approved compound draft publishes as a verbatim `sections` copy.

// One section of a compound/proof draft — identical shape to
// compoundQuestions.sections in schema.ts.
export const packetSection = v.object({
  label: v.string(),                     // "א" | "ב" | ...
  prompt: v.string(),
  dependsOn: v.optional(v.array(v.string())),
  answerType: v.string(),                // numeric|expression|range|proof|graph_description|coordinates
  correctAnswer: v.string(),             // REQUIRED for every answerType (proof → placeholder sentence)
  solutionSteps: v.array(v.string()),
  hints: v.array(v.string()),            // normalized to exactly 2
  points: v.number(),                    // REQUIRED — default 100/sectionCount on normalize
  skillsTested: v.array(v.string()),     // REQUIRED — default [] on normalize
  // Proof-only fields (present only when answerType === "proof").
  proofMeta: v.optional(v.object({
    given: v.string(),
    toProve: v.string(),
    diagramDescription: v.optional(v.string()),
    // diagramSvg intentionally omitted in v1 — the review UI shows the real
    // figure via the original PDF page embed instead.
  })),
  proofSteps: v.optional(v.array(v.object({
    stepIndex: v.number(),
    expectedClaim: v.string(),
    expectedReason: v.string(),
    clueIfWrong: v.optional(v.string()),
  }))),
});

// A packet question draft is either a legacy "simple" question (published to
// `questions` when MC, or a single-section `compoundQuestions` when fill_blank)
// or a multi-section "compound" (published to `compoundQuestions`). Geometry
// proofs are compound drafts whose sections carry answerType "proof".
export const packetDraft = v.union(
  v.object({
    kind: v.literal("simple"),
    format: v.string(),                  // "multiple_choice" | "fill_blank"
    difficulty: v.number(),              // 1-5
    stem: v.string(),
    choices: v.array(v.string()),        // [] for fill_blank
    correctIndex: v.optional(v.number()),
    correctAnswer: v.optional(v.string()),
    solutionSteps: v.array(v.string()),
    hints: v.array(v.string()),          // normalized to exactly 2
    explanation: v.string(),
  }),
  v.object({
    kind: v.literal("compound"),
    difficulty: v.number(),              // 1-5
    tags: v.array(v.string()),
    preamble: v.string(),
    sections: v.array(packetSection),
    fullSolution: v.string(),
  }),
);
