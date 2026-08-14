import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetIds,
  canDivideOut,
  collect,
  divideOut,
  eqText,
  equation,
  isSolved,
  moveAcross,
  rat,
  ratText,
  sampleEquation,
  term,
  termText,
  type Equation,
} from "./algebraBricks";

beforeEach(__resetIds);

/** 3x + 7 = 31 */
const twoStep = (): Equation =>
  equation([term(rat(3), 1), term(rat(7))], [term(rat(31))]);

/** Grab the brick showing `text` on `side`. */
const brick = (eq: Equation, side: "L" | "R", text: string) => {
  const found = eq[side].find((t, i) => termText(t, i === 0) === text);
  if (!found) throw new Error(`no brick "${text}" in ${eqText(eq)}`);
  return found.id;
};

describe("rationals", () => {
  it("reduces and keeps the sign on the numerator", () => {
    expect(rat(6, 4)).toEqual({ n: 3, d: 2 });
    expect(rat(3, -4)).toEqual({ n: -3, d: 4 });
    expect(rat(-6, -4)).toEqual({ n: 3, d: 2 });
  });

  it("prints with a Unicode minus", () => {
    expect(ratText(rat(-3))).toBe("−3");
    expect(ratText(rat(12, 5))).toBe("12/5");
  });
});

describe("moveAcross", () => {
  it("flips the sign and lands on the other side", () => {
    const eq = twoStep();
    expect(eqText(moveAcross(eq, "L", brick(eq, "L", "+7")))).toBe("3x = 24");
  });

  // Dragging a brick back is NOT an undo, and must not pretend to be: once the
  // 31 and the −7 have merged into a 24, that 24 is the only brick there is,
  // and sending it back gives `3x − 24 = 0`. Still a true equation with the
  // same solution — just not the one they started from. Undo is a button.
  it("stays a true equation when a merged brick is sent back", () => {
    const eq = twoStep();
    const once = moveAcross(eq, "L", brick(eq, "L", "+7"));
    expect(eqText(once)).toBe("3x = 24");
    const back = moveAcross(once, "R", brick(once, "R", "24"));
    expect(eqText(back)).toBe("3x − 24 = 0");
  });

  it("round-trips exactly when the brick has nothing to merge with", () => {
    // 3x + 7 = 2x — the 7 lands beside a 2x, so no merge happens either way.
    const eq = equation([term(rat(3), 1), term(rat(7))], [term(rat(2), 1)]);
    const once = moveAcross(eq, "L", brick(eq, "L", "+7"));
    expect(eqText(once)).toBe("3x = 2x − 7");
    const back = moveAcross(once, "R", brick(once, "R", "−7"));
    expect(eqText(back)).toBe("3x + 7 = 2x");
  });

  it("collects x onto one side", () => {
    // 6x + 5 = 2x + 29
    const eq = equation(
      [term(rat(6), 1), term(rat(5))],
      [term(rat(2), 1), term(rat(29))],
    );
    expect(eqText(moveAcross(eq, "R", brick(eq, "R", "2x")))).toBe("4x + 5 = 29");
  });

  it("leaves a 0 brick behind rather than an empty side", () => {
    const eq = equation([term(rat(4))], [term(rat(4))]);
    expect(eqText(moveAcross(eq, "L", brick(eq, "L", "4")))).toBe("0 = 0");
  });

  it("ignores an id that is not on that side", () => {
    const eq = twoStep();
    expect(eqText(moveAcross(eq, "R", "nope"))).toBe(eqText(eq));
  });
});

