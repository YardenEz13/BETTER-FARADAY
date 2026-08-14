// ── Expression bricks ────────────────────────────────────────────────────
//
// A drag-built expression tree. Pieces come out of a palette with holes in
// them — `√□`, `□²`, `□ + □` — and every hole is a drop target. Fill the holes
// and you have built the question; collapse the arithmetic and you have solved
// it. Nothing is typed and nothing is chosen from a menu.
//
// Why a tree and not the flat term list in `algebraBricks`: the questions in
// this bank are formula substitutions, not equations to rearrange —
//
//     אורכי הניצבים 5 ס"מ ו-12 ס"מ. מהו אורך היתר?   →   √(5² + 12²)
//     בסדרה חשבונית a₁=3, d=4. חשב את a₁₂          →   3 + (12−1)·4
//
// — and those nest. A student needs to put a 5 *inside* a square *inside* a
// root, which a list of terms cannot express.
//
// All arithmetic is exact rationals. A root that is not a whole number stays
// as a root rather than turning into 3.605551275463989.

import { rat, ratAdd, ratMul, ratDiv, ratIsZero, ratText, type Rat } from "./algebraBricks";

export type BinOp = "+" | "−" | "×" | "÷";

export type Node =
  /** An empty slot. The only thing a palette piece can be dropped into. */
  | { kind: "hole"; id: string }
  | { kind: "num"; id: string; value: Rat }
  | { kind: "var"; id: string; name: string }
  | { kind: "bin"; id: string; op: BinOp; a: Node; b: Node }
  | { kind: "pow"; id: string; base: Node; exp: Node }
  | { kind: "root"; id: string; of: Node }
  /** Parentheses the student placed themselves — kept so the board reads back
   *  the way they built it, not the way a normaliser would rewrite it. */
  | { kind: "group"; id: string; of: Node }
  | { kind: "eq"; id: string; left: Node; right: Node };

let seq = 0;
const nid = () => `n${++seq}`;
/** Tests only — ids are otherwise opaque. */
export const __resetIds = () => {
  seq = 0;
};

export const hole = (): Node => ({ kind: "hole", id: nid() });
export const num = (n: number, d = 1): Node => ({ kind: "num", id: nid(), value: rat(n, d) });
export const variable = (name: string): Node => ({ kind: "var", id: nid(), name });
export const bin = (op: BinOp, a: Node = hole(), b: Node = hole()): Node => ({ kind: "bin", id: nid(), op, a, b });
export const pow = (base: Node = hole(), exp: Node = hole()): Node => ({ kind: "pow", id: nid(), base, exp });
export const root = (of: Node = hole()): Node => ({ kind: "root", id: nid(), of });
export const group = (of: Node = hole()): Node => ({ kind: "group", id: nid(), of });
export const eq = (left: Node = hole(), right: Node = hole()): Node => ({ kind: "eq", id: nid(), left, right });

/* ─────────────────────────────── walking ─────────────────────────────── */

/** Direct children, in reading order. */
export function kids(n: Node): Node[] {
  switch (n.kind) {
    case "bin": return [n.a, n.b];
    case "pow": return [n.base, n.exp];
    case "root":
    case "group": return [n.of];
    case "eq": return [n.left, n.right];
    default: return [];
  }
}

/** Rebuild a node from replacement children, preserving its id. */
function withKids(n: Node, k: Node[]): Node {
  switch (n.kind) {
    case "bin": return { ...n, a: k[0], b: k[1] };
    case "pow": return { ...n, base: k[0], exp: k[1] };
    case "root": return { ...n, of: k[0] };
    case "group": return { ...n, of: k[0] };
    case "eq": return { ...n, left: k[0], right: k[1] };
    default: return n;
  }
}

/** Replace the node with `id` by `next`. Returns a new tree. */
export function replace(tree: Node, id: string, next: Node): Node {
  if (tree.id === id) return next;
  const k = kids(tree);
  if (!k.length) return tree;
  return withKids(tree, k.map((c) => replace(c, id, next)));
}

