import type { HTMLAttributes } from "react";
import { useReducedMotion } from "framer-motion";
import SparkBurst from "../electric/SparkBurst";

export type ProgressBarVariant = "primary" | "gradient" | "tertiary" | "current";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0–100. Clamped. */
  value: number;
  variant?: ProgressBarVariant;
  /** Custom fill color (CSS color / var). Overrides `variant` — for dynamic
      heat colors like accColor(pct). */
  color?: string;
  size?: "sm" | "md";
  /** Accessible name for the bar. */
  label?: string;
}

const FILL_CLASS: Record<ProgressBarVariant, string> = {
  primary: "progress-fill",
  gradient: "progress-fill-gradient",
  tertiary: "progress-fill-tertiary",
  current: "progress-fill-current",
};

/** Rounded clay progress bar over .progress-track / .progress-fill*.
 *
 * The "current" (electric) variant shows a flowing-current light overlay on the
 * fill, and fires a one-shot SparkBurst when it reaches 100 — an on-brand
 * "fully charged" flourish. Both are gated on prefers-reduced-motion. */
export function ProgressBar({ value, variant = "primary", color, size = "md", label, className = "", ...rest }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const reducedMotion = !!useReducedMotion();
  const isCurrent = variant === "current";
  const charged = isCurrent && pct >= 100 && !reducedMotion;

  const track = (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`progress-track ${size === "sm" ? "h-2" : ""} ${className}`}
      {...rest}
    >
      <div className={FILL_CLASS[variant]} style={{ width: `${pct}%`, ...(color ? { background: color } : undefined) }}>
        {isCurrent && !reducedMotion && <span className="progress-current-glow" aria-hidden />}
      </div>
    </div>
  );

  // The SparkBurst needs a non-clipping, positioned host — the track itself has
  // overflow:hidden — so wrap only when a burst is actually rendered.
  if (charged) {
    return (
      <div className="relative">
        {track}
        <SparkBurst rays={10} />
      </div>
    );
  }
  return track;
}

export default ProgressBar;
