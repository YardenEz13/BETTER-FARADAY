import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useEffect, useState } from "react";
import FaradayReaction from "./FaradayReaction";

/**
 * Regression: the bubble never auto-dismissed in PracticeSession.
 *
 * That screen re-renders once a second for its elapsed-time clock, and it
 * passes `onDone` as an inline arrow — a fresh identity every render. With
 * `onDone` in the dismiss effect's dep list, the 3s timer was torn down and
 * restarted every second and could never fire.
 *
 * The harness below reproduces exactly that: a parent that ticks while the
 * reaction is up. A test that simply renders once will pass either way, which
 * is why the bug survived a lab full of manual checks.
 */
function TickingParent({ intervalMs }: { intervalMs: number }) {
  const [visible, setVisible] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);

  return (
    <>
      <span>{visible ? "up" : "dismissed"}</span>
      {/* inline arrow, exactly as the real screens pass it */}
      <FaradayReaction kind="correct" visible={visible} onDone={() => setVisible(false)} />
    </>
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * Advance in slices, each in its own act(), so React actually commits and
 * re-runs effects between ticks. One big advanceTimersByTime batches the
 * parent's state updates into a single late render, so the dismiss timer never
 * gets the chance to be reset — and the bug hides.
 */
function tick(times: number, ms: number) {
  for (let i = 0; i < times; i++) act(() => { vi.advanceTimersByTime(ms); });
}

describe("reaction auto-dismiss", () => {
  it("dismisses even while the parent re-renders every second", () => {
    render(<TickingParent intervalMs={1000} />);
    expect(screen.getByText("up")).toBeTruthy();
    tick(4, 1000);
    expect(screen.getByText("dismissed")).toBeTruthy();
  });

  it("dismisses under a parent that re-renders far faster than the timer", () => {
    render(<TickingParent intervalMs={50} />);
    tick(70, 50);
    expect(screen.getByText("dismissed")).toBeTruthy();
  });

  it("still waits the full beat before dismissing", () => {
    render(<TickingParent intervalMs={1000} />);
    tick(2, 1000);
    expect(screen.getByText("up")).toBeTruthy();
  });
});
