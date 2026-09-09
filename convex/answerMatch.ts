/**
 * answerMatch — the single source of truth for "is this maths answer right?".
 *
 * Before this module there were two checkers that disagreed with each other:
 * `normalizeMath` in CompoundQuestionRenderer (client, homework) and
 * `answersMatch` in exams.ts (server, exam). Both compared *strings*, and the
 * stored `correctAnswer` is plain Unicode ("√2", "4/7", "x = π/4, x = 5π/4")
 * while the MathField editor emits LaTeX ("\sqrt{2}", "\frac{4}{7}"). So a
 * correctly-typed root was marked wrong in both places, and the homework
 * checker additionally fell back to `answerLower.length > 5` — grading the
 * student by string length.
 *
 * The fix is to stop comparing text. Both sides are canonicalised to one plain
 * syntax, parsed, and compared by **evaluating them**: equal at every sample
 * point means equal. √8 and 2√2 are the same number; (x+1)² and x²+2x+1 are the
 * same function; 0.5 and 1/2 are the same value. None of that is visible to a
 * string compare and all of it is free once you evaluate.
 *
 * Pure module, no Convex imports — the server grades with it (authoritative)
 * and the client runs the same code for instant feedback, so the two can never
 * drift apart again.
 */

/* ────────────────────────────── public API ────────────────────────────── */

export type MatchVerdict =
  /** identical once canonicalised */
  | "exact"
  /** different form, same value/function — √8 vs 2√2 */
  | "equivalent"
  /** a rounded decimal of the exact answer — 1.41 for √2 */
  | "rounded"
  /** parsed fine on both sides and genuinely differs */
  | "wrong"
  /** could not be parsed — caller may escalate to the AI adjudicator */
  | "unparsed";

export interface MatchResult {
  correct: boolean;
  verdict: MatchVerdict;
  /** Hebrew note for the student when the answer is accepted with a caveat. */
  note?: string;
  /** What we understood the student to have written — echoed back in the UI. */
  readAs: string;
}

/** Answer types this module can decide. Anything else is a human/AI judgement. */
export const AUTO_GRADED_TYPES = new Set(["numeric", "expression", "range", "coordinates"]);

/**
 * Compare a student's answer against the stored correct one.
 *
 * `answerType` only widens or narrows the shapes we try (a "coordinates"
 * answer is a tuple, a "range" answer is an inequality); the comparison itself
 * is the same numeric one throughout.
 */
/**
 * Longest answer we will try to parse. No real answer is close to this; a
 * multi-kilobyte one is either a paste accident or someone probing the
 * recursive-descent parser for a stack overflow. `studentId` is a
 * client-supplied arg with no auth (see CLAUDE.md), so this input reaches the
 * grading mutation directly and a RangeError here would crash it.
 */
const MAX_INPUT = 1000;

export function matchAnswer(correct: string, student: string, answerType = "expression"): MatchResult {
  if (student.length > MAX_INPUT || correct.length > MAX_INPUT) {
    return { correct: false, verdict: "unparsed", readAs: student.slice(0, 80) };
  }
  const readAs = canonicalize(student);
  const want = canonicalize(correct);
  if (!readAs) return { correct: false, verdict: "wrong", readAs: "" };
  if (!want) return { correct: false, verdict: "unparsed", readAs };

  if (readAs === want) return { correct: true, verdict: "exact", readAs };

  // ± is a two-answer shorthand, so expand it into the pair it stands for.
  // Collapsing it to one branch (as taking the principal value would) accepts
  // a student who gave half the solution set — and, worse, accepts the "+"
  // half while rejecting the "−" half.
  // Chained and reversed relations are rewritten into a comparable set of
  // constraints, so 2<x<5, 5>x>2 and x>2,x<5 all reach the same shape.
  const wantX = normalizeRelations(expandPlusMinus(want));
  const gotX = normalizeRelations(expandPlusMinus(readAs));

  // Multi-part answers ("x=pi/4, x=5pi/4", "(4,8)") compare part-wise. Tuples
  // are ordered, solution sets are not — coordinates are the ordered case.
  const wantParts = splitParts(wantX);
  const studentParts = splitParts(gotX);
  if (wantParts.length > 1 || studentParts.length > 1) {
    if (wantParts.length !== studentParts.length) {
      return { correct: false, verdict: "wrong", readAs };
    }
    const ordered = answerType === "coordinates" || isTuple(wantX);
    return matchParts(wantParts, studentParts, ordered, readAs);
  }

  return matchSingle(wantX, gotX, readAs);
}

