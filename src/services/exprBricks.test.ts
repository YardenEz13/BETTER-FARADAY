import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetIds,
  bin,
  canCollapse,
  canMoveAcross,
  clear,
  collapse,
  collapsible,
  eq,
  fill,
  find,
  hasHole,
  group,
  hole,
  holes,
  isDone,
  kids,
  readySteps,
  moveAcross,
  num,
  pow,
  replace,
  root,
  text,
  value,
  variable,
  type Node,
} from "./exprBricks";

beforeEach(__resetIds);

/** Collapse every ready step, innermost first, until nothing is left. */
const solve = (tree: Node) => {
  const path = [text(tree)];
  for (let i = 0; i < 40; i++) {
    const ready = collapsible(tree);
    if (!ready.length) break;
    tree = collapse(tree, ready[0]);
    path.push(text(tree));
  }
  return { tree, path };
};

describe("building by filling holes", () => {
  it("drops a piece into a hole and leaves the rest alone", () => {
    const t = bin("+", hole(), num(3));
    const [firstHole] = holes(t);
    expect(text(fill(t, firstHole, num(5)))).toBe("5 + 3");
  });

  it("gives a dropped piece fresh ids, so one palette piece can be reused", () => {
    const piece = pow(hole(), num(2));
    let t: Node = bin("+", hole(), hole());
    const [h1, h2] = holes(t);
    t = fill(t, h1, piece);
    t = fill(t, h2, piece);
    // Every node in the tree must carry its own id, or React keys collide and
    // a drag lands on the wrong brick.
    const seen = new Set<string>();
    const walk = (n: Node) => {
      expect(seen.has(n.id)).toBe(false);
      seen.add(n.id);
      kids(n).forEach(walk);
    };
    walk(t);
    expect(text(t)).toBe("□^2 + □^2");
  });

  it("pulls a brick back out, leaving a hole", () => {
    const t = bin("+", num(5), num(3));
    const inner = (t as Extract<Node, { kind: "bin" }>).a;
    expect(find(t, inner.id)).not.toBeNull();
    expect(text(clear(t, inner.id))).toBe("□ + 3");
  });

  it("knows when it is still unfinished", () => {
    expect(hasHole(root(bin("+", num(1), hole())))).toBe(true);
    expect(hasHole(root(bin("+", num(1), num(2))))).toBe(false);
  });
});

describe("exact arithmetic", () => {
  it.each([
    ["5 + 3", bin("+", num(5), num(3)), "8"],
    ["12 − 5", bin("−", num(12), num(5)), "7"],
    ["6 × 7", bin("×", num(6), num(7)), "42"],
    ["12 ÷ 4", bin("÷", num(12), num(4)), "3"],
    ["5^2", pow(num(5), num(2)), "25"],
    ["√169", root(num(169)), "13"],
  ])("collapses %s", (_n, tree, expected) => {
    expect(text(collapse(tree, tree.id))).toBe(expected);
  });

  it("stays a fraction rather than going decimal", () => {
    const t = bin("÷", num(12), num(5));
    expect(text(collapse(t, t.id))).toBe("12/5");
  });

  it("refuses to turn an irrational root into a decimal", () => {
    const t = root(num(13));
    expect(value(t)).toBeNull();
    expect(canCollapse(t)).toBe(false);
    expect(text(collapse(t, t.id))).toBe("√13");
  });

  it("refuses division by zero", () => {
    expect(value(bin("÷", num(3), num(0)))).toBeNull();
  });

  it("will not collapse anything still holding a hole or a variable", () => {
    expect(canCollapse(bin("+", num(1), hole()))).toBe(false);
    expect(canCollapse(bin("+", num(1), variable("x")))).toBe(false);
  });
});

describe("solving a real question by collapsing", () => {
  // אורכי הניצבים 5 ס"מ ו-12 ס"מ. מהו אורך היתר?
  it("Pythagoras: √(5² + 12²) → 13", () => {
    const t = root(bin("+", pow(num(5), num(2)), pow(num(12), num(2))));
    const { tree, path } = solve(t);
    expect(path).toEqual([
      "√(5^2 + 12^2)",
      "√(25 + 12^2)",
      "√(25 + 144)",
      "√169",
      "13",
    ]);
    expect(text(tree)).toBe("13");
    expect(isDone(tree)).toBe(true);
  });

  // בסדרה חשבונית a₁=3, d=4. חשב את a₁₂  →  3 + (12−1)·4
  it("arithmetic sequence: 3 + (12 − 1) × 4 → 47", () => {
    const t = bin("+", num(3), bin("×", bin("−", num(12), num(1)), num(4)));
    expect(text(solve(t).tree)).toBe("47");
  });

  // במעוין, אלכסונים 6 ו-8. מהו השטח?  →  6·8 ÷ 2
  it("rhombus area: 6 × 8 ÷ 2 → 24", () => {
    const t = bin("÷", bin("×", num(6), num(8)), num(2));
    expect(text(solve(t).tree)).toBe("24");
  });

  it("collapses innermost first, so each line is one readable step", () => {
    const t = bin("+", pow(num(2), num(3)), pow(num(3), num(2)));
    expect(solve(t).path).toEqual(["2^3 + 3^2", "8 + 3^2", "8 + 9", "17"]);
  });
});

