import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeContext";
import { type FaradayVariant, type Palette, PALETTES } from "./faraday/types";
import { makeVariant } from "./faraday/variants";

/**
 * FaradayCanvas — the shared, mouse-reactive Canvas2D background engine.
 *
 * Every "Live Wire" screen drops one of these behind a z-indexed UI overlay.
 * The variant draw() builders live in ./faraday/variants; the shared palette,
 * types, and helpers in ./faraday/types. This file owns the single
 * requestAnimationFrame loop and the canvas lifecycle.
 *
 * Contract (from the handoff):
 *  - Canvas sizes to its *parent* container (dpr-aware, capped at 2).
 *  - Pointer events are read off the parent element, not the canvas, because
 *    the UI overlay sits above the canvas and swallows them.
 *  - Theme changes swap the palette live — no teardown of the RAF loop.
 *  - prefers-reduced-motion renders a single static frame.
 *  - Canvas is aria-hidden; all interactive UI lives in the DOM overlay.
 */

// Re-exported so existing `import { FaradayVariant } from "./FaradayCanvas"`
// paths keep resolving after the type moved into ./faraday/types.
export type { FaradayVariant };

export interface FaradayCanvasProps {
  variant: FaradayVariant;
  /** Overrides the app theme; defaults to the global ThemeContext. */
  theme?: "light" | "dark";
  className?: string;
  style?: React.CSSProperties;
}

export default function FaradayCanvas({ variant, theme: themeProp, className, style }: FaradayCanvasProps) {
  const { theme: ctxTheme } = useTheme();
  const theme = themeProp ?? ctxTheme;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef<Palette>(PALETTES[theme]);

  // Live theme swap — update the palette the loop reads, no teardown.
  useEffect(() => {
    paletteRef.current = PALETTES[theme];
  }, [theme]);

  // Set up the canvas + RAF loop. Re-runs on variant change and on resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let teardown: (() => void) | null = null;

    const start = () => {
      // Measure the canvas's OWN box, not the parent's. For a `fixed` canvas
      // this is the viewport; for an `absolute` one it's the parent. Either way
      // the backing store matches the displayed size exactly — no distortion.
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      // Pointer Events cover mouse, touch and pen with one code path, so the
      // canvas is reactive on phones too (a finger drag drives the same
      // parallax/ripple/field-bend a cursor does on desktop). We never call
      // preventDefault, so page scrolling is unaffected.
      const mouse = { x: w / 2, y: h / 2, active: false };
      const onMove = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
        mouse.active = true;
      };
      const onLeave = () => {
        mouse.active = false;
      };
      parent.addEventListener("pointermove", onMove);
      // A tap should activate the effect even without a prior move (touch has
      // no hover); lifting/cancelling the touch releases it.
      parent.addEventListener("pointerdown", onMove);
      parent.addEventListener("pointerup", onLeave);
      parent.addEventListener("pointercancel", onLeave);
      parent.addEventListener("pointerleave", onLeave);

      const draw = makeVariant(variant, ctx, w, h, mouse, () => paletteRef.current);
      if (reduce) {
        draw();
      } else {
        const loop = () => {
          draw();
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }

      teardown = () => {
        cancelAnimationFrame(raf);
        draw.dispose?.();
        parent.removeEventListener("pointermove", onMove);
        parent.removeEventListener("pointerdown", onMove);
        parent.removeEventListener("pointerup", onLeave);
        parent.removeEventListener("pointercancel", onLeave);
        parent.removeEventListener("pointerleave", onLeave);
      };
    };

    start();

    // Re-initialize on meaningful canvas resize (debounced by size delta).
    // Observing the canvas itself catches both parent-driven resizes (absolute)
    // and viewport resizes (a fixed, 100%-sized canvas reflows with the window).
    let prevW = Math.round(canvas.getBoundingClientRect().width);
    let prevH = Math.round(canvas.getBoundingClientRect().height);
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      const nw = Math.round(r.width), nh = Math.round(r.height);
      if (Math.abs(nw - prevW) < 2 && Math.abs(nh - prevH) < 2) return;
      prevW = nw;
      prevH = nh;
      teardown?.();
      start();
    });
    ro.observe(canvas);

    return () => {
      ro.disconnect();
      teardown?.();
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", ...style }}
    />
  );
}
