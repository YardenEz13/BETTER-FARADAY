// Shared types, palette, and math helpers for the FaradayCanvas variant engine.
// Kept in a leaf module so the variant builders (variants.ts) and the React
// harness (FaradayCanvas.tsx) can both import them without a cycle.

export type FaradayVariant =
  | "atom"
  | "constellation"
  | "circuit"
  | "induction"
  | "linesOfForce"
  | "cage"
  | "effect";

export type Palette = {
  green: string;
  spark: string;
  violet: string;
  amber: string;
  glow: boolean;
};

export const PALETTES: Record<"light" | "dark", Palette> = {
  light: { green: "#17C964", spark: "#10b981", violet: "#7B61FF", amber: "#FFB02E", glow: false },
  dark: { green: "#22D86B", spark: "#5BFF9F", violet: "#9A85FF", amber: "#FFBE52", glow: true },
};

/** hex + alpha → rgba() string */
export function ha(hex: string, a: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export type Mouse = { x: number; y: number; active: boolean };
export type GetP = () => Palette;
/** Per-frame draw; `dispose` releases any GSAP tweens the variant owns. */
export type DrawFn = (() => void) & { dispose?: () => void };