describe("divideOut", () => {
  it("is only offered once the term is alone", () => {
    const eq = twoStep();
    expect(canDivideOut(eq, "L", brick(eq, "L", "3x"))).toBe(false);
    const alone = moveAcross(eq, "L", brick(eq, "L", "+7"));
    expect(canDivideOut(alone, "L", brick(alone, "L", "3x"))).toBe(true);
  });

  it("is not offered when the coefficient is already 1", () => {
    const eq = equation([term(rat(1), 1)], [term(rat(8))]);
    expect(canDivideOut(eq, "L", brick(eq, "L", "x"))).toBe(false);
  });

  it("finishes the solve", () => {
    const start = twoStep();
    const eq = moveAcross(start, "L", brick(start, "L", "+7"));
    const done = divideOut(eq, "L", brick(eq, "L", "3x"));
    expect(eqText(done)).toBe("x = 8");
    expect(isSolved(done)).toBe(true);
  });

  it("stays exact instead of going decimal", () => {
    const eq = equation([term(rat(5), 1)], [term(rat(12))]);
    expect(eqText(divideOut(eq, "L", brick(eq, "L", "5x")))).toBe("x = 12/5");
  });

  it("handles a negative coefficient", () => {
    const eq = equation([term(rat(-3), 1)], [term(rat(12))]);
    expect(eqText(divideOut(eq, "L", brick(eq, "L", "−3x")))).toBe("x = −4");
  });

  it("does nothing when the gesture is not available", () => {
    const eq = twoStep();
    expect(eqText(divideOut(eq, "L", brick(eq, "L", "3x")))).toBe("3x + 7 = 31");
  });
});

describe("a whole solve, by dragging only", () => {
  it("3x + 7 = 31 in two gestures", () => {
    let eq = twoStep();
    const path = [eqText(eq)];
    eq = moveAcross(eq, "L", brick(eq, "L", "+7"));
    path.push(eqText(eq));
    eq = divideOut(eq, "L", brick(eq, "L", "3x"));
    path.push(eqText(eq));
    expect(path).toEqual(["3x + 7 = 31", "3x = 24", "x = 8"]);
    expect(isSolved(eq)).toBe(true);
  });

  it("6x + 5 = 2x + 29 in three", () => {
    let eq = equation([term(rat(6), 1), term(rat(5))], [term(rat(2), 1), term(rat(29))]);
    eq = moveAcross(eq, "R", brick(eq, "R", "2x"));
    eq = moveAcross(eq, "L", brick(eq, "L", "+5"));
    eq = divideOut(eq, "L", brick(eq, "L", "4x"));
    expect(eqText(eq)).toBe("x = 6");
  });
});

describe("presentation", () => {
  it("writes the leading term without a plus", () => {
    expect(termText(term(rat(3), 1), true)).toBe("3x");
    expect(termText(term(rat(3), 1), false)).toBe("+3x");
    expect(termText(term(rat(-3), 1), true)).toBe("−3x");
  });

  it("never writes a coefficient of 1 in front of x", () => {
    expect(termText(term(rat(1), 1), true)).toBe("x");
    expect(termText(term(rat(-1), 1), true)).toBe("−x");
    expect(termText(term(rat(1)), true)).toBe("1");
  });

  it("writes powers as superscripts", () => {
    expect(termText(term(rat(2), 2), true)).toBe("2x²");
    expect(termText(term(rat(1), 3), true)).toBe("x³");
  });
});

describe("collect", () => {
  it("merges like powers and orders high power first", () => {
    const side = collect([term(rat(2)), term(rat(3), 2), term(rat(5)), term(rat(1), 1)]);
    expect(side.map((t, i) => termText(t, i === 0))).toEqual(["3x²", "+x", "+7"]);
  });
});

describe("sampleEquation", () => {
  const rng = () => {
    let seed = 987654321;
    return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  };

  it("always deals something solvable in two gestures with a whole answer", () => {
    const r = rng();
    for (let i = 0; i < 200; i++) {
      let eq = sampleEquation(r);
      expect(isSolved(eq)).toBe(false);
      eq = moveAcross(eq, "L", eq.L[1].id); // the constant
      eq = divideOut(eq, "L", eq.L[0].id); // the coefficient
      expect(isSolved(eq)).toBe(true);
      expect(eq.R[0].c.d).toBe(1); // whole answer, no fraction
    }
  });
});