/** "x=±2" → "x=+2,x=-2" — the two answers it is shorthand for. */
function expandPlusMinus(s: string): string {
  if (!s.includes("±")) return s;
  return `${s.replace(/±/g, "+")},${s.replace(/±/g, "-")}`;
}

/* ───────────────────────── canonicalisation ───────────────────────── */

/** LaTeX command → plain function name. Longest first so \arcsin beats \sin. */
const FUNCTION_WORDS = [
  "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  "sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "exp", "sqrt", "abs",
];

/**
 * Rewrite anything a student or an author might type into one plain syntax:
 * ASCII, lower case, no spaces, `sqrt(...)` for roots, `/` for fractions,
 * `^` for powers, `pi` for π.
 */
export function canonicalize(input: string): string {
  if (!input) return "";
  let s = input.normalize("NFKC");

  // Hebrew wrappers a student may type around the maths.
  s = s.replace(/שורש\s*ריבועי\s*של/g, "sqrt");
  s = s.replace(/השורש\s*של|שורש\s*של|שורש/g, "sqrt");
  s = s.replace(/\bאו\b/g, ",");

  // LaTeX spacing/decoration carries no meaning.
  s = s.replace(/\\left|\\right|\\!|\\,|\\;|\\:|\\quad|\\qquad|\\displaystyle|\\text\s*/g, "");
  s = s.replace(/[$«»]/g, "");

  // \frac{a}{b} → ((a)/(b)), brace-aware so nested fractions survive.
  s = expandCommand(s, ["frac", "dfrac", "tfrac"], 2, (a, b) => `((${a})/(${b}))`);
  // \sqrt[n]{x} → ((x)^(1/(n))) ; \sqrt{x} → sqrt(x)
  s = expandRoot(s);
  s = expandCommand(s, ["abs"], 1, (a) => `abs(${a})`);

  // Operators and relations, LaTeX and Unicode alike.
  s = s
    .replace(/\\cdot|\\times|·|×|∙|⋅/g, "*")
    .replace(/\\div|÷/g, "/")
    .replace(/\\pm|±/g, "±")            // kept as one token, expanded later
    .replace(/\\neq|\\ne|≠/g, "!=")
    .replace(/\\leq|\\le|≤/g, "<=")
    .replace(/\\geq|\\ge|≥/g, ">=")
    .replace(/\\infty|∞/g, "inf")
    .replace(/\\pi|π/g, "pi")
    .replace(/\\alpha|α/g, "alpha")
    .replace(/\\beta|β/g, "beta")
    .replace(/\\theta|θ/g, "theta")
    // Degrees are the default unit in this curriculum and both sides get the
    // same treatment, so the marker carries no information. Left in, "deg"
    // parses as the variables d·e·g and 90° stops equalling 90.
    .replace(/\\degree|°/g, "")
    .replace(/√/g, "sqrt")
    .replace(/[−–—]/g, "-")             // U+2212 and dashes are not hyphens
    .replace(/[’′']/g, "'");

  // Superscript digits: x² → x^2
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => "^" + [...m].map((c) => SUP.indexOf(c)).join(""));
  s = s.replace(/½/g, "(1/2)").replace(/¼/g, "(1/4)").replace(/¾/g, "(3/4)");

  // Remaining LaTeX function commands (\sin → sin).
  for (const fn of FUNCTION_WORDS) s = s.split("\\" + fn).join(fn);

  // |x| is how absolute value is written on paper and what the symbol strip
  // inserts (\left|…\right|, whose commands are stripped just above).
  s = barsToAbs(s);

  // Braces are usually LaTeX grouping, and parentheses mean the same thing to
  // the parser — but {2,5} is a solution SET, and turning it into (2,5) makes
  // it look like an ordered pair, so reordering it would be marked wrong.
  // Only comma-free groups become parentheses.
  s = groupingBracesToParens(s);
  // Subscripts identify a variable (a_1), so fold them into the name.
  s = s.replace(/_/g, "");
  // Anything still backslashed is a command we do not model; drop the marker
  // rather than the name, so \foo reads as the identifier foo.
  s = s.replace(/\\/g, "");

  s = s.toLowerCase().replace(/\s+/g, "");
  // "sqrt2" (no parens) means sqrt of the next atom, as written on paper.
  s = tightenBareRoots(s);
  // Trailing punctuation a student adds out of habit.
  s = s.replace(/[.;]+$/g, "");
  return s;
}

/** `|x-3|` → `abs(x-3)`. Innermost-first, so nesting resolves outward. */
function barsToAbs(s: string): string {
  let out = s;
  let guard = 0;
  for (;;) {
    const m = /\|([^|]*)\|/.exec(out);
    if (!m || guard++ > 50) break;
    out = out.slice(0, m.index) + `abs(${m[1]})` + out.slice(m.index + m[0].length);
  }
  return out;
}

/** Braces that group become parens; braces that hold a list stay a set. */
function groupingBracesToParens(s: string): string {
  let out = "";
  for (let i = 0; i < s.length;) {
    if (s[i] !== "{") { out += s[i++]; continue; }
    const g = readGroup(s, i);
    if (!g) { i++; continue; }  // unbalanced — drop the stray brace
    const body = groupingBracesToParens(g.body);
    out += topLevelSplit(body, ",").length > 1 ? `{${body}}` : `(${body})`;
    i = g.end;
  }
  return out;
}

/** Read a balanced {...} group starting at `i` (which must index the "{"). */
function readGroup(s: string, i: number): { body: string; end: number } | null {
  if (s[i] !== "{") return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}") {
      depth--;
      if (depth === 0) return { body: s.slice(i + 1, j), end: j + 1 };
    }
  }
  return null;
}

