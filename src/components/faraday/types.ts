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

/** hex + alpha → rgba() string (rgb triple memoized — called thousands of times per frame) */
const rgbCache = new Map<string, string>();
export function ha(hex: string, a: number): string {
  let rgb = rgbCache.get(hex);
  if (!rgb) {
    const n = parseInt(hex.replace("#", ""), 16);
    rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    rgbCache.set(hex, rgb);
  }
  return `rgba(${rgb},${a})`;
}

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Sprite-cached glow dot. `ctx.shadowBlur` re-runs a Gaussian blur on every
 * fill — with the dark palette's bigger blurs it was the single largest
 * per-frame cost. Each halo is rendered once to an offscreen canvas and then
 * stamped with drawImage, which is close to free.
 */
const glowSprites = new Map<string, HTMLCanvasElement>();
export function glowDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  blur: number,
  alpha = 1,
) {
  if (alpha < 1) ctx.globalAlpha = alpha;
  // quantize so continuously-varying radii/blurs reuse a small sprite set
  const b = Math.round(blur);
  const rq = Math.round(r * 2) / 2;
  if (b >= 1) {
    const key = `${color}|${rq}|${b}`;
    let s = glowSprites.get(key);
    if (!s) {
      s = document.createElement("canvas");
      const R = rq + b * 1.6;
      const size = Math.ceil(R * 2);
      s.width = size;
      s.height = size;
      const g = s.getContext("2d");
      if (g) {
        const grad = g.createRadialGradient(R, R, rq * 0.4, R, R, R);
        grad.addColorStop(0, ha(color, 0.5));
        grad.addColorStop(1, ha(color, 0));
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
      }
      glowSprites.set(key, s);
    }
    ctx.drawImage(s, x - s.width / 2, y - s.height / 2);
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (alpha < 1) ctx.globalAlpha = 1;
}

/**
 * Alpha-bucketed segment batching. Per-pair beginPath/stroke calls dominated
 * the O(N²) link passes; instead segments are grouped into a handful of
 * Path2D buckets by alpha and stroked once per bucket.
 */
const BUCKETS = 8;
export function makeBuckets(): Path2D[] {
  return Array.from({ length: BUCKETS }, () => new Path2D());
}
/** t in [0,1] — relative alpha of this segment within the batch */
export function addSeg(buckets: Path2D[], x1: number, y1: number, x2: number, y2: number, t: number) {
  const bi = Math.min(BUCKETS - 1, Math.max(0, (t * BUCKETS) | 0));
  buckets[bi].moveTo(x1, y1);
  buckets[bi].lineTo(x2, y2);
}
export function strokeBuckets(
  ctx: CanvasRenderingContext2D,
  buckets: Path2D[],
  color: string,
  maxAlpha: number,
  lineWidth: number,
) {
  ctx.lineWidth = lineWidth;
  for (let i = 0; i < BUCKETS; i++) {
    ctx.strokeStyle = ha(color, ((i + 0.5) / BUCKETS) * maxAlpha);
    ctx.stroke(buckets[i]);
  }
}

export type Mouse = { x: number; y: number; active: boolean };
export type GetP = () => Palette;
/** Per-frame draw; `dispose` releases any GSAP tweens the variant owns. */
export type DrawFn = (() => void) & { dispose?: () => void };
