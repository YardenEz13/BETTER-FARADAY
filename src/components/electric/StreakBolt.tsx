import { useId } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * StreakBolt — the streak stat's icon, drawn as a *striking* lightning bolt.
 *
 * Replaces the old static charging-capacitor glyph: a bolt that fills from the
 * bottom up with amber charge proportional to `min(days, 7) / 7`, with a spark
 * racing down the bolt's path and an irregular strike-flash on the halo so it
 * reads as live lightning rather than a parked component. When `atRisk` the
 * charge flickers hard (a bolt about to go dark).
 *
 * Follows the electric icon family grammar (gradient stroke + glow filter,
 * useId-scoped defs) and shares ElectricBolt's silhouette.
 */
export interface StreakBoltProps {
  /** current streak length in days */
  days: number;
  /** rendered size in px (square) */
  size?: number;
  /** streak is about to break today — flickers the charge */
  atRisk?: boolean;
  className?: string;
  title?: string;
}

const MAX_DAYS = 7;
/** same silhouette as ElectricBolt, so the family stays coherent */
const BOLT = "M37 5 L17 35 H30 L25 59 L49 27 H35 Z";

export function StreakBolt({ days, size = 18, atRisk = false, className = "", title }: StreakBoltProps) {
  const grad = useId();
  const filter = useId();
  const clip = useId();
  const reducedMotion = useReducedMotion();
  const animated = !reducedMotion;

  const frac = Math.max(0, Math.min(days, MAX_DAYS)) / MAX_DAYS;
  // Fill rises from the bolt's tail (y=64) toward its tip (y=0).
  const fillTop = 64 - 64 * frac;
  const c0 = "color-mix(in srgb, var(--color-tertiary) 50%, white)";
  const c1 = "var(--color-tertiary)";

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
        <linearGradient id={grad} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c0} />
        </linearGradient>
        <filter id={filter} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={2.4} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={clip}>
          <rect x="0" y={fillTop} width="64" height={64 - fillTop} />
        </clipPath>
      </defs>

      {/* empty bolt outline */}
      <path d={BOLT} stroke={c1} strokeWidth={2.2} strokeLinejoin="round" opacity={0.22} />

      {/* charged portion, clipped to the fill level */}
      {frac > 0 && (
        <g clipPath={`url(#${clip})`}>
          <path
            d={BOLT}
            stroke={`url(#${grad})`}
            strokeWidth={2.4}
            strokeLinejoin="round"
            fill={`color-mix(in srgb, ${c1} 22%, transparent)`}
            filter={`url(#${filter})`}
          >
            {animated && (
              /* irregular keyTimes = strike flicker, not a sine-wave breathe */
              <animate
                attributeName="opacity"
                values={atRisk ? "1;0.25;1;0.35;1" : "1;0.55;1;0.85;1"}
                keyTimes="0;0.06;0.12;0.18;1"
                dur={atRisk ? "1.6s" : "2.8s"}
                repeatCount="indefinite"
              />
            )}
          </path>
        </g>
      )}

      {/* spark racing down the bolt */}
      {frac > 0 && animated && (
        <circle r="2.6" fill={c0} filter={`url(#${filter})`}>
          <animateMotion path={BOLT} dur="1.1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;0" dur="1.1s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

export default StreakBolt;