describe("readySteps offers only the innermost move", () => {
  // √(5² + 12²) is collapsible as a whole — every leaf is a number — and
  // offering that would let one tap jump straight to 13. That is a
  // calculator, not a worked solution.
  it("does not offer the outer root while the squares are still there", () => {
    const t = root(bin("+", pow(num(5), num(2)), pow(num(12), num(2))));
    const ready = readySteps(t);
    expect(ready).toHaveLength(2);
    expect(ready).not.toContain(t.id);
  });

  it("walks in one step at a time to the answer", () => {
    let t: Node = root(bin("+", pow(num(5), num(2)), pow(num(12), num(2))));
    const path: string[] = [];
    for (let i = 0; i < 10; i++) {
      const ready = readySteps(t);
      if (!ready.length) break;
      expect(ready.length).toBeLessThanOrEqual(2);
      t = collapse(t, ready[0]);
      path.push(text(t));
    }
    expect(path).toEqual(["√(25 + 12^2)", "√(25 + 144)", "√169", "13"]);
  });
});

describe("precedence in the printed form", () => {
  it("parenthesises a sum inside a product", () => {
    expect(text(bin("×", bin("+", num(1), num(2)), num(3)))).toBe("(1 + 2) × 3");
  });

  it("leaves a product inside a sum bare", () => {
    expect(text(bin("+", bin("×", num(1), num(2)), num(3)))).toBe("1 × 2 + 3");
  });

  it("keeps the right operand of a subtraction grouped", () => {
    expect(text(bin("−", num(9), bin("−", num(5), num(1))))).toBe("9 − (5 − 1)");
  });
});

describe("moving across the equals sign", () => {
  it("is offered only for a direct addend of a side", () => {
    const t = eq(bin("+", bin("×", num(3), variable("x")), num(7)), num(31));
    const side = (t as Extract<Node, { kind: "eq" }>).left as Extract<Node, { kind: "bin" }>;
    expect(canMoveAcross(t, side.b.id)).toBe(true); // the 7
    const product = side.a as Extract<Node, { kind: "bin" }>;
    expect(canMoveAcross(t, product.a.id)).toBe(false); // the 3, nested inside ×
  });

  it("flips a plus into a minus on arrival", () => {
    const t = eq(bin("+", variable("x"), num(7)), num(31));
    const side = (t as Extract<Node, { kind: "eq" }>).left as Extract<Node, { kind: "bin" }>;
    const moved = moveAcross(t, side.b.id);
    expect(text(moved)).toBe("x = 31 − 7");
    expect(text(solve(moved).tree)).toBe("x = 24");
  });

  it("flips a minus into a plus on arrival", () => {
    const t = eq(bin("−", variable("x"), num(8)), num(6));
    const side = (t as Extract<Node, { kind: "eq" }>).left as Extract<Node, { kind: "bin" }>;
    expect(text(moveAcross(t, side.b.id))).toBe("x = 6 + 8");
  });

  it("does nothing when the board is not an equation", () => {
    const t = bin("+", num(1), num(2));
    expect(text(moveAcross(t, t.id))).toBe("1 + 2");
  });
});

describe("wrapping something already built", () => {
  /** What ExprBoard does when a palette piece lands on a filled brick. */
  const wrap = (tree: Node, targetId: string, piece: Node) => {
    const target = find(tree, targetId)!;
    const [socket] = holes(piece);
    return replace(tree, targetId, replace(piece, socket, target));
  };

  /** 10 ÷ 7, collapsed to the single brick `10/7`. */
  const tenSevenths = () => {
    const t = bin("÷", num(10), num(7));
    return collapse(t, t.id);
  };

  // The board could only grow into holes that already existed, so once 10 ÷ 7
  // had collapsed to one brick there was no way to reach 10/7 + 3 — the only
  // way forward was to clear the board and start over.
  it("adds to a collapsed fraction", () => {
    const frac = tenSevenths();
    expect(text(frac)).toBe("10/7");

    const plus = wrap(frac, frac.id, bin("+"));
    expect(text(plus)).toBe("10/7 + □");

    const [socket] = holes(plus);
    expect(text(fill(plus, socket, num(3)))).toBe("10/7 + 3");
  });

  it.each([
    ["a root", () => root(), "√(10/7)"],
    ["a square", () => pow(hole(), num(2)), "(10/7)^2"],
    ["parentheses", () => group(), "(10/7)"],
    ["a subtraction", () => bin("−"), "10/7 − □"],
    ["an equals", () => eq(), "10/7 = □"],
  ])("wraps it in %s", (_name, piece, expected) => {
    const frac = tenSevenths();
    expect(text(wrap(frac, frac.id, piece()))).toBe(expected);
  });

  it("wraps a brick nested deep inside, not just the whole board", () => {
    const t = root(bin("+", num(5), num(9)));
    const five = ((t as Extract<Node, { kind: "root" }>).of as Extract<Node, { kind: "bin" }>).a;
    expect(text(wrap(t, five.id, pow(hole(), num(2))))).toBe("√(5^2 + 9)");
  });

  it("keeps the wrapped subtree's own identity", () => {
    const t = bin("+", num(5), num(9));
    const five = (t as Extract<Node, { kind: "bin" }>).a;
    expect(find(wrap(t, five.id, root()), five.id)).not.toBeNull();
  });

  it("parenthesises a fraction under a root, which would otherwise be ambiguous", () => {
    expect(text(root(num(10, 7)))).toBe("√(10/7)");
    expect(text(bin("+", num(10, 7), num(3)))).toBe("10/7 + 3");
  });
});
