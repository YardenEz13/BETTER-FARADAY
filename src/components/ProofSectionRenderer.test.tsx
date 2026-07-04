import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ProofSectionRenderer from "./ProofSectionRenderer";
import type { Id } from "../../convex/_generated/dataModel";

const mockGradeStep = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => mockGradeStep,
  useQuery: () => [], // no saved progress
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    proofGrading: {
      gradeProofStep: "gradeProofStep",
      getSavedSteps: "getSavedSteps",
    },
  },
}));

describe("ProofSectionRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regression: a packet-imported proof numbered its steps 1,2,3 instead of the
  // requested 0-based 0,1,2 (a model compliance slip). The renderer's own
  // progress counter used to compare raw stepIndex directly against a 0-based
  // counter, so every step read as "locked" forever and the proof was
  // unanswerable. Progress must track array position, not the raw stepIndex.
  it("makes the first step answerable even when stepIndex starts at 1", () => {
    render(
      <ProofSectionRenderer
        sectionLabel="ג"
        proofMeta={{ given: "נתון", toProve: "להוכיח" }}
        proofSteps={[
          { stepIndex: 1, expectedClaim: "טענה א", expectedReason: "הצדקה א" },
          { stepIndex: 2, expectedClaim: "טענה ב", expectedReason: "הצדקה ב" },
          { stepIndex: 3, expectedClaim: "טענה ג", expectedReason: "הצדקה ג" },
        ]}
        hints={[]}
        assignedQuestionId={"aq-1" as Id<"assignedQuestions">}
        onSectionComplete={vi.fn()}
      />
    );

    // The first step's input fields must be present and enabled — not stuck
    // behind the "ממתין..." (waiting) locked placeholder.
    expect(screen.getByPlaceholderText("לדוגמה: AO = OC")).toBeEnabled();
    expect(screen.getByPlaceholderText("לדוגמה: זוויות קודקוד שוות")).toBeEnabled();
    expect(screen.getByRole("button", { name: /שלח צעד/ })).toBeInTheDocument();
    expect(screen.queryAllByText("ממתין...")).toHaveLength(2 * 2); // 2 locked steps × 2 columns
  });
});
