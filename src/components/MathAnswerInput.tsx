import { lazy, Suspense, useRef } from "react";
import MathText from "./MathText";
import MathSymbolStrip from "./playground/MathSymbolStrip";
import type { MathFieldHandle } from "./playground/MathField";

// MathLive is heavy — load it only when a math section actually renders.
const MathField = lazy(() => import("./playground/MathField"));

/**
 * The maths answer field: MathLive editor plus the tap-to-insert symbol strip.
 *
 * Extracted so homework and the exam share one input. They did not: homework
 * got the editor and the strip, while `ExamMode` kept a plain `<textarea>` —
 * so in מצב מתכונת, the higher-stakes screen, there was still no way to enter
 * a square root. The strip is not decoration there either: MathLive's inline
 * shortcut needs the Latin letters "sqrt" and the student is on a Hebrew
 * keyboard layout.
 *
 * Owns its own field handle, so a caller only deals in `value`/`onChange`.
 */

interface Props {
  value: string;
  /** Fires on every keystroke; the LaTeX the editor produced. */
  onChange: (latex: string) => void;
  /** Enter pressed in the field — the worksheet submits on it. */
  onEnter?: () => void;
  /** Focus left the field — the exam saves on it. */
  onBlur?: (latex: string) => void;
  placeholder?: string;
  /** Shown above the field; omit where the surrounding UI already says it. */
  hint?: boolean;
}

export default function MathAnswerInput({
  value, onChange, onEnter, onBlur, placeholder = "התשובה כאן…", hint = true,
}: Props) {
  const fieldRef = useRef<MathFieldHandle | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {hint && (
        <div className="label-mono text-[10px] text-on-surface-variant flex items-center gap-1">
          <MathText>{"$\\sqrt{x}$"}</MathText> עורך נוסחאות — הקלידו ישירות או הקישו על סימן
        </div>
      )}
      <Suspense
        fallback={
          <div className="w-full bg-surface border-2 border-outline rounded-xl px-4 py-3 text-on-surface-variant font-mono text-sm">
            טוען עורך נוסחאות…
          </div>
        }
      >
        <MathField
          ref={fieldRef}
          value={value}
          onChange={onChange}
          onEnter={onEnter}
          onBlur={onBlur}
          placeholder={placeholder}
        />
      </Suspense>
      <MathSymbolStrip fieldRef={fieldRef} />
    </div>
  );
}