/** Expand `\name{a}{b}` (arity 1 or 2) with a brace-aware scan, innermost-safe. */
function expandCommand(s: string, names: string[], arity: number, build: (a: string, b: string) => string): string {
  let out = s;
  for (const name of names) {
    let guard = 0;
    for (;;) {
      const at = out.indexOf("\\" + name);
      if (at === -1 || guard++ > 200) break;
      let cursor = at + name.length + 1;
      const args: string[] = [];
      let ok = true;
      for (let k = 0; k < arity; k++) {
        const g = readGroup(out, cursor);
        if (!g) { ok = false; break; }
        args.push(g.body);
        cursor = g.end;
      }
      if (!ok) {
        // Malformed — neutralise the command so the loop cannot spin.
        out = out.slice(0, at) + out.slice(at + 1);
        continue;
      }
      out = out.slice(0, at) + build(args[0], args[1] ?? "") + out.slice(cursor);
    }
  }
  return out;
}

/** `\sqrt[n]{x}` → `((x)^(1/(n)))`, `\sqrt{x}` → `sqrt(x)`. */
function expandRoot(s: string): string {
  let out = s;
  let guard = 0;
  for (;;) {
    const at = out.indexOf("\\sqrt");
    if (at === -1 || guard++ > 200) break;
    let cursor = at + 5;
    let index: string | null = null;
    if (out[cursor] === "[") {
      const close = out.indexOf("]", cursor);
      if (close !== -1) {
        index = out.slice(cursor + 1, close);
        cursor = close + 1;
      }
    }
    const g = readGroup(out, cursor);
    if (!g) { out = out.slice(0, at) + "sqrt" + out.slice(at + 5); continue; }
    const body = index ? `((${g.body})^(1/(${index})))` : `sqrt(${g.body})`;
    out = out.slice(0, at) + body + out.slice(g.end);
  }
  return out;
}

