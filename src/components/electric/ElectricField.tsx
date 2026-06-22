import { useId } from "react";

/**
 * Animated "circuit field" backdrop.
 *
 * A full-bleed, theme-aware SVG meant to sit BEHIND content (hero sections,
 * dashboard headers, empty states). Faint circuit traces with current flowing
 * along them, a few pulsing nodes, and drifting spark particles.
 *
 * Renders decoratively (aria-hidden) and never intercepts pointer events.
 * Honors prefers-reduced-motion via the .electric-field-static class below —
 * see the inline <style>, scoped by the generated id so it can't leak.
 */

export interface ElectricFieldProps {
  /** 0..1 — overall opacity of the backdrop */
  intensity?: number;
  /** how busy the field is */
  density?: "sparse" | "normal" | "dense";
  className?: string;
  style?: React.CSSProperties;
}

const TRACES = [
  "M-20 90 H120 A18 18 0 0 0 138 72 V20 H300",
  "M-20 200 H80 A24 24 0 0 1 104 224 V340",
  "M420 -20 V120 A20 20 0 0 1 400 140 H260 A20 20 0 0 0 240 160 V360",
  "M620 40 H520 A16 16 0 0 0 504 56 V180 A16 16 0 0 1 488 196 H300",
  "M40 360 V260 A22 22 0 0 1 62 238 H180 A22 22 0 0 0 202 216 V40",
];

const NODES = [
  [138, 72], [104, 224], [400, 140], [240, 160], [504, 56], [488, 196], [62, 238], [202, 216],
];

export function ElectricField({ intensity = 0.5, density = "normal", className = "", style }: ElectricFieldProps) {
  const uid = useId().replace(/:/g, "");
  const grad = `g-${uid}`;
  const glow = `glow-${uid}`;
  const traceCount = density === "sparse" ? 3 : density === "dense" ? TRACES.length : 4;
  const traces = TRACES.slice(0, traceCount);
  const nodes = density === "sparse" ? NODES.slice(0, 4) : NODES;

  return (
    <svg
      aria-hidden
      className={`electric-field-${uid} ${className}`}
      viewBox="0 0 600 360"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: intensity,
        ...style,
      }}
    >
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .electric-field-${uid} * { animation: none !important; }
          .electric-field-${uid} [data-current] { stroke-dasharray: none !important; }
        }
      `}</style>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-inverse-primary)" />
          <stop offset="100%" stopColor="var(--color-primary)" />
        </linearGradient>
        <filter id={glow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {/* faint static traces */}
      <g stroke="var(--color-primary)" strokeWidth={1} fill="none" opacity={0.18}>
        {traces.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {/* current flowing along the traces */}
      <g stroke={`url(#${grad})`} strokeWidth={1.6} fill="none" strokeLinecap="round">
        {traces.map((d, i) => (
          <path key={d} d={d} data-current strokeDasharray="2 220">
            <animate attributeName="stroke-dashoffset" from="222" to="0"
              dur={`${5 + i * 0.7}s`} repeatCount="indefinite" />
          </path>
        ))}
      </g>

      {/* pulsing nodes */}
      <g filter={`url(#${glow})`}>
        {nodes.map(([x, y], i) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={2.4} fill="var(--color-inverse-primary)">
            <animate attributeName="opacity" values="0.25;1;0.25"
              dur={`${2.6 + (i % 3) * 0.6}s`} repeatCount="indefinite" begin={`${i * 0.3}s`} />
            <animate attributeName="r" values="2;3.4;2"
              dur={`${2.6 + (i % 3) * 0.6}s`} repeatCount="indefinite" begin={`${i * 0.3}s`} />
          </circle>
        ))}
      </g>

      {/* drifting spark particles */}
      <g fill="var(--color-inverse-primary)" opacity={0.8}>
        {nodes.slice(0, density === "sparse" ? 2 : 4).map(([x, y], i) => (
          <circle key={`p-${x}-${y}`} r={1.3}>
            <animateMotion dur={`${6 + i}s`} repeatCount="indefinite" begin={`${i * 0.8}s`}
              path={`M${x} ${y} q40 -30 90 -10 t100 20`} />
            <animate attributeName="opacity" values="0;0.9;0" dur={`${6 + i}s`} repeatCount="indefinite" begin={`${i * 0.8}s`} />
          </circle>
        ))}
      </g>
    </svg>
  );
}

export default ElectricField;