export function find(tree: Node, id: string): Node | null {
  if (tree.id === id) return tree;
  for (const c of kids(tree)) {
    const hit = find(c, id);
    if (hit) return hit;
  }
  return null;
}

/** The node whose child has `id`, or null at the root. */
export function parentOf(tree: Node, id: string): Node | null {
  for (const c of kids(tree)) {
    if (c.id === id) return tree;
    const deeper = parentOf(c, id);
    if (deeper) return deeper;
  }
  return null;
}

export const hasHole = (n: Node): boolean =>
  n.kind === "hole" || kids(n).some(hasHole);

/** Every hole, in reading order — used to focus the next one to fill. */
export function holes(n: Node): string[] {
  if (n.kind === "hole") return [n.id];
  return kids(n).flatMap(holes);
}

/* ───────────────────────────── building it ───────────────────────────── */

/**
 * Drop a palette piece into a hole. Fresh ids on the way in, so the same
 * palette piece can be dropped over and over without two bricks sharing an id.
 */
export function fill(tree: Node, holeId: string, piece: Node): Node {
  return replace(tree, holeId, clone(piece));
}

/** A structural copy with new ids. */
export function clone(n: Node): Node {
  const copy = { ...n, id: nid() } as Node;
  const k = kids(n);
  return k.length ? withKids(copy, k.map(clone)) : copy;
}

/** Pull a brick back out, leaving the hole it came from. */
export const clear = (tree: Node, id: string): Node => replace(tree, id, hole());

/* ──────────────────────────── collapsing it ──────────────────────────── */

/** The exact value of a node, or null when it isn't fully numeric yet. */
export function value(n: Node): Rat | null {
  switch (n.kind) {
    case "num": return n.value;
    case "group": return value(n.of);
    case "bin": {
      const a = value(n.a);
      const b = value(n.b);
      if (!a || !b) return null;
      switch (n.op) {
        case "+": return ratAdd(a, b);
        case "−": return ratAdd(a, { n: -b.n, d: b.d });
        case "×": return ratMul(a, b);
        case "÷": return ratIsZero(b) ? null : ratDiv(a, b);
      }
      return null;
    }
    case "pow": {
      const b = value(n.base);
      const e = value(n.exp);
      // Only whole, non-negative exponents: anything else is not a step a
      // student would take in their head, so it stays unevaluated.
      if (!b || !e || e.d !== 1 || e.n < 0 || e.n > 12) return null;
      let out = rat(1);
      for (let i = 0; i < e.n; i++) out = ratMul(out, b);
      return out;
    }
    case "root": {
      const v = value(n.of);
      if (!v || v.n < 0) return null;
      const rn = Math.sqrt(v.n);
      const rd = Math.sqrt(v.d);
      // Irrational roots stay as roots. Turning √13 into 3.6055 is the moment
      // the board stops being maths and starts being a calculator.
      if (!Number.isInteger(rn) || !Number.isInteger(rd)) return null;
      return rat(rn, rd);
    }
    default: return null;
  }
}

/**
 * Can this node take one step right now? True when it is an operation whose
 * operands are already numbers — the innermost thing a student would do next.
 */
export function canCollapse(n: Node): boolean {
  if (n.kind === "num" || n.kind === "hole" || n.kind === "var" || n.kind === "eq") return false;
  if (n.kind === "group") return n.of.kind === "num";
  return kids(n).every((c) => value(c) !== null) && value(n) !== null;
}

/** Collapse one node to its value. */
export function collapse(tree: Node, id: string): Node {
  const target = find(tree, id);
  if (!target || !canCollapse(target)) return tree;
  const v = value(target);
  if (!v) return tree;
  return replace(tree, id, { kind: "num", id: nid(), value: v });
}

