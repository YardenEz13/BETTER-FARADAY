import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import FaradayTour, { type TourStep } from "./FaradayTour";

/**
 * Covers the multi-view stepping added for the teacher tour: each step may
 * switch the page to the view that owns its target (`onEnter`), so the target
 * mounts *late* and the tour has to wait for it, then optionally demo a click.
 */

// happy-dom reports 0x0 for every element, and the tour skips zero-width
// targets (that's how it picks the visible one of a desktop/mobile pair).
function stubRects() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 40, width: 100, height: 40,
    toJSON: () => ({}),
  } as DOMRect);
}

beforeEach(stubRects);
afterEach(() => vi.restoreAllMocks());

const next = () => fireEvent.click(screen.getByRole("button", { name: "הבא" }));

describe("FaradayTour multi-view stepping", () => {
  it("runs onEnter for each step as the tour advances", async () => {
    const entered: string[] = [];
    const steps: TourStep[] = [
      { key: "a", title: "A", body: "a", onEnter: () => entered.push("a") },
      { key: "b", title: "B", body: "b", onEnter: () => entered.push("b") },
    ];
    render(
      <>
        <div data-tour="a" />
        <div data-tour="b" />
        <FaradayTour open onClose={() => {}} steps={steps} />
      </>,
    );

    await waitFor(() => expect(entered).toContain("a"));
    expect(entered).not.toContain("b");

    next();
    await waitFor(() => expect(entered).toContain("b"));
    expect(await screen.findByText("B")).toBeInTheDocument();
  });

  it("waits for a target that mounts after its view switches in", async () => {
    const clicked = vi.fn();
    // Target is absent at first and only appears once onEnter flips the view.
    function LateTarget() {
      const [shown, setShown] = useState(false);
      const steps: TourStep[] = [{
        key: "late",
        title: "Late",
        body: "late",
        onEnter: () => setShown(true),
        clickOnArrive: '[data-tour="late"]',
      }];
      return (
        <>
          {shown && <div data-tour="late" onClick={clicked} />}
          <FaradayTour open onClose={() => {}} steps={steps} />
        </>
      );
    }
    render(<LateTarget />);

    // Only reachable if the tour kept polling until the element existed.
    await waitFor(() => expect(clicked).toHaveBeenCalled());
  });

  it("fires clickOnArrive once per step even when the effect re-runs", async () => {
    const clicked = vi.fn();
    // A parent that re-renders repeatedly, as the live dashboard does on every
    // Convex update — a naive implementation would re-click and toggle it shut.
    function Churn() {
      const [, setTick] = useState(0);
      useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 20);
        return () => clearInterval(id);
      }, []);
      const steps: TourStep[] = [
        { key: "x", title: "X", body: "x", clickOnArrive: '[data-tour="x"]' },
      ];
      return (
        <>
          <div data-tour="x" onClick={clicked} />
          <FaradayTour open onClose={() => {}} steps={steps} />
        </>
      );
    }
    render(<Churn />);

    await waitFor(() => expect(clicked).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 250)); // let several re-renders land
    expect(clicked).toHaveBeenCalledTimes(1);
  });
});
