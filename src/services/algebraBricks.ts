// ── The brick algebra ────────────────────────────────────────────────────
//
// The board IS the lego: every term of the equation is a brick the student can
// pick up. There are no operation buttons and nothing to type. Two gestures
// carry the whole model, and both are the same idea — *cross the equals sign
// and you invert*:
//
//     3x + 7 = 31     drag [+7] across   →   3x = 24
//     3x = 24         drag [3] across    →   x  = 8
//
// Everything is exact. Coefficients are rationals, never floats: a student who
// drags the 5 out of `5x = 12` should read `x = 12/5`, not `x = 2.4`, and
// certainly not `2.4000000000000004`.
//
// Deliberately narrow: a side is a sum of `c·x^p` terms. That covers the
// linear and quadratic work these students actually grind on a phone. Roots,
// trig and logs have no brick representation and are not pretended at.

/* ─────────────────────────────── rationals ───────────────────────────── */

/** A rational in lowest terms. `d` is always positive. */
export interface Rat {
  n: number;
  d: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function rat(n: number, d = 1): Rat {
  if (d === 0) throw new Error("rational with zero denominator");
  const s = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: (s * n) / g, d: (s * d) / g };
}

export const ratAdd = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const ratMul = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d);
export const ratDiv = (a: Rat, b: Rat): Rat => rat(a.n * b.d, a.d * b.n);
export const ratNeg = (a: Rat): Rat => ({ n: -a.n, d: a.d });
export const ratIsZero = (a: Rat): boolean => a.n === 0;
export const ratIsOne = (a: Rat): boolean => a.n === 1 && a.d === 1;
export const ratEq = (a: Rat, b: Rat): boolean => a.n === b.n && a.d === b.d;

/** "3", "−3", "3/4". Uses the Unicode minus, which is what the bricks show. */
export function ratText(a: Rat): string {
  const sign = a.n < 0 ? "−" : "";
  const mag = Math.abs(a.n);
  return a.d === 1 ? `${sign}${mag}` : `${sign}${mag}/${a.d}`;
}

/* ───────────────────────────────── terms ─────────────────────────────── */

/** One brick: `c · x^pow`. `pow: 0` is a plain number. */
export interface Term {
  /** Stable across moves so React keys — and the drag in flight — survive. */
  id: string;
  c: Rat;
  pow: number;
}

export type SideName = "L" | "R";

export interface Equation {
  L: Term[];
  R: Term[];
}

let nextId = 0;
export const term = (c: Rat, pow = 0): Term => ({ id: `t${++nextId}`, c, pow });

/** Reset the id counter. Tests only — ids are otherwise opaque. */
export function __resetIds(): void {
  nextId = 0;
}

/**
 * Merge like powers, drop zeroes, and order high power first — the way an
 * equation is written. A side that cancels to nothing becomes a single `0`
 * brick rather than an empty gap, so there is always something to read.
 */
export function collect(side: Term[]): Term[] {
  const byPow = new Map<number, Term>();
  for (const t of side) {
    const at = byPow.get(t.pow);
    // Keep the surviving brick's identity: merging 3x and 2x should read as
    // the 3x brick growing, not as both vanishing and a stranger appearing.
    if (at) at.c = ratAdd(at.c, t.c);
    else byPow.set(t.pow, { ...t });
  }
  const out = [...byPow.values()].filter((t) => !ratIsZero(t.c));
  out.sort((a, b) => b.pow - a.pow);
  return out.length ? out : [term(rat(0))];
}

const other = (s: SideName): SideName => (s === "L" ? "R" : "L");

/** Both sides collected. Every move ends here. */
const settle = (eq: Equation): Equation => ({ L: collect(eq.L), R: collect(eq.R) });

/* ──────────────────────────────── the moves ──────────────────────────── */

/**
 * Send a term to the other side. Crossing the equals sign flips its sign —
 * the one rule the whole board runs on.
 */