/**
 * `sqrt2`, `sqrt2x` → `sqrt(2)`, `sqrt(2)x`. On paper the radical covers one
 * atom; without this, implicit multiplication would put the whole tail under
 * the root and √2·x would compare as √(2x).
 */
function tightenBareRoots(s: string): string {
  let out = "";
  for (let i = 0; i < s.length;) {
    if (!s.startsWith("sqrt", i)) { out += s[i++]; continue; }
    let j = i + 4;
    if (s[j] === "(") { out += "sqrt"; i = j; continue; }
    let atom = "";
    while (j < s.length && /[0-9.]/.test(s[j])) atom += s[j++];
    if (!atom && j < s.length && /[a-z]/.test(s[j])) atom = s[j++];
    out += atom ? `sqrt(${atom})` : "sqrt";
    i = j;
  }
  return out;
}

/* ────────────────────────── structural splitting ────────────────────────── */

const isTuple = (s: string) => /^\(.*,.*\)$/.test(s) && topLevelSplit(s.slice(1, -1), ",").length > 1;
/** {2,5} — a solution set, which is unordered. */
const isSet = (s: string) => /^\{.*\}$/.test(s);

/** Split on top-level commas, ignoring commas nested inside brackets. */
function topLevelSplit(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((p) => p.trim()).filter(Boolean);
}

/** A "(4,8)" tuple or an "x=1,x=2" solution set becomes its component parts. */
function splitParts(s: string): string[] {
  const inner = isTuple(s) || isSet(s) ? s.slice(1, -1) : s;
  return topLevelSplit(inner, ",");
}

function matchParts(want: string[], got: string[], ordered: boolean, readAs: string): MatchResult {
  if (ordered) {
    let verdict: MatchVerdict = "exact";
    for (let i = 0; i < want.length; i++) {
      const r = matchSingle(want[i], got[i], readAs);
      if (!r.correct) return { correct: false, verdict: "wrong", readAs };
      if (r.verdict !== "exact") verdict = r.verdict === "rounded" ? "rounded" : "equivalent";
    }
    return { correct: true, verdict, readAs, note: verdict === "rounded" ? ROUNDED_NOTE : undefined };
  }
  // Unordered: every wanted part must be claimed by a distinct student part.
  // Distinct expected answers need distinct student answers — otherwise one
  // repeated value that is near both of them covers the pair, and the student
  // never named either root.
  if (new Set(want).size === want.length && new Set(got).size !== got.length) {
    return { correct: false, verdict: "wrong", readAs };
  }
  const taken = new Set<number>();
  let verdict: MatchVerdict = "exact";
  for (const w of want) {
    const hit = got.findIndex((g, i) => !taken.has(i) && matchSingle(w, g, readAs).correct);
    if (hit === -1) return { correct: false, verdict: "wrong", readAs };
    taken.add(hit);
    const r = matchSingle(w, got[hit], readAs);
    if (r.verdict !== "exact") verdict = r.verdict === "rounded" ? "rounded" : "equivalent";
  }
  return { correct: true, verdict, readAs, note: verdict === "rounded" ? ROUNDED_NOTE : undefined };
}

const ROUNDED_NOTE = "נכון — התשובה שלך מעוגלת, הערך המדויק קצת שונה.";
const RELATIONS = ["<=", ">=", "!=", "=", "<", ">"] as const;

const FLIP: Record<string, string> = { "<": ">", ">": "<", "<=": ">=", ">=": "<=", "=": "=", "!=": "!=" };

