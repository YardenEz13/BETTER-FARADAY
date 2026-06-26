// ── נוסחאות bank for the Math Playground ──
// Categorised formula sheet. `latex` is shown (KaTeX) in the drawer; clicking an
// item inserts `insertLatex` (defaults to `latex`) into the active math field.

export interface FormulaItem {
  id: string;
  nameHe: string;
  latex: string;
  /** What lands in the field on click; defaults to `latex`. */
  insertLatex?: string;
}

export interface FormulaCategory {
  id: string;
  titleHe: string;
  items: FormulaItem[];
}

export const FORMULA_BANK: FormulaCategory[] = [
  {
    id: "algebra",
    titleHe: "אלגברה וסדרות",
    items: [
      { id: "quadratic", nameHe: "נוסחת השורשים", latex: "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}" },
      { id: "arith-n", nameHe: "איבר כללי — סדרה חשבונית", latex: "a_n=a_1+(n-1)d" },
      { id: "arith-sum", nameHe: "סכום סדרה חשבונית", latex: "S_n=\\frac{n(a_1+a_n)}{2}" },
      { id: "geo-n", nameHe: "איבר כללי — סדרה הנדסית", latex: "a_n=a_1\\cdot q^{\\,n-1}" },
      { id: "geo-sum", nameHe: "סכום סדרה הנדסית", latex: "S_n=a_1\\cdot\\frac{q^{\\,n}-1}{q-1}" },
      { id: "geo-inf", nameHe: "סכום סדרה הנדסית אינסופית", latex: "S=\\frac{a_1}{1-q}" },
      { id: "diff-squares", nameHe: "הפרש ריבועים", latex: "a^2-b^2=(a-b)(a+b)" },
      { id: "log-mul", nameHe: "חוק הלוגריתם — מכפלה", latex: "\\log_b(xy)=\\log_b x+\\log_b y" },
    ],
  },
  {
    id: "trig",
    titleHe: "טריגונומטריה",
    items: [
      { id: "pyth-id", nameHe: "זהות פיתגורס", latex: "\\sin^2\\alpha+\\cos^2\\alpha=1" },
      { id: "tan", nameHe: "טנגנס", latex: "\\tan\\alpha=\\frac{\\sin\\alpha}{\\cos\\alpha}" },
      { id: "sine-rule", nameHe: "משפט הסינוסים", latex: "\\frac{a}{\\sin A}=\\frac{b}{\\sin B}=\\frac{c}{\\sin C}" },
      { id: "cosine-rule", nameHe: "משפט הקוסינוסים", latex: "c^2=a^2+b^2-2ab\\cos C" },
      { id: "double-sin", nameHe: "זווית כפולה — סינוס", latex: "\\sin 2\\alpha=2\\sin\\alpha\\cos\\alpha" },
      { id: "tri-area", nameHe: "שטח משולש", latex: "S=\\tfrac{1}{2}ab\\sin C" },
    ],
  },
  {
    id: "geometry",
    titleHe: "גאומטריה ואנליטית",
    items: [
      { id: "distance", nameHe: "מרחק בין שתי נקודות", latex: "d=\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}" },
      { id: "midpoint", nameHe: "אמצע קטע", latex: "M=\\left(\\frac{x_1+x_2}{2},\\,\\frac{y_1+y_2}{2}\\right)" },
      { id: "slope", nameHe: "שיפוע ישר", latex: "m=\\frac{y_2-y_1}{x_2-x_1}" },
      { id: "line", nameHe: "משוואת ישר", latex: "y-y_1=m(x-x_1)" },
      { id: "circle", nameHe: "משוואת מעגל", latex: "(x-a)^2+(y-b)^2=r^2" },
      { id: "circle-area", nameHe: "שטח עיגול", latex: "S=\\pi r^2" },
    ],
  },
  {
    id: "calculus",
    titleHe: "חשבון דיפרנציאלי ואינטגרלי",
    items: [
      { id: "power-diff", nameHe: "נגזרת חזקה", latex: "(x^n)'=n\\,x^{\\,n-1}" },
      { id: "product", nameHe: "כלל המכפלה", latex: "(uv)'=u'v+uv'" },
      { id: "quotient", nameHe: "כלל המנה", latex: "\\left(\\frac{u}{v}\\right)'=\\frac{u'v-uv'}{v^2}" },
      { id: "chain", nameHe: "כלל השרשרת", latex: "\\big(f(g(x))\\big)'=f'(g(x))\\cdot g'(x)" },
      { id: "power-int", nameHe: "אינטגרל חזקה", latex: "\\int x^n\\,dx=\\frac{x^{\\,n+1}}{n+1}+C" },
      { id: "def-int", nameHe: "אינטגרל מסוים (שטח)", latex: "\\int_a^b f(x)\\,dx" },
    ],
  },
];
