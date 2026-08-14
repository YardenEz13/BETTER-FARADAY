// Ambient declarations for the Math Playground stack.

// MathLive registers the <math-field> web component. Declare it for JSX/TS.
// We keep the prop surface intentionally small — the component is driven
// imperatively (ref + events) in MathField.tsx.
import type { MathfieldElement } from "mathlive";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement>,
        MathfieldElement
      > & {
        ref?: React.Ref<MathfieldElement>;
        placeholder?: string;
      };
    }
  }
}

export {};
