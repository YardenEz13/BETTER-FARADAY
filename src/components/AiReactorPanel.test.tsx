import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AiReactorPanel from "./AiReactorPanel";

const queryResults = new Map<string, unknown>();
const setAiEnabled = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (ref: { _name: string }) => queryResults.get(ref._name),
  useMutation: () => setAiEnabled,
}));

// The generated api object is a proxy of function refs; a name-tagged stub is
// enough for the mocked useQuery above to route on.
vi.mock("../../convex/_generated/api", () => ({
  api: {
    aiGate: { getAiEnabled: { _name: "aiEnabled" }, setAiEnabled: { _name: "setAiEnabled" } },
    aiUsage: { getUsageSummary: { _name: "usage" } },
    attempts: { getQuestionFailureRates: { _name: "failures" } },
  },
}));

vi.mock("./MathText", () => ({ default: ({ children }: { children: string }) => <span>{children}</span> }));

const usage = {
  today: { day: "2026-07-21", requests: 42, errors: 3, promptTokens: 1000, outputTokens: 500 },
  byTaskToday: [{ task: "chat", requests: 40, errors: 3 }],
  daily: Array.from({ length: 7 }, (_, i) => ({ day: `d${i}`, requests: i, errors: 0, promptTokens: 0, outputTokens: 0 })),
};

beforeEach(() => {
  queryResults.clear();
  setAiEnabled.mockReset();
});

describe("AiReactorPanel", () => {
  it("shows the kill switch as on and renders today's meters", () => {
    queryResults.set("aiEnabled", true);
    queryResults.set("usage", usage);
    queryResults.set("failures", []);
    render(<AiReactorPanel />);

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("42")).toBeInTheDocument();       // requests today
    expect(screen.getByText("1,500")).toBeInTheDocument();    // prompt + output tokens
    expect(screen.getByText("21")).toBeInTheDocument();       // 0+1+…+6 over 7 days
  });

  it("warns that students see the resting message when the switch is off", () => {
    queryResults.set("aiEnabled", false);
    queryResults.set("usage", usage);
    queryResults.set("failures", []);
    render(<AiReactorPanel />);

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/פאראדיי נח/)).toBeInTheDocument();
  });

  it("ignores questions with too few attempts to mean anything", () => {
    queryResults.set("aiEnabled", true);
    queryResults.set("usage", usage);
    queryResults.set("failures", [
      // 1/1 wrong reads as 100% but is noise — must not outrank the real one.
      { questionId: "q1", stem: "שאלה חד־פעמית", topicId: "t1", failureRate: 1, attempts: 1 },
      { questionId: "q2", stem: "שאלה קשה באמת", topicId: "t1", failureRate: 0.8, attempts: 25 },
    ]);
    render(<AiReactorPanel />);

    expect(screen.getByText("שאלה קשה באמת")).toBeInTheDocument();
    expect(screen.queryByText("שאלה חד־פעמית")).not.toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("says so when nothing has enough data yet", () => {
    queryResults.set("aiEnabled", true);
    queryResults.set("usage", usage);
    queryResults.set("failures", [{ questionId: "q1", stem: "x", topicId: "t1", failureRate: 1, attempts: 2 }]);
    render(<AiReactorPanel />);

    expect(screen.getByText(/אין עדיין מספיק נסיונות/)).toBeInTheDocument();
  });
});
