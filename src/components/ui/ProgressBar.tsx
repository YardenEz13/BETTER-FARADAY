import type { HTMLAttributes } from "react";

export type ProgressBarVariant = "primary" | "gradient" | "tertiary";

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
};

/** Rounded clay progress bar over .progress-track / .progress-fill*. */
export function ProgressBar({ value, variant = "primary", color, size = "md", label, className = "", ...rest }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`progress-track ${size === "sm" ? "h-2" : ""} ${className}`}
      {...rest}
    >
      <div className={FILL_CLASS[variant]} style={{ width: `${pct}%`, ...(color ? { background: color } : undefined) }} />
    </div>
  );
}

export default ProgressBar;