/** Every top-level relation operator in `s`, with the operands between them. */
function scanRelations(s: string): { operands: string[]; ops: string[] } {
  const operands: string[] = [];
  const ops: string[] = [];
  let depth = 0, cur = "";
  for (let i = 0; i < s.length;) {
    const ch = s[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    const op = depth === 0 ? RELATIONS.find((r) => s.startsWith(r, i)) : undefined;
    if (op && cur !== "") {
      operands.push(cur);
      ops.push(op);
      cur = "";
      i += op.length;
      continue;
    }
    cur += ch;
    i++;
  }
  operands.push(cur);
  return { operands, ops };
}

/**
 * Rewrite every part into constraints with the variable on the left.
 *
 * A range is written three interchangeable ways — 2<x<5, 5>x>2, and
 * "x>2, x<5" — and comparing them as text makes two of the three wrong. This
 * turns all of them into the same pair of constraints, which the unordered
 * part matcher then compares.
 */
function normalizeRelations(s: string): string {
  return topLevelSplit(s, ",").map(normalizeOnePart).join(",") || s;
}

function normalizeOnePart(part: string): string {
  const { operands, ops } = scanRelations(part);
  if (ops.length === 0) return part;
  if (ops.length === 1) return orientConstraint(operands[0], ops[0], operands[1]);
  if (ops.length === 2) {
    // a < x < b  ⇒  x > a , x < b
    return [
      orientConstraint(operands[1], FLIP[ops[0]] ?? ops[0], operands[0]),
      orientConstraint(operands[1], ops[1], operands[2]),
    ].join(",");
  }
  return part; // deeper chains are not a shape this curriculum produces
}

/** "2<x" → "x>2": the side carrying the unknown leads. */
function orientConstraint(lhs: string, op: string, rhs: string): string {
  const leftHasVars = (compile(lhs)?.vars.length ?? 0) > 0;
  const rightHasVars = (compile(rhs)?.vars.length ?? 0) > 0;
  if (!leftHasVars && rightHasVars) return `${rhs}${FLIP[op] ?? op}${lhs}`;
  return `${lhs}${op}${rhs}`;
}

/** Split "x>=2" into its relation parts; null when there is no relation. */
function splitRelation(s: string): { lhs: string; op: string; rhs: string } | null {
  const { operands, ops } = scanRelations(s);
  if (ops.length !== 1 || !operands[0] || !operands[1]) return null;
  return { lhs: operands[0], op: ops[0], rhs: operands[1] };
}

/* ───────────────────────────── comparison ───────────────────────────── */

function matchSingle(want: string, got: string, readAs: string): MatchResult {
  if (want === got) return { correct: true, verdict: "exact", readAs };

  const wantRel = splitRelation(want);
  const gotRel = splitRelation(got);

  if (wantRel && gotRel) {
    if (wantRel.op !== gotRel.op) return { correct: false, verdict: "wrong", readAs };
    const direct = numericEqual(wantRel.lhs, gotRel.lhs) && numericEqual(wantRel.rhs, gotRel.rhs);
    // "x = 2" and "2 = x" say the same thing; "x < 2" and "2 < x" do not.
    const flipped = wantRel.op === "=" && numericEqual(wantRel.lhs, gotRel.rhs) && numericEqual(wantRel.rhs, gotRel.lhs);
    // Both sides moved across the equals: "x = 2" vs "x - 2 = 0".
    const balanced = wantRel.op === "=" && gotRel.op === "=" &&
      numericEqual(`(${wantRel.lhs})-(${wantRel.rhs})`, `(${gotRel.lhs})-(${gotRel.rhs})`);
    if (direct || flipped || balanced) return { correct: true, verdict: "equivalent", readAs };
    return { correct: false, verdict: "wrong", readAs };
  }

  // One side names the variable and the other just gives the value. A student
  // who writes "2" for "x = 2" has answered the question.
  if (wantRel && !gotRel) return decide(wantRel.rhs, got, readAs);
  if (!wantRel && gotRel) return decide(want, gotRel.rhs, readAs);

  return decide(want, got, readAs);
}

function decide(want: string, got: string, readAs: string): MatchResult {
  const r = agree(want, got);
  if (!r.parsed) return { correct: false, verdict: "unparsed", readAs };
  if (r.rounded) return { correct: true, verdict: "rounded", readAs, note: ROUNDED_NOTE };
  if (r.ok) return { correct: true, verdict: "equivalent", readAs };
  return { correct: false, verdict: "wrong", readAs };
}

const numericEqual = (want: string, got: string): boolean => agree(want, got).ok;

/**
 * Sample points, deliberately straddling zero. An all-positive sample set
 * cannot tell abs(x) from x, or sqrt(x^2) from x — a student who dropped the
 * absolute value scored full marks. Points that fall outside a function's
 * domain evaluate to NaN and are skipped, so the negatives cost nothing.
 */
const SAMPLES = [0.7371, -1.2113, 2.3319, -3.7177, 0.4211, -5.1379, 1.8887, 4.4643];
const EXACT_TOL = 1e-9;

type Compiled = { vars: string[]; eval: (env: Record<string, number>) => number };

/** Largest absolute and relative gap between two expressions over the samples. */
function compare(a: Compiled, b: Compiled): { status: "equal" | "different" | "undecidable"; maxAbs: number } {
  const vars = [...new Set([...a.vars, ...b.vars])];
  let worstRel = 0;
  let worstAbs = 0;
  let usable = 0;

  const trials = vars.length === 0 ? 1 : SAMPLES.length;
  for (let t = 0; t < trials; t++) {
    const env: Record<string, number> = {};
    vars.forEach((v, i) => { env[v] = SAMPLES[(t + i * 3) % SAMPLES.length]; });
    const x = a.eval(env);
    const y = b.eval(env);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue; // outside a domain
    usable++;
    const diff = Math.abs(x - y);
    worstAbs = Math.max(worstAbs, diff);
    worstRel = Math.max(worstRel, diff / Math.max(1, Math.abs(x), Math.abs(y)));
  }
  if (usable === 0) return { status: "undecidable", maxAbs: Infinity };
  return { status: worstRel <= EXACT_TOL ? "equal" : "different", maxAbs: worstAbs };
}

/** Decimal places in a plain number literal; null when it is not one. */
function writtenDecimals(s: string): number | null {
  const m = /^[+-]?\d+(?:\.(\d+))?$/.exec(s);
  return m ? (m[1]?.length ?? 0) : null;
}

/**
 * Do these two expressions agree, and if so was it only after rounding?
 *
 * The rounding allowance comes from the student's OWN written precision, not a
 * flat percentage: "1.414" claims three decimals and is a fair rounding of √2,
 * while "1004" claims integer precision and is simply not 1000. A flat 0.5%
 * tolerance accepted both, and let one repeated near-value cover two distinct
 * roots in a solution set.
 */
function agree(want: string, got: string): { ok: boolean; rounded: boolean; parsed: boolean } {
  const a = compile(want);
  const b = compile(got);
  if (!a || !b) return { ok: false, rounded: false, parsed: false };
  const cmp = compare(a, b);
  if (cmp.status === "undecidable") return { ok: false, rounded: false, parsed: false };
  if (cmp.status === "equal") return { ok: true, rounded: false, parsed: true };

  const decimals = writtenDecimals(got);
  if (decimals !== null && cmp.maxAbs <= 0.5 * Math.pow(10, -decimals) * (1 + 1e-9)) {
    return { ok: true, rounded: true, parsed: true };
  }
  return { ok: false, rounded: false, parsed: true };
}

/* ─────────────────────────── expression parser ─────────────────────────── */
/* Recursive descent over the canonical syntax. Produces a closure rather than
   an AST — the only thing anyone asks of a parsed answer here is its value. */

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E, inf: Infinity };
const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  ln: Math.log, log: Math.log10, exp: Math.exp,
  cot: (x) => 1 / Math.tan(x), sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x),
};

