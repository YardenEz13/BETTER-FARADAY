import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import CompoundQuestionRenderer from "./CompoundQuestionRenderer";
import type { Id } from "../../convex/_generated/dataModel";

// Mock Convex hooks
const mockSubmitAnswer = vi.fn().mockResolvedValue(true);
const mockFinalizeSubmission = vi.fn().mockResolvedValue(true);

vi.mock("convex/react", () => ({
  useMutation: (apiPath: string) => {
    if (apiPath.includes("submitAnswer")) return mockSubmitAnswer;
    if (apiPath.includes("finalizeSubmission")) return mockFinalizeSubmission;
    return vi.fn();
  },
  useQuery: () => null,
}));

// Mock api
vi.mock("../../convex/_generated/api", () => ({
  api: {
    homework: {
      submitAnswer: "submitAnswer",
      finalizeSubmission: "finalizeSubmission",
    },
    compoundQuestions: {
      getFigureUrl: "getFigureUrl",
    },
  },
}));

const matchText = (text: string) => (content: string, element: Element | null) => {
  if (!element) return false;
  const hasText = (node: Element) => node.textContent ? node.textContent.includes(text) : false;
  const nodeHasText = hasText(element);
  const childrenDontHaveText = Array.from(element.children).every(
    child => !hasText(child)
  );
  return nodeHasText && childrenDontHaveText;
};

const mockQuestion = {
  _id: "cq-1" as Id<"compoundQuestions">,
  preamble: "נתונה פונקציה $f(x) = x^2 - 4x + 3$",
  preambleParams: [
    { symbol: "a", displayHe: "הפרמטר a", type: "given", value: "3" }
  ],
  sections: [
    {
      label: "א",
      prompt: "מצא את נקודות החיתוך של הפונקציה עם ציר ה-x.",
      answerType: "coordinates",
      correctAnswer: "(1,0), (3,0)",
      solutionSteps: ["משווים לאפס", "פותרים משוואה ריבועית"],
      hints: ["הצב y = 0", "השתמש בנוסחת השורשים"],
      points: 15,
      skillsTested: ["חיתוך עם הצירים"],
    },
    {
      label: "ב",
      prompt: "מצא את קודקוד הפרבולה.",
      dependsOn: ["א"],
      answerType: "coordinates",
      correctAnswer: "(2,-1)",
      solutionSteps: ["גוזרים ומשווים לאפס או משתמשים במינוס b חלקי 2a"],
      hints: ["x קודקוד = -b / 2a"],
      points: 10,
      skillsTested: ["נקודת קיצון"],
    }
  ],
  difficulty: 3,
  tags: ["חקירת פונקציה", "פרבולה"],
  fullSolution: "פתרון מלא כאן",
};

describe("CompoundQuestionRenderer Component", () => {
  const onCompleteMock = vi.fn();
  const aiChatTriggerMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render preamble, tags and first section expanded by default", () => {
    render(
      <CompoundQuestionRenderer
        question={mockQuestion}
        assignedQuestionId={"aq-1" as Id<"assignedQuestions">}
        onComplete={onCompleteMock}
        aiChatTrigger={aiChatTriggerMock}
      />
    );

    // Preamble should render
    expect(screen.getByText(matchText("נתונה פונקציה"))).toBeInTheDocument();
    expect(screen.getByText("חקירת פונקציה")).toBeInTheDocument();
    
    // First section prompt is visible
    expect(screen.getByText(matchText("מצא את נקודות החיתוך"))).toBeInTheDocument();

    // Second section (dependent) should show as locked / label is locked
    const secondHeader = screen.getByText("סעיף ב׳");
    expect(secondHeader).toBeInTheDocument();
  });

  it("should allow revealing hints in the active section", async () => {
    render(
      <CompoundQuestionRenderer
        question={mockQuestion}
        assignedQuestionId={"aq-1" as Id<"assignedQuestions">}
        onComplete={onCompleteMock}
      />
    );

    // Click hint button
    const hintButton = screen.getByRole("button", { name: /רמז/ });
    fireEvent.click(hintButton);

    // First hint should be revealed
    expect(screen.getByText("הצב y = 0")).toBeInTheDocument();
  });

  it("should submit answer for section א and unlock section ב", async () => {
    render(
      <CompoundQuestionRenderer
        question={mockQuestion}
        assignedQuestionId={"aq-1" as Id<"assignedQuestions">}
        onComplete={onCompleteMock}
        aiChatTrigger={aiChatTriggerMock}
      />
    );

    const textarea = screen.getByPlaceholderText("כתוב את הפתרון כאן…");
    const submitBtn = screen.getByRole("button", { name: /בדוק תשובה/ });

    // Type and submit answer
    fireEvent.change(textarea, { target: { value: "(1,0) וגם (3,0)" } });
    fireEvent.click(submitBtn);

    // Mutation should be called
    expect(mockSubmitAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionLabel: "א",
        studentAnswer: "(1,0) וגם (3,0)",
      })
    );

    // Section א should now show result/correct state
    await waitFor(() => {
      expect(screen.getByText(/התשובה נכונה/)).toBeInTheDocument();
    });

    // Section ב is now unlocked — click its header to expand it
    fireEvent.click(screen.getByText("סעיף ב׳"));

    // Section ב prompt should now be visible
    await waitFor(() => {
      expect(screen.getByText(matchText("מצא את קודקוד הפרבולה"))).toBeInTheDocument();
    });
  });
});

