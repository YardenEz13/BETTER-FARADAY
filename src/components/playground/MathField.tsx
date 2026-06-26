import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { MathfieldElement } from "mathlive";

// MathLive's glyph fonts (the KaTeX woff2 set) and click sounds. We serve the
// fonts from the version-pinned CDN so they don't have to be copied into
// /public, and disable sounds. Configured once, before any field mounts.
let configured = false;
function configureMathlive() {
  if (configured) return;
  configured = true;
  MathfieldElement.fontsDirectory =
    "https://cdn.jsdelivr.net/npm/mathlive@0.110.0/fonts";
  MathfieldElement.soundsDirectory = null;
}

export interface MathFieldHandle {
  /** Insert LaTeX at the caret (used by the formula bank). */
  insertLatex: (latex: string) => void;
  focus: () => void;
  getValue: () => string;
}

interface Props {
  value: string;
  onChange: (latex: string) => void;
  /** Fired on Enter — the worksheet uses it as "compute / evaluate". */
  onEnter?: () => void;
  placeholder?: string;
}

/**
 * Thin React wrapper over MathLive's <math-field> web component. The element is
 * driven imperatively (value property + 'input' event); the math stays LTR even
 * though it sits inside the RTL panel.
 */
const MathField = forwardRef<MathFieldHandle, Props>(function MathField(
  { value, onChange, onEnter, placeholder },
  ref,
) {
  const elRef = useRef<MathfieldElement | null>(null);
  // Keep the latest callbacks without re-binding listeners each render.
  const onChangeRef = useRef(onChange);
  const onEnterRef = useRef(onEnter);
  onChangeRef.current = onChange;
  onEnterRef.current = onEnter;

  useImperativeHandle(ref, () => ({
    insertLatex: (latex) => elRef.current?.insert(latex, { focus: true }),
    focus: () => elRef.current?.focus(),
    getValue: () => elRef.current?.value ?? "",
  }));

  useEffect(() => {
    configureMathlive();
    const el = elRef.current;
    if (!el) return;

    // "auto" surfaces the virtual keyboard on touch focus (no physical kbd),
    // while leaving desktop typing untouched.
    el.mathVirtualKeyboardPolicy = "auto";

    const onInput = () => onChangeRef.current(el.value);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onEnterRef.current?.();
      }
    };
    el.addEventListener("input", onInput);
    el.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // Sync external value changes (e.g. formula insert / reset) into the element,
  // guarding against the feedback loop with our own 'input' events.
  useEffect(() => {
    const el = elRef.current;
    if (el && el.value !== value) el.value = value;
  }, [value]);

  return (
    <math-field
      ref={elRef}
      dir="ltr"
      placeholder={placeholder}
      className="faraday-mathfield"
      style={{ direction: "ltr" }}
    />
  );
});

export default MathField;
