// ── Math Playground compute engine ──
// The ONLY module that talks to the CAS libraries. Everything goes in as LaTeX
// (what MathLive emits) and comes back as LaTeX (what MathText/KaTeX renders),
// so the rest of the app never touches nerdamer/mathjs syntax.
//
// nerdamer (+ its Algebra/Calculus/Solve add-ons, all bundled in `all.min`) is a
// heavy, CommonJS library. We `import()` it lazily on first use and cache it, so
// it rides in the lazily-loaded playground chunk and never hits the main bundle.

export type MathOp =
  | "evaluate"
  | "solve"
  | "simplify"
  | "factor"
  | "expand"
  | "derivative"
  | "integral";

export interface MathResult {
  /** Result as LaTeX, ready for KaTeX. Empty string on error. */
  latex: string;
  /** Engine's plain infix form — handy for copy / debugging. */
  plain: string;
  /** Decimal approximation of an exact symbolic result (e.g. "1.414214"), when it adds information. */
  approx?: string;
  /**
   * Reusable fragment for "continue from this result": the bare expression
   * without the d/dx(...)= / ∫...dx= presentation wrapper. Falls back to latex.
   */
  reuseLatex?: string;
  /** Hebrew error message, or null on success. */
  error: string | null;
}

/* nerdamer has no type declarations; we treat it structurally as `any`. */
type Nerdamer = any;
let _nerdamerPromise: Promise<Nerdamer> | null = null;

async function getNerdamer(): Promise<Nerdamer> {
  if (!_nerdamerPromise) {
    _nerdamerPromise = import(
      // @ts-expect-error -- nerdamer ships no type declarations; used structurally as `any`.
      "nerdamer/all.min.js"
    ).then((mod: any) => mod.default ?? mod);
  }
  return _nerdamerPromise;
}

const GENERIC_ERROR = "לא הצלחתי לפענח את הביטוי. בדקו את הקלט ונסו שוב.";
const EMPTY_ERROR = "אין מה לחשב — הקלידו ביטוי קודם.";

// nerdamer's convertFromLaTeX understands \frac, \sqrt, \left/\right, powers,
// etc. — but NOT the multiplication commands MathLive emits (\cdot, \times) or
// LaTeX spacing macros, which it mis-reads as variables. Normalise those first.
function sanitizeLatex(tex: string): string {
  return tex
    // MathLive placeholder holes (from the lego blocks) — unwrap filled ones,
    // drop empty ones so a half-built block doesn't read as a variable.
    .replace(/\\placeholder\{([^{}]*)\}/g, "$1")
    .replace(/\\cdot/g, "*")
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\\!/g, "")
    .replace(/\\[,;:]/g, " ")
    .replace(/\\ /g, " ");
}

/** LaTeX → a nerdamer infix string the function API can consume. */
function latexToExpr(N: Nerdamer, latex: string): string {
  return N.convertFromLaTeX(sanitizeLatex(latex)).toString();
}

/**
 * Split `lhs = rhs` on its single `=`. Null when the input isn't an equation.
 * MathLive writes relations as macros (`\ne`, `\geq`), so a bare `=` is
 * unambiguous — no need to walk the string.
 */
function splitEquation(latex: string): [string, string] | null {
  const parts = latex.split("=");
  return parts.length === 2 && parts[0].trim() && parts[1].trim()
    ? [parts[0], parts[1]]
    : null;
}

/** The bare result, without the d/dx(…)= or ∫…dx= presentation wrapper. */
const bare = (r: MathResult) => r.reuseLatex ?? r.latex;

/** Ops that mean "do this to each side" when the board holds an equation. */
const SIDEWISE: ReadonlySet<MathOp> = new Set<MathOp>([
  "evaluate",
  "simplify",
  "factor",
  "expand",
  "derivative",
  "integral",
]);

/** Pick the variable to operate on: prefer x, else the first symbol, else x. */
function pickVariable(N: Nerdamer, exprStr: string, explicit?: string): string {
  if (explicit) return explicit;
  try {
    const vars: string[] = N(exprStr).variables();
    if (vars.includes("x")) return "x";
    return vars[0] || "x";
  } catch {
    return "x";
  }
}