export function moveAcross(eq: Equation, from: SideName, id: string): Equation {
  const moving = eq[from].find((t) => t.id === id);
  if (!moving) return eq;
  const next: Equation = {
    L: from === "L" ? eq.L.filter((t) => t.id !== id) : [...eq.L],
    R: from === "R" ? eq.R.filter((t) => t.id !== id) : [...eq.R],
  };
  next[other(from)] = [...next[other(from)], { ...moving, c: ratNeg(moving.c) }];
  return settle(next);
}

/**
 * True when the coefficient can be pulled off a term and sent across as a
 * divisor. Only when that term is alone on its side: `3x = 24` yes,
 * `3x + 7 = 31` no — there the 7 has to go first, and offering the gesture
 * early is how a student ends up with thirds of everything.
 *
 * Drives the affordance, not a refusal: a coefficient that can't move simply
 * isn't draggable, so there is nothing to be told off for.
 */
export function canDivideOut(eq: Equation, from: SideName, id: string): boolean {
  const side = eq[from];
  if (side.length !== 1 || side[0].id !== id) return false;
  const t = side[0];
  return t.pow > 0 && !ratIsOne(t.c) && !ratIsZero(t.c);
}

/**
 * Pull a coefficient off its term and across the equals: divide everything by
 * it. `3x = 24` → `x = 8`; `5x = 12` → `x = 12/5`, exactly.
 */
export function divideOut(eq: Equation, from: SideName, id: string): Equation {
  if (!canDivideOut(eq, from, id)) return eq;
  const by = eq[from][0].c;
  const scale = (side: Term[]) => side.map((t) => ({ ...t, c: ratDiv(t.c, by) }));
  return settle({ L: scale(eq.L), R: scale(eq.R) });
}

/* ───────────────────────────── reading it back ───────────────────────── */

/** x is alone on the left with only a number on the right. */
export function isSolved(eq: Equation): boolean {
  return (
    eq.L.length === 1 &&
    eq.L[0].pow === 1 &&
    ratIsOne(eq.L[0].c) &&
    eq.R.length === 1 &&
    eq.R[0].pow === 0
  );
}

/** The term without its sign — "3x", "x²", "7". */
export function termBody(t: Term): string {
  const mag: Rat = { n: Math.abs(t.c.n), d: t.c.d };
  const x = t.pow === 0 ? "" : t.pow === 1 ? "x" : `x${superscript(t.pow)}`;
  // A bare coefficient of 1 is not written in front of an x.
  const num = t.pow > 0 && ratIsOne(mag) ? "" : ratText(mag);
  return `${num}${x}`;
}

export const termSign = (t: Term): "+" | "−" => (t.c.n < 0 ? "−" : "+");

/**
 * What a brick says. The sign rides on the brick rather than sitting between
 * bricks, because the brick is what gets picked up — and what a student needs
 * to see is that they are carrying a *negative seven*, not a seven.
 */
export function termText(t: Term, leading: boolean): string {
  const sign = t.c.n < 0 ? "−" : leading ? "" : "+";
  return `${sign}${termBody(t)}`;
}

const SUPERSCRIPTS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
const superscript = (n: number): string =>
  String(n)
    .split("")
    .map((d) => SUPERSCRIPTS[Number(d)] ?? d)
    .join("");

/** One-line plain text — the solution path, and the tests. */
export function eqText(eq: Equation): string {
  const side = (s: Term[]) =>
    s
      .map((t, i) =>
        i === 0
          ? termText(t, true)
          : `${termSign(t)} ${termBody(t)}`,
      )
      .join(" ");
  return `${side(eq.L)} = ${side(eq.R)}`;
}

/* ────────────────────────────── building one ─────────────────────────── */

/** `3x + 7 = 31` without going through a parser. */
export const equation = (L: Term[], R: Term[]): Equation => settle({ L, R });

/**
 * A fresh linear equation with a whole-number answer, built backwards from the
 * answer so the board never opens on something that ends in sevenths.
 */
export function sampleEquation(rnd: () => number = Math.random): Equation {
  const pick = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const x = pick(2, 12);
  const a = pick(2, 9);
  const b = pick(-9, 9) || 4;
  return equation([term(rat(a), 1), term(rat(b))], [term(rat(a * x + b))]);
}
