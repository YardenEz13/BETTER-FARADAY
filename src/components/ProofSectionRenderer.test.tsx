import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import ProofSectionRenderer from "./ProofSectionRenderer";
import type { Id } from "../../convex/_generated/dataModel";

const mockGradeSection = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => mockGradeSection,
  useQuery: () => [], // no saved progress
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    proofGrading: {
      gradeProofSection: "gradeProofSection",
      getSavedSteps: "getSavedSteps",
    },
  },
}));

const steps = [
  { stepIndex: 1, expectedClaim: "טענה א", expectedReason: "הצדקה א" },
  { stepIndex: 2, expectedClaim: "טענה ב", expectedReason: "הצדקה ב" },
  { stepIndex: 3, expectedClaim: "טענה ג", expectedReason: "הצדקה ג" },
];

describe("ProofSectionRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regression: a packet-imported proof numbered its steps 1,2,3 instead of the
  // requested 0-based 0,1,2 (a model compliance slip). Progress must track
  // array position, not the raw stepIndex, or every step reads as unreachable.
  it("makes every step editable regardless of the model's stepIndex numbering", () => {
    render(
      <ProofSectionRenderer
        sectionLabel="ג"
        proofMeta={{ given: "נתון", toProve: "להוכיח" }}
        proofSteps={steps}
        hints={[]}
        assignedQuestionId={"aq-1" as Id<"assignedQuestions">}
        onSectionComplete={vi.fn()}
      />
    );

    const claimInputs = screen.getAllByPlaceholderText("לדוגמה: AO = OC");
    const reasonInputs = screen.getAllByPlaceholderText("לדוגמה: זוויות קודקוד שוות");
    expect(claimInputs).toHaveLength(3);
    expect(reasonInputs).toHaveLength(3);
    claimInputs.forEach((el) => expect(el).toBeEnabled());
    reasonInputs.forEach((el) => expect(el).toBeEnabled());
  });

  // The whole point of the redesign: one Gemini call per submit, not one per
  // step — regardless of how many steps the proof has.
  it("grades the whole proof in a single call, sending each step's real stepIndex", async () => {
    mockGradeSection.mockResolvedValue([
      { stepIndex: 1, claimCorrect: true, reasonCorrect: true, stepScore: 1, feedback: "יפה" },
      { stepIndex: 2, claimCorrect: true, reasonCorrect: true, stepScore: 1, feedback: "יפה" },
      { stepIndex: 3, claimCorrect: true, reasonCorrect: true, stepScore: 1, feedback: "יפה" },
    ]);
    const onSectionComplete = vi.fn();

    render(
      <ProofSectionRenderer
        sectionLabel="ג"
        proofMeta={{ given: "נתון", toProve: "להוכיח" }}
        proofSteps={steps}
        hints={[]}
        assignedQuestionId={"aq-1" as Id<"assignedQuestions">}
        onSectionComplete={onSectionComplete}
      />
    );

    const claimInputs = screen.getAllByPlaceholderText("לדוגמה: AO = OC");
    const reasonInputs = screen.getAllByPlaceholderText("לדוגמה: זוויות קודקוד שוות");
    claimInputs.forEach((el, i) => fireEvent.change(el, { target: { value: `claim ${i}` } }));
    reasonInputs.forEach((el, i) => fireEvent.change(el, { target: { value: `reason ${i}` } }));

    fireEvent.click(screen.getByRole("button", { name: /בדוק את ההוכחה/ }));

    await waitFor(() => expect(mockGradeSection).toHaveBeenCalledTimes(1));
    expect(mockGradeSection).toHaveBeenCalledWith({
      assignedQuestionId: "aq-1",
      sectionLabel: "ג",
      steps: [
        { stepIndex: 1, studentClaim: "claim 0", studentReason: "reason 0" },
        { stepIndex: 2, studentClaim: "claim 1", studentReason: "reason 1" },
        { stepIndex: 3, studentClaim: "claim 2", studentReason: "reason 2" },
      ],
    });
    await waitFor(() => expect(onSectionComplete).toHaveBeenCalledWith(true));
  });

  it("disables the check button until every step has both fields filled", () => {
    render(
      <ProofSectionRenderer
        sectionLabel="ג"
        proofMeta={{ given: "נתון", toProve: "להוכיח" }}
        proofSteps={steps}
        hints={[]}
        assignedQuestionId={"aq-1" as Id<"assignedQuestions">}
        onSectionComplete={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /בדוק את ההוכחה/ })).toBeDisabled();
  });
});
