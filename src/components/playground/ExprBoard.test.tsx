import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import ExprBoard from "./ExprBoard";

afterEach(cleanup);

/**
 * These cover the gesture plumbing, which unit tests on the expression model
 * cannot reach. Both bugs they pin were reported from the real app after the
 * model tests were passing:
 *
 *   · a tap aimed at a socket acted on the brick containing it, because the
 *     press bubbled and every ancestor node opened a drag session
 *   · which then refused a digit — "only an operation goes here" — since the
 *     piece had landed on a filled node rather than the empty socket
 */

/**
 * A press and release with no movement in between: a tap.
 *
 * Each event gets its own `act`, which matters more than it looks. Batched into
 * one block, React never re-renders between pointerup and click, so a handler
 * on the later event still sees the state the earlier one replaced — and a
 * mis-targeted tap gets silently corrected by the stale value. The browser
 * renders in between; the test has to as well or it cannot see the bug.
 */
function tap(el: Element) {
  const r = el.getBoundingClientRect();
  const at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  const fire = (e: Event) => act(() => { el.dispatchEvent(e); });
  fire(new PointerEvent("pointerdown", { pointerId: 1, bubbles: true, ...at }));
  fire(new PointerEvent("pointerup", { pointerId: 1, bubbles: true, ...at }));
  fire(new MouseEvent("click", { bubbles: true }));
}

const piece = (label: string) =>
  [...document.querySelectorAll(".xb-piece")].find((p) => p.textContent?.trim() === label)!;
const sockets = () => [...document.querySelectorAll(".xb-hole")];
const boardText = () => document.querySelector(".xb-board")!.textContent!.replace(/\s+/g, "");
const hint = () => document.querySelector(".brick-hint")!.textContent!.trim();

/** Tap a palette piece, then tap where it should go. */
function place(label: string, target: Element) {
  tap(piece(label));
  tap(target);
}

describe("ExprBoard gestures", () => {
  it("builds by tapping, piece then destination", () => {
    render(<ExprBoard />);
    place("□+□", sockets()[0]);
    expect(boardText()).toBe("□+□");
    place("4", sockets()[0]);
    place("5", sockets()[0]);
    expect(boardText()).toBe("4+5");
  });

  it("puts a number in the socket that was tapped, not the brick around it", () => {
    render(<ExprBoard />);
    place("√□", sockets()[0]);
    place("□+□", sockets()[0]);
    expect(sockets()).toHaveLength(2);

    // The two sockets sit inside the root brick. Aiming at one must not be
    // answered by the root — that is the "big square gets touched" report.
    place("5", sockets()[0]);
    expect(boardText()).toBe("√5+□");
    expect(hint()).not.toMatch(/אי אפשר|רק לריבוע ריק/);
  });

  it("wraps the innermost brick, not the whole board", () => {
    render(<ExprBoard />);
    place("□+□", sockets()[0]);
    place("5", sockets()[0]);
    place("9", sockets()[0]);
    expect(boardText()).toBe("5+9");

    const five = [...document.querySelectorAll(".xb-node--leaf")].find(
      (n) => n.textContent?.trim() === "5",
    )!;
    place("□²", five);
    expect(boardText()).toBe("52+9"); // 5² + 9, superscript stripped by textContent
  });

  it("shows the piece as held, and puts it back when tapped again", () => {
    render(<ExprBoard />);
    tap(piece("7"));
    expect(document.querySelector(".xb-piece--held")).not.toBeNull();
    expect(hint()).toContain("ביד");
    tap(piece("7"));
    expect(document.querySelector(".xb-piece--held")).toBeNull();
  });

  it("says why a digit cannot join a fraction instead of doing nothing", () => {
    render(<ExprBoard />);
    place("□÷□", sockets()[0]);
    place("1", sockets()[0]);
    place("7", sockets()[0]);
    expect(boardText()).toBe("1÷7");

    tap(document.querySelector(".xb-node--ready")!);
    expect(boardText()).toBe("1/7");

    const frac = document.querySelector(".xb-node--leaf")!;
    place("3", frac);
    expect(boardText()).toBe("1/7"); // unchanged
    expect(hint()).toMatch(/אי אפשר להוסיף ספרה/);
  });

  it("collapses a ready brick on tap when nothing is held", () => {
    render(<ExprBoard />);
    place("□+□", sockets()[0]);
    place("6", sockets()[0]);
    place("9", sockets()[0]);
    tap(document.querySelector(".xb-node--ready")!);
    expect(boardText()).toBe("15");
    expect(screen.getByText(/אין יותר מה לחשב/)).toBeTruthy();
  });
});