/** Deeper than any real answer; the guard is against a crafted stack overflow. */
const MAX_DEPTH = 64;

export function compile(s: string): Compiled | null {
  // ± is expanded into both answers before we get here (see expandPlusMinus).
  // Quietly taking the principal branch instead would accept a student who
  // gave only one of the two roots.
  if (!s || s.length > MAX_INPUT || s.includes("±")) return null;
  let i = 0;
  let depth = 0;
  const vars = new Set<string>();

  type Node = (env: Record<string, number>) => number;

  const peek = () => s[i];
  const eat = (tok: string) => { if (s.startsWith(tok, i)) { i += tok.length; return true; } return false; };

  function parseExpr(): Node | null {
    const first = parseTerm();
    if (!first) return null;
    let left: Node = first;
    for (;;) {
      if (eat("+")) { const r = parseTerm(); if (!r) return null; const l = left; left = (e) => l(e) + r(e); }
      else if (eat("-")) { const r = parseTerm(); if (!r) return null; const l = left; left = (e) => l(e) - r(e); }
      else return left;
    }
  }

  function parseTerm(): Node | null {
    const first = parseUnary();
    if (!first) return null;
    let left: Node = first;
    for (;;) {
      if (eat("*")) { const r = parseUnary(); if (!r) return null; const l = left; left = (e) => l(e) * r(e); }
      else if (eat("/")) { const r = parseUnary(); if (!r) return null; const l = left; left = (e) => l(e) / r(e); }
      else if (startsAtom()) {
        // Implicit multiplication: 2x, 2(x+1), x sqrt(2).
        const r = parseUnary(); if (!r) return null; const l = left; left = (e) => l(e) * r(e);
      }
      else return left;
    }
  }

  function startsAtom(): boolean {
    const c = peek();
    return !!c && (/[0-9a-z.(]/.test(c));
  }

  function parseUnary(): Node | null {
    if (eat("-")) { const r = parseUnary(); return r && ((e) => -r(e)); }
    if (eat("+")) return parseUnary();
    return parsePower();
  }

  function parsePower(): Node | null {
    const base = parseAtom();
    if (!base) return null;
    if (eat("^")) {
      // Right-associative, and the exponent may itself be signed: 2^-1.
      const exp = parseUnary();
      if (!exp) return null;
      return (e) => Math.pow(base(e), exp(e));
    }
    return base;
  }

  function parseAtom(): Node | null {
    if (eat("(")) {
      if (++depth > MAX_DEPTH) return null;
      const inner = parseExpr();
      depth--;
      if (!inner || !eat(")")) return null;
      return inner;
    }
    const num = /^[0-9]*\.?[0-9]+/.exec(s.slice(i));
    if (num) { i += num[0].length; const v = parseFloat(num[0]); return () => v; }

    const word = /^[a-z][a-z0-9]*/.exec(s.slice(i));
    if (word) {
      const name = word[0];
      // Longest-match a function or constant off the front; the rest of the
      // run stays as separate implicitly-multiplied variables (so "xy" is x*y
      // but "sqrt" is never split into s*q*r*t).
      for (const fn of Object.keys(FUNCTIONS).sort((a, b) => b.length - a.length)) {
        if (name.startsWith(fn)) {
          i += fn.length;
          const arg = parseAtom();
          if (!arg) return null;
          const f = FUNCTIONS[fn];
          return (e) => f(arg(e));
        }
      }
      for (const cn of Object.keys(CONSTANTS).sort((a, b) => b.length - a.length)) {
        if (name.startsWith(cn)) { i += cn.length; const v = CONSTANTS[cn]; return () => v; }
      }
      i += 1; // single-letter variable
      const v = name[0];
      vars.add(v);
      return (e) => e[v] ?? 0;
    }
    return null;
  }

  const root = parseExpr();
  if (!root || i !== s.length) return null;
  return { vars: [...vars], eval: root };
}
