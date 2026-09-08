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
export function matchAnswer(correct: string, student: string, answerType = "expression"): MatchResult {
  const readAs = canonicalize(student);
  const want = canonicalize(correct);
  if (!readAs) return { correct: false, verdict: "wrong", readAs: "" };
  if (!want) return { correct: false, verdict: "unparsed", readAs };

  if (readAs === want) return { correct: true, verdict: "exact", readAs };

  // Multi-part answers ("x=pi/4, x=5pi/4", "(4,8)") compare part-wise. Tuples
  // are ordered, solution sets are not — coordinates are the ordered case.
  const wantParts = splitParts(want);
  const studentParts = splitParts(readAs);
  if (wantParts.length > 1 || studentParts.length > 1) {
    if (wantParts.length !== studentParts.length) {
      return { correct: false, verdict: "wrong", readAs };
    }
    const ordered = answerType === "coordinates" || isTuple(want);
    return matchParts(wantParts, studentParts, ordered, readAs);
  }

  return matchSingle(want, readAs, readAs);
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
    .replace(/\\degree|°/g, "deg")
    .replace(/√/g, "sqrt")
    .replace(/[−–—]/g, "-")             // U+2212 and dashes are not hyphens
    .replace(/[’′']/g, "'");

  // Superscript digits: x² → x^2
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => "^" + [...m].map((c) => SUP.indexOf(c)).join(""));
  s = s.replace(/½/g, "(1/2)").replace(/¼/g, "(1/4)").replace(/¾/g, "(3/4)");

  // Remaining LaTeX function commands (\sin → sin).
  for (const fn of FUNCTION_WORDS) s = s.split("\\" + fn).join(fn);

  // Braces are LaTeX grouping — parentheses mean the same thing to the parser.
  s = s.replace(/[{}]/g, (m) => (m === "{" ? "(" : ")"));
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

/** Split on top-level commas, ignoring commas nested inside brackets. */
function topLevelSplit(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((p) => p.trim()).filter(Boolean);
}

/** A "(4,8)" tuple or an "x=1,x=2" solution set becomes its component parts. */
function splitParts(s: string): string[] {
  const inner = isTuple(s) ? s.slice(1, -1) : s;
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

/** Split "x>=2" into its relation parts; null when there is no relation. */
function splitRelation(s: string): { lhs: string; op: string; rhs: string } | null {
  for (const op of RELATIONS) {
    const at = s.indexOf(op);
    if (at > 0 && at + op.length < s.length) {
      return { lhs: s.slice(0, at), op, rhs: s.slice(at + op.length) };
    }
  }
  return null;
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
  const a = compile(want);
  const b = compile(got);
  if (!a || !b) return { correct: false, verdict: "unparsed", readAs };

  const cmp = compare(a, b);
  if (cmp === "equal") return { correct: true, verdict: "equivalent", readAs };
  if (cmp === "rounded") return { correct: true, verdict: "rounded", readAs, note: ROUNDED_NOTE };
  if (cmp === "undecidable") return { correct: false, verdict: "unparsed", readAs };
  return { correct: false, verdict: "wrong", readAs };
}

function numericEqual(want: string, got: string): boolean {
  const a = compile(want);
  const b = compile(got);
  if (!a || !b) return false;
  const cmp = compare(a, b);
  return cmp === "equal" || cmp === "rounded";
}

/** Sample points chosen to dodge the usual poles and branch cuts. */
const SAMPLES = [0.7371, 1.2113, 2.3319, 3.7177, 0.4211, 5.1379, 1.8887, 4.4643];
const EXACT_TOL = 1e-9;
const ROUND_TOL = 5e-3;

type Compiled = { vars: string[]; eval: (env: Record<string, number>) => number };

function compare(a: Compiled, b: Compiled): "equal" | "rounded" | "different" | "undecidable" {
  const vars = [...new Set([...a.vars, ...b.vars])];
  // A variable only one side mentions means they cannot be the same function,
  // unless it cancels — the sampling below settles that either way.
  let worstRel = 0;
  let usable = 0;

  const trials = vars.length === 0 ? 1 : SAMPLES.length;
  for (let t = 0; t < trials; t++) {
    const env: Record<string, number> = {};
    vars.forEach((v, i) => { env[v] = SAMPLES[(t + i * 3) % SAMPLES.length]; });
    const x = a.eval(env);
    const y = b.eval(env);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue; // outside a domain
    usable++;
    const scale = Math.max(1, Math.abs(x), Math.abs(y));
    worstRel = Math.max(worstRel, Math.abs(x - y) / scale);
  }
  if (usable === 0) return "undecidable";
  if (worstRel <= EXACT_TOL) return "equal";
  if (worstRel <= ROUND_TOL) return "rounded";
  return "different";
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

export function compile(src: string): Compiled | null {
  // ± has no single value; take the principal branch so at least one form
  // compares, rather than failing the whole answer.
  const s = src.replace(/±/g, "+");
  if (!s) return null;
  let i = 0;
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
      const inner = parseExpr();
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
