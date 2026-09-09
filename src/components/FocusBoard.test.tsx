import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ComponentProps } from "react";
import FocusBoard, { type FocusTopic } from "./FocusBoard";
import { Id } from "../../convex/_generated/dataModel";

vi.mock("convex/react", () => ({
  useQuery: () => ({ goal: 10, answeredToday: 4, goalReached: false }),
}));
vi.mock("../../convex/_generated/api", () => ({
  api: { goals: { getDailyProgress: "getDailyProgress" } },
}));

const TOPICS: FocusTopic[] = [
  { id: "t1", nameHe: "משוואות", progress: 100, isCompleted: true, isActive: false },
  { id: "t2", nameHe: "פונקציות", progress: 40, isCompleted: false, isActive: true },
  { id: "t3", nameHe: "טריגונומטריה", progress: 0, isCompleted: false, isActive: false },
];

function renderBoard(overrides: Partial<ComponentProps<typeof FocusBoard>> = {}) {
  const onOpenTopic = vi.fn();
  render(
    <FocusBoard
      studentId={"s1" as Id<"students">}
      topics={TOPICS}
      reviewCount={0}
      onOpenTopic={onOpenTopic}
      onHomework={vi.fn()}
      onReview={vi.fn()}
      {...overrides}
    />,
  );
  return { onOpenTopic };
}

describe("FocusBoard", () => {
  it("leads with the topic in progress and starts it in one press", () => {
    const { onOpenTopic } = renderBoard();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("פונקציות");
    fireEvent.click(screen.getByRole("button", { name: /התחלת תרגול/ }));
    expect(onOpenTopic).toHaveBeenCalledWith("t2");
  });

  it("falls back to the first unfinished topic when none is active", () => {
    renderBoard({
      topics: TOPICS.map(t => ({ ...t, isActive: false })),
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("פונקציות");
  });

  it("shows today's progress as a single count", () => {
    renderBoard();
    expect(screen.getByText("4 / 10")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "שאלות שנפתרו היום" })).toHaveAttribute("aria-valuenow", "40");
  });

  it("lists every topic as a plain row", () => {
    renderBoard();
    for (const t of TOPICS) expect(screen.getByRole("button", { name: new RegExp(t.nameHe) })).toBeInTheDocument();
  });

  it("hides the review link until there is something to review", () => {
    renderBoard();
    expect(screen.queryByRole("button", { name: /חזרה על טעויות/ })).not.toBeInTheDocument();
  });

  it("offers the review link once mistakes are queued", () => {
    const onReview = vi.fn();
    renderBoard({ reviewCount: 3, onReview });
    fireEvent.click(screen.getByRole("button", { name: /חזרה על טעויות/ }));
    expect(onReview).toHaveBeenCalled();
  });
});
