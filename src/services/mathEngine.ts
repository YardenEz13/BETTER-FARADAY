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

const ok = (expr: any): MathResult => ({
  latex: expr.toTeX(),
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
        const sols = N.solveEquations
          ? N.solveEquations(`${exprStr}=0`, v)
          : N(`solve(${exprStr}, ${v})`);
        const arr: any[] = Array.isArray(sols) ? sols : [sols];
        if (arr.length === 0) return fail("לא נמצאו פתרונות ממשיים.");
        // x_1 = …, x_2 = … — the reusable fragment is the first solution.
        const parts = arr.map((s, i) => {
          const e = N(s.toString());
          return `${v}_{${i + 1}}=${e.toTeX()}`;
        });
        const first = N(arr[0].toString());
        return {
          latex: parts.join(",\\;\\;"),
          plain: arr.map((s) => s.toString()).join(", "),
          reuseLatex: first.toTeX(),
          approx: arr.length === 1 ? approxOf(N, first) : undefined,
          error: null,
        };
      }
      case "simplify":
        return ok(N(`simplify(${latexToExpr(N, latex)})`));
      case "factor":
        return ok(N(`factor(${latexToExpr(N, latex)})`));
      case "expand":
        return ok(N(`expand(${latexToExpr(N, latex)})`));
      case "derivative": {
        const exprStr = latexToExpr(N, latex);
        const v = pickVariable(N, exprStr, variable);
        const src = N(exprStr);
        const out = N(`diff(${exprStr}, ${v})`);
        return {
          latex: `\\frac{d}{d${v}}\\left(${src.toTeX()}\\right)=${out.toTeX()}`,
          plain: out.toString(),
          reuseLatex: out.toTeX(),
          error: null,
        };
      }
      case "integral": {
        const exprStr = latexToExpr(N, latex);
        const v = pickVariable(N, exprStr, variable);
        const src = N(exprStr);
        const out = N(`integrate(${exprStr}, ${v})`);
        return {
          latex: `\\int ${src.toTeX()}\\,d${v}=${out.toTeX()}+C`,
          plain: out.toString(),
          reuseLatex: out.toTeX(),
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