/** Ids of every node that could be collapsed right now, innermost first. */
export function collapsible(tree: Node): string[] {
  const out: string[] = [];
  const walk = (n: Node) => {
    kids(n).forEach(walk);
    if (canCollapse(n)) out.push(n.id);
  };
  walk(tree);
  return out;
}

/**
 * The steps actually on offer: only the *innermost* collapsible nodes.
 *
 * `√(5² + 12²)` is technically collapsible as a whole — every leaf is a
 * number — and offering that would let one tap jump straight to 13, which is
 * a calculator, not a worked solution. Restricting to innermost forces the
 * order a student would write: 5²→25, 12²→144, 25+144→169, √169→13.
 */
export function readySteps(tree: Node): string[] {
  const ready = collapsible(tree);
  const inner = new Set(ready);
  const hasReadyDescendant = (n: Node): boolean =>
    kids(n).some((c) => inner.has(c.id) || hasReadyDescendant(c));
  return ready.filter((id) => {
    const n = find(tree, id);
    return n ? !hasReadyDescendant(n) : false;
  });
}

/** Nothing left to do: a bare number, or an equation with a bare number side. */
export const isDone = (n: Node): boolean =>
  !hasHole(n) && collapsible(n).length === 0;

/* ─────────────────────────── moving across = ─────────────────────────── */

/**
 * Send an addend across the equals sign. Only offered for a direct `+`/`−`
 * operand of one side, which is the case a student can read at a glance —
 * anything deeper needs the parentheses opened first, and silently doing that
 * for them is how a board stops being trustworthy.
 */
export function canMoveAcross(tree: Node, id: string): boolean {
  if (tree.kind !== "eq") return false;
  const parent = parentOf(tree, id);
  if (!parent || parent.kind !== "bin" || (parent.op !== "+" && parent.op !== "−")) return false;
  // The parent must itself be a whole side of the equation.
  return tree.left.id === parent.id || tree.right.id === parent.id;
}

export function moveAcross(tree: Node, id: string): Node {
  if (tree.kind !== "eq" || !canMoveAcross(tree, id)) return tree;
  const parent = parentOf(tree, id) as Extract<Node, { kind: "bin" }>;
  const moving = find(tree, id)!;
  const staying = parent.a.id === id ? parent.b : parent.a;
  // `a − b` moving b: it arrives as `+ b`. Everything else flips to minus.
  const arrivingOp: BinOp = parent.op === "+" ? "−" : parent.a.id === id ? "−" : "+";
  const onLeft = tree.left.id === parent.id;
  const other = onLeft ? tree.right : tree.left;
  const merged: Node = { kind: "bin", id: nid(), op: arrivingOp, a: other, b: moving };
  return onLeft
    ? { ...tree, left: staying, right: merged }
    : { ...tree, left: merged, right: staying };
}

/* ────────────────────────────── reading it ───────────────────────────── */

const PRECEDENCE: Record<BinOp, number> = { "+": 1, "−": 1, "×": 2, "÷": 2 };

/** Plain text, for the step log and the tests. */
export function text(n: Node, parentPrec = 0): string {
  switch (n.kind) {
    case "hole": return "□";
    case "num":
      // A fraction is a division wearing a compact coat, so it needs the same
      // guard: `√10/7` could be read as (√10)/7, which is a different number.
      return n.value.d !== 1 && parentPrec >= 3 ? `(${ratText(n.value)})` : ratText(n.value);
    case "var": return n.name;
    case "group": return `(${text(n.of)})`;
    case "root": return `√${text(n.of, 3)}`;
    case "pow": return `${text(n.base, 3)}^${text(n.exp, 3)}`;
    case "eq": return `${text(n.left)} = ${text(n.right)}`;
    case "bin": {
      const p = PRECEDENCE[n.op];
      const body = `${text(n.a, p)} ${n.op} ${text(n.b, p + 1)}`;
      return p < parentPrec ? `(${body})` : body;
    }
  }
}
