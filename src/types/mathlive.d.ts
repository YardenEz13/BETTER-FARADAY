// Ambient declarations for the Math Playground stack.

// nerdamer ships no type declarations; we use it structurally as `any`.
declare module "nerdamer/all.min.js" {
  const nerdamer: any;
  export default nerdamer;
}

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
