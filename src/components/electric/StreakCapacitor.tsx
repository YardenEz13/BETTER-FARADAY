import { useId } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * StreakCapacitor — the streak stat's icon, drawn as a charging capacitor.
 *
 * Follows the electric icon family grammar (gradient stroke + glow filter,
 * useId-scoped defs) but is a purpose-built charge meter rather than a
 * generic Capacitor: the gap between the plates fills with amber charge
 * bars proportional to `min(days, 7) / 7`, with a small particle riding
 * across the gap when there's any charge. When `atRisk`, the outermost
 * bar pulses (slow opacity breathing) to read as "discharging."
 */
export interface StreakCapacitorProps {
  /** current streak length in days */
  days: number;
  /** rendered size in px (square) */
  size?: number;
  /** streak is about to break today — pulses the outer charge bar */
  atRisk?: boolean;
  className?: string;
  title?: string;
}

const MAX_BARS = 7;

export function StreakCapacitor({ days, size = 18, atRisk = false, className = "", title }: StreakCapacitorProps) {
  const grad = useId();
  const filter = useId();
  const reducedMotion = useReducedMotion();
  const animated = !reducedMotion;

  const charge = Math.max(0, Math.min(days, MAX_BARS));
  const filledBars = Math.round((charge / MAX_BARS) * MAX_BARS);
  const c0 = "color-mix(in srgb, var(--color-tertiary) 50%, white)";
  const c1 = "var(--color-tertiary)";

  // plates at x=27 and x=37 (matches the family's Capacitor glyph), gap 27→37.
  // Bars stack vertically inside the gap, each a short horizontal charge tick.
  const barXs = [29, 30.5, 32, 33.5, 35, 36.5].slice(0, MAX_BARS - 1);
  const barCount = MAX_BARS - 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c0} />
          <stop offset="100%" stopColor={c1} />
        </linearGradient>
        <filter id={filter} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={2.2} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* leads + plates */}
      <path
        d="M4 32 H27 M27 16 V48 M37 16 V48 M37 32 H60"
        stroke={`url(#${grad})`}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
        filter={`url(#${filter})`}
      />

      {/* charge bars between the plates, filling proportionally to days/7 */}
      {barXs.slice(0, barCount).map((x, i) => {
        const isFilled = i < filledBars;
        const isOutermost = i === barCount - 1;
        return (
          <line
            key={x}
            x1={x}
            y1={22}
            x2={x}
            y2={42}
            stroke={c1}
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={isFilled ? 0.9 : 0.12}
            filter={isFilled ? `url(#${filter})` : undefined}
          >
            {isFilled && isOutermost && atRisk && animated && (
              <animate attributeName="opacity" values="0.9;0.25;0.9" dur="1.8s" repeatCount="indefinite" />
            )}
          </line>
        );
      })}

      {/* animated charge particle riding across the gap when there's any charge */}
      {charge > 0 && animated && (
        <circle cy="32" r="2.4" fill={c0} filter={`url(#${filter})`}>
          <animate attributeName="cx" values="27;37" dur="1.3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;0" dur="1.3s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

export default StreakCapacitor;
