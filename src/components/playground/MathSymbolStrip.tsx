import { memo } from "react";
import MathText from "../MathText";
import { Keyboard } from "../electric";
import type { MathFieldHandle } from "./MathField";

/**
 * Tap-to-insert symbols for the answer field.
 *
 * Not a convenience — the only route to a square root before this. MathLive's
 * inline shortcut needs the student to type the Latin letters "sqrt", and an
 * Israeli student is on a Hebrew keyboard layout; the virtual keypad only
 * auto-opens on touch (`mathVirtualKeyboardPolicy: "auto"`), so on a school
 * desktop there was no way to enter √ at all. That is the "can't do root
 * comfortably" complaint, and it is a missing button, not a preference.
 *
 * `latex` goes into the field, `label` is what the chip shows (rendered with
 * KaTeX where a glyph beats a word).
 */

interface Symbol {
  label: string;
  latex: string;
  /** Render the label as maths rather than plain text. */
  math?: boolean;
  title: string;
}

const SYMBOLS: Symbol[] = [
  { label: "\\sqrt{\\square}", latex: "\\sqrt{#?}", math: true, title: "שורש ריבועי" },
  { label: "\\sqrt[n]{\\square}", latex: "\\sqrt[#?]{#?}", math: true, title: "שורש מסדר n" },
  { label: "\\square^2", latex: "#@^2", math: true, title: "בריבוע" },
  { label: "\\square^n", latex: "#@^{#?}", math: true, title: "בחזקת n" },
  { label: "\\frac{a}{b}", latex: "\\frac{#@}{#?}", math: true, title: "שבר" },
  { label: "\\pi", latex: "\\pi", math: true, title: "פאי" },
  { label: "\\pm", latex: "\\pm", math: true, title: "פלוס מינוס" },
  { label: "\\le", latex: "\\le", math: true, title: "קטן או שווה" },
  { label: "\\ge", latex: "\\ge", math: true, title: "גדול או שווה" },
  { label: "\\ne", latex: "\\ne", math: true, title: "שונה מ" },
  { label: "\\infty", latex: "\\infty", math: true, title: "אינסוף" },
  { label: "|\\square|", latex: "\\left|#?\\right|", math: true, title: "ערך מוחלט" },
  { label: "\\sin", latex: "\\sin", math: true, title: "סינוס" },
  { label: "\\cos", latex: "\\cos", math: true, title: "קוסינוס" },
  { label: "\\tan", latex: "\\tan", math: true, title: "טנגנס" },
  { label: "\\log", latex: "\\log", math: true, title: "לוגריתם" },
  { label: "°", latex: "^{\\circ}", title: "מעלות" },
];

interface Props {
  /** The field to insert into. */
  fieldRef: React.RefObject<MathFieldHandle | null>;
  className?: string;
}

/* MathLive's insert() tokens: `#?` is a placeholder the caret lands in, `#@`
   is the selection (or the atom before the caret) so x then ² gives x². */

function MathSymbolStrip({ fieldRef, className = "" }: Props) {
  return (
    <div
      dir="ltr"
      role="toolbar"
      aria-label="סימנים מתמטיים"
      className={`flex flex-wrap gap-1.5 ${className}`}
    >
      {SYMBOLS.map((sym) => (
        <button
          key={sym.latex}
          type="button"
          title={sym.title}
          aria-label={sym.title}
          // Keep the caret in the field: a focus change would drop the
          // insertion point and MathLive would append at the end instead.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => fieldRef.current?.insertLatex(sym.latex)}
          className="min-w-[42px] min-h-[38px] px-2.5 flex items-center justify-center rounded-xl bg-surface border-2 border-outline text-on-surface hover:border-primary hover:text-primary active:translate-y-0.5 transition-all cursor-pointer shadow-(--shadow-clay)"
        >
          {sym.math
            ? <MathText className="pointer-events-none">{`$${sym.label}$`}</MathText>
            : <span className="pointer-events-none text-body-md font-semibold">{sym.label}</span>}
        </button>
      ))}
      {/* The full keypad. `mathVirtualKeyboardPolicy: "auto"` only opens it on
          touch, so on a desktop this button is the only way to reach it. */}
      <button
        type="button"
        title="מקלדת מתמטית"
        aria-label="מקלדת מתמטית"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => fieldRef.current?.toggleKeyboard()}
        className="min-w-[42px] min-h-[38px] px-2.5 flex items-center justify-center rounded-xl bg-primary/10 border-2 border-primary/40 text-primary hover:bg-primary/20 active:translate-y-0.5 transition-all cursor-pointer shadow-(--shadow-clay)"
      >
        <Keyboard size={17} />
      </button>
    </div>
  );
}

export default memo(MathSymbolStrip);