/**
 * nerdamer writes every product with an explicit `\cdot`, so a coefficient
 * comes back as `3 \cdot x`. No student writes that, and it makes a solved
 * line unrecognisable next to the one they typed. Drop the dot only where
 * juxtaposition is unambiguous — after a number, before a symbol or a group.
 */
function tidyTeX(tex: string): string {
  return tex
    .replace(/(\d)\s*\\cdot\s*(?=[a-zA-Z\\(])/g, "$1")
    // …and between groups: (x−2)(x−3) is how the factored form is written.
    .replace(/\s*\\cdot\s*(?=\\left\()/g, "");
}

const toTeX = (expr: Nerdamer): string => tidyTeX(expr.toTeX());

const ok = (expr: any): MathResult => ({
  latex: toTeX(expr),
  plain: expr.toString(),
  error: null,
});

const fail = (msg = GENERIC_ERROR): MathResult => ({ latex: "", plain: "", error: msg });

/** Decimal approximation of an exact result, only when it adds information
 *  (i.e. the exact form isn't already a plain number). */
function approxOf(N: Nerdamer, expr: any): string | undefined {
  try {
    const dec: string = N(expr.toString()).evaluate().text("decimals", 6);
    if (!dec || /[a-zA-Z]/.test(dec)) return undefined; // symbolic — no numeric value
    const plain = expr.toString();
    if (dec === plain) return undefined; // already a plain number
    return dec;
  } catch {
    return undefined;
  }
}

/**
 * Run one CAS operation on a LaTeX expression and get LaTeX back.
 * `variable` is only used by derivative / integral / solve (defaults to x).
 *
 * When the board holds an equation, everything except `solve` distributes over
 * it: the student asked to simplify *the line they are working on*, and half a
 * simplified equation is not a line anyone can keep solving.
 */
export async function compute(
  op: MathOp,
  latex: string,
  variable?: string,
): Promise<MathResult> {
  if (!latex || !latex.trim()) return fail(EMPTY_ERROR);

  let N: Nerdamer;
  try {
    N = await getNerdamer();
  } catch {
    return fail("מנוע החישוב לא נטען. בדקו את החיבור לאינטרנט ורעננו.");
  }

  const sides = SIDEWISE.has(op) ? splitEquation(latex) : null;
  if (sides) {
    const left = computeExpr(N, op, sides[0], variable);
    if (left.error) return left;
    const right = computeExpr(N, op, sides[1], variable);
    if (right.error) return right;
    return {
      latex: `${bare(left)}=${bare(right)}${op === "integral" ? "+C" : ""}`,
      plain: `${left.plain}=${right.plain}`,
      error: null,
    };
  }

  return computeExpr(N, op, latex, variable);
}

function computeExpr(N: Nerdamer, op: MathOp, latex: string, variable?: string): MathResult {
  try {
    switch (op) {
      case "solve": {
        // Move an equation to one side: lhs = rhs  →  (lhs) - (rhs).
        const sides = latex.split("=");
        const exprStr =
          sides.length === 2
            ? `(${latexToExpr(N, sides[0])})-(${latexToExpr(N, sides[1])})`
            : latexToExpr(N, latex);
        const v = pickVariable(N, exprStr, variable);
        const sols = N.solveEquations(`${exprStr}=0`, v);
        const arr: any[] = Array.isArray(sols) ? sols : [sols];
        if (arr.length === 0) return fail("לא נמצאו פתרונות ממשיים.");
        // x_1 = …, x_2 = … — the reusable fragment is the first solution.
        const parts = arr.map((s, i) => {
          const e = N(s.toString());
          return `${v}_{${i + 1}}=${toTeX(e)}`;
        });
        const first = N(arr[0].toString());
        return {
          latex: parts.join(",\\;\\;"),
          plain: arr.map((s) => s.toString()).join(", "),
          reuseLatex: toTeX(first),
          approx: arr.length === 1 ? approxOf(N, first) : undefined,
          error: null,
        };
      }
      case "simplify":
        return ok(N(`simplify(${latexToExpr(N, latex)})`));
      case "factor": {
        // A constant has nothing to factor, and nerdamer answers `0` with
        // `0^1` — which then lands on the board as the student's next line.
        const exprStr = latexToExpr(N, latex);
        const expr = N(exprStr);
        return ok(expr.variables().length === 0 ? expr : N(`factor(${exprStr})`));
      }
      case "expand":
        return ok(N(`expand(${latexToExpr(N, latex)})`));
      case "derivative": {
        const exprStr = latexToExpr(N, latex);
        const v = pickVariable(N, exprStr, variable);
        const src = N(exprStr);
        const out = N(`diff(${exprStr}, ${v})`);
        return {
          latex: `\\frac{d}{d${v}}\\left(${toTeX(src)}\\right)=${toTeX(out)}`,
          plain: out.toString(),
          reuseLatex: toTeX(out),
          error: null,
        };
      }
      case "integral": {
        const exprStr = latexToExpr(N, latex);
        const v = pickVariable(N, exprStr, variable);
        const src = N(exprStr);
        const out = N(`integrate(${exprStr}, ${v})`);
        return {
          latex: `\\int ${toTeX(src)}\\,d${v}=${toTeX(out)}+C`,
          plain: out.toString(),
          reuseLatex: toTeX(out),
          error: null,
        };
      }
      case "evaluate":
      default: {
        // Exact symbolic form first; a ≈ decimal line when it adds information.
        const exact = N(`simplify(${latexToExpr(N, latex)})`);
        return { ...ok(exact), approx: approxOf(N, exact) };
      }
    }
  } catch {
    return fail();
  }
}

/* ─────────────────────── operating on both sides ─────────────────────── */

/** The four balance operations. `−` and `÷` are the ones that get x alone. */
export type SideOp = "+" | "-" | "*" | "/";

/** Symbol printed on the brick. Kept out of the components so the two agree. */
export const SIDE_OP_SIGNS: Record<SideOp, string> = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
};

const NOT_AN_EQUATION = "צריך משוואה עם סימן = כדי להפעיל פעולה על שני הצדדים.";
const NO_OPERAND = "כתבו מספר או ביטוי לפעולה.";

/**
 * Apply `op operand` to both sides of the equation at once — the balance move.
 * The student never does the arithmetic: each side comes back simplified, so
 * `3x + 7 = 31` minus `7` reads `3x = 24`, not `3x + 7 - 7 = 31 - 7`.
 */
export async function applyBothSides(
  latex: string,
  op: SideOp,
  operand: string,
): Promise<MathResult> {
  if (!latex || !latex.trim()) return fail(EMPTY_ERROR);
  if (!operand || !operand.trim()) return fail(NO_OPERAND);

  let N: Nerdamer;
  try {
    N = await getNerdamer();
  } catch {
    return fail("מנוע החישוב לא נטען. בדקו את החיבור לאינטרנט ורעננו.");
  }

  const sides = splitEquation(latex);
  if (!sides) return fail(NOT_AN_EQUATION);

  try {
    const rhs = latexToExpr(N, operand);
    if (op === "/" && N(rhs).toString() === "0") return fail("אי אפשר לחלק באפס.");
    const moved = sides.map((side) =>
      N(`simplify((${latexToExpr(N, side)}) ${op} (${rhs}))`),
    );
    return {
      latex: `${toTeX(moved[0])}=${toTeX(moved[1])}`,
      plain: `${moved[0].toString()}=${moved[1].toString()}`,
      error: null,
    };
  } catch {
    return fail();
  }
}

/** Hebrew labels for the action buttons, in worksheet order. */
export const OP_LABELS: { op: MathOp; he: string }[] = [
  { op: "evaluate", he: "חשב" },
  { op: "solve", he: "פתור" },
  { op: "simplify", he: "פשט" },
  { op: "factor", he: "פרק לגורמים" },
  { op: "expand", he: "הרחב" },
  { op: "derivative", he: "נגזרת" },
  { op: "integral", he: "אינטגרל" },
];
