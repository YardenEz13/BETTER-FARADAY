import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";

/**
 * The two milestone triggers are fire-once transitions, and both fail silently
 * in the annoying direction — congratulating a student who did nothing. These
 * mirror the guard logic in StudentHomework and StudentHome.
 */

/** StudentHomework: fires only on the transition into a fully-submitted set. */
function useHomeworkDone(submitted: number, total: number) {
  const [shown, setShown] = useState(false);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (total === 0) return;
    const before = prev.current;
    prev.current = submitted;
    if (before !== null && before < total && submitted === total) setShown(true);
  }, [submitted, total]);
  return shown;
}

/** StudentHome: fires only when the stored level is beaten. */
function useLevelUp(level: number | undefined, studentId: string) {
  const [up, setUp] = useState<number | null>(null);
  useEffect(() => {
    if (typeof level !== "number") return;
    const key = `faraday:level:${studentId}`;
    const seen = Number(localStorage.getItem(key) ?? 0);
    localStorage.setItem(key, String(level));
    if (seen > 0 && level > seen) setUp(level);
  }, [level, studentId]);
  return up;
}

function HomeworkProbe({ submitted, total }: { submitted: number; total: number }) {
  return <span>{useHomeworkDone(submitted, total) ? "celebrate" : "quiet"}</span>;
}

function LevelProbe({ level }: { level?: number }) {
  return <span>{useLevelUp(level, "s1") ?? "quiet"}</span>;
}

describe("homework completion trigger", () => {
  it("stays quiet when reopening an already-finished assignment", () => {
    render(<HomeworkProbe submitted={4} total={4} />);
    expect(screen.getByText("quiet")).toBeTruthy();
  });

  it("fires on the last submission", () => {
    const { rerender } = render(<HomeworkProbe submitted={3} total={4} />);
    expect(screen.getByText("quiet")).toBeTruthy();
    act(() => rerender(<HomeworkProbe submitted={4} total={4} />));
    expect(screen.getByText("celebrate")).toBeTruthy();
  });

  it("stays quiet while work is still in progress", () => {
    const { rerender } = render(<HomeworkProbe submitted={1} total={4} />);
    act(() => rerender(<HomeworkProbe submitted={2} total={4} />));
    expect(screen.getByText("quiet")).toBeTruthy();
  });
});

describe("level-up trigger", () => {
  beforeEach(() => localStorage.clear());

  it("records a baseline on first visit without celebrating", () => {
    render(<LevelProbe level={3} />);
    expect(screen.getByText("quiet")).toBeTruthy();
    expect(localStorage.getItem("faraday:level:s1")).toBe("3");
  });

  it("celebrates a promotion that happened while the student was away", () => {
    localStorage.setItem("faraday:level:s1", "2");
    render(<LevelProbe level={3} />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("does not celebrate the same level twice", () => {
    localStorage.setItem("faraday:level:s1", "3");
    render(<LevelProbe level={3} />);
    expect(screen.getByText("quiet")).toBeTruthy();
  });
});
