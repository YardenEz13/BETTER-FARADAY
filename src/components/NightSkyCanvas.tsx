import { useEffect, useRef } from "react";

/**
 * NightSkyCanvas — a lightweight cosmetic starfield backdrop for the learning
 * map (unlocked via the "ערכת נושא לילה" shop theme). Deliberately low-opacity
 * so it sits behind content and stays readable in both light and dark mode.
 * prefers-reduced-motion renders a single static frame (no twinkle drift).
 */
export interface NightSkyCanvasProps {
  className?: string;
  style?: React.CSSProperties;
}

type Star = { x: number; y: number; r: number; base: number; phase: number; speed: number };

export default function NightSkyCanvas({ className, style }: NightSkyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let stars: Star[] = [];
    let w = 0;
    let h = 0;

    const seed = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Density scales with area but is capped so large screens stay cheap.
      const count = Math.min(140, Math.round((w * h) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.4,
        base: 0.25 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.2,
      }));
      return ctx;
    };

    let ctx = seed();

    const draw = (t: number) => {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const twinkle = reduce ? s.base : s.base * (0.55 + 0.45 * Math.sin(t * 0.001 * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        // Violet-white stars — on-brand and legible over both surfaces.
        ctx.fillStyle = `rgba(180,170,255,${twinkle.toFixed(3)})`;
        ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    if (reduce) {
      draw(0);
    } else {
      raf = requestAnimationFrame(draw);
    }

    const onResize = () => {
      ctx = seed();
      if (reduce) draw(0);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", ...style }}
    />
  );
}
