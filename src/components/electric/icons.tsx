import { useId } from "react";

/**
 * Electric / physics icon family.
 *
 * Every icon is a self-contained, theme-aware inline SVG. Colors reference the
 * app's CSS variables, so the icons recolor themselves when the theme flips —
 * no per-theme assets.
 *
 * Shared visual grammar:
 *   - a light->base gradient stroke (the "tone")
 *   - a blurred duplicate underneath = neon halo ("glow" filter)
 *   - optional animated current (stroke-dashoffset / animateMotion)
 *
 * IDs are scoped per-instance with useId(), so the same icon can appear many
 * times on a page without <defs> collisions.
 */

/** Color families, each a [light-stop, base-stop] pair. */
export type ElectricTone = "spark" | "violet" | "amber" | "danger" | "ghost";

const TONES: Record<ElectricTone, [string, string]> = {
  spark: ["var(--color-inverse-primary)", "var(--color-primary)"],
  violet: ["color-mix(in srgb, var(--color-secondary) 50%, white)", "var(--color-secondary)"],
  amber: ["color-mix(in srgb, var(--color-tertiary) 50%, white)", "var(--color-tertiary)"],
  danger: ["color-mix(in srgb, var(--color-error) 50%, white)", "var(--color-error)"],
  // "ghost" = white, for use on filled/colored (e.g. green primary) backgrounds
  ghost: ["#ffffff", "rgba(255,255,255,0.88)"],
};

export interface ElectricIconProps {
  /** rendered size in px (square) */
  size?: number;
  /** animate "current" flowing through the strokes */
  animated?: boolean;
  /** halo strength: 0 = flat line art, 1 = full neon */
  glow?: number;
  /** color family — defaults to the green "spark" palette */
  tone?: ElectricTone;
  className?: string;
  /** accessible label; omit for decorative icons (defaults to aria-hidden) */
  title?: string;
}

/** Shared <defs>: tone gradient + glow filter, scoped to one instance. */
function Defs({ grad, filter, glow, c0, c1 }: { grad: string; filter: string; glow: number; c0: string; c1: string }) {
  return (
    <defs>
      <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={c0} />
        <stop offset="100%" stopColor={c1} />
      </linearGradient>
      <filter id={filter} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation={2.6 * glow} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

function svgProps(size: number, className: string, title?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    fill: "none" as const,
    className,
    role: title ? ("img" as const) : undefined,
    "aria-label": title,
    "aria-hidden": title ? undefined : true,
  };
}

/* ------------------------------------------------------------------ Bolt */

export function ElectricBolt({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  const d = "M37 5 L17 35 H30 L25 59 L49 27 H35 Z";
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      {glow > 0 && (
        <path d={d} stroke={c0} strokeWidth={3} strokeLinejoin="round"
          opacity={0.45 * glow} filter={`url(#${filter})`} />
      )}
      <path d={d} stroke={`url(#${grad})`} strokeWidth={2} strokeLinejoin="round"
        fill={`color-mix(in srgb, ${c1} 14%, transparent)`}
        strokeDasharray={animated ? 170 : undefined}>
        {animated && (
          <animate attributeName="stroke-dashoffset" from="170" to="0" dur="1.4s" repeatCount="indefinite" />
        )}
      </path>
    </svg>
  );
}

/* ------------------------------------------------------------------ Atom */

export function ElectricAtom({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <g stroke={`url(#${grad})`} strokeWidth={1.6} filter={glow > 0 ? `url(#${filter})` : undefined}>
        {[0, 60, 120].map((deg) => (
          <ellipse key={deg} cx="32" cy="32" rx="26" ry="10"
            transform={`rotate(${deg} 32 32)`} opacity={0.9} />
        ))}
      </g>
      {/* nucleus */}
      <circle cx="32" cy="32" r="4.5" fill={c0}
        filter={glow > 0 ? `url(#${filter})` : undefined} />
      {/* an electron riding one orbit */}
      {animated && (
        <circle r="2.6" fill={c0}>
          <animateMotion dur="3s" repeatCount="indefinite"
            path="M6 32 A26 10 0 1 1 58 32 A26 10 0 1 1 6 32" rotate="auto" />
        </circle>
      )}
    </svg>
  );
}

/* ----------------------------------------------------------- Circuit node */

export function CircuitNode({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  const trace = "M4 32 H20 A6 6 0 0 1 26 26 H38 A6 6 0 0 0 44 20 V4 M44 32 H60 M32 60 V40 A6 6 0 0 1 38 34 H60";
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <path d={trace} stroke={`url(#${grad})`} strokeWidth={2} strokeLinecap="round"
        filter={glow > 0 ? `url(#${filter})` : undefined}
        strokeDasharray={animated ? "6 10" : undefined}>
        {animated && (
          <animate attributeName="stroke-dashoffset" from="160" to="0" dur="2.2s" repeatCount="indefinite" />
        )}
      </path>
      {[[4, 32], [60, 32], [32, 60], [44, 4], [60, 34]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill={c0}
          filter={glow > 0 ? `url(#${filter})` : undefined} />
      ))}
    </svg>
  );
}

/* ----------------------------------------------------------- Signal wave */

export function SignalWave({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  // two periods of a sine, sampled as a smooth path
  const d = "M2 32 Q10 8 18 32 T34 32 T50 32 T66 32";
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      {glow > 0 && (
        <path d={d} stroke={c0} strokeWidth={3} fill="none"
          opacity={0.4 * glow} filter={`url(#${filter})`} />
      )}
      <path d={d} stroke={`url(#${grad})`} strokeWidth={2} fill="none" strokeLinecap="round"
        strokeDasharray={animated ? 12 : undefined}>
        {animated && (
          <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.9s" repeatCount="indefinite" />
        )}
      </path>
    </svg>
  );
}

/* ------------------------------------------------------------ Field lines */

export function FieldLines({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  // dipole-ish field loops between two poles
  const loops = [10, 18, 26];
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <g stroke={`url(#${grad})`} strokeWidth={1.5} fill="none"
        filter={glow > 0 ? `url(#${filter})` : undefined}>
        {loops.map((r) => (
          <g key={r} opacity={1 - (r - 10) / 40}>
            <path d={`M32 14 C${32 - r} ${22}, ${32 - r} ${42}, 32 50`} />
            <path d={`M32 14 C${32 + r} ${22}, ${32 + r} ${42}, 32 50`} />
          </g>
        ))}
      </g>
      {/* poles */}
      <circle cx="32" cy="14" r="3.4" fill={c0} filter={glow > 0 ? `url(#${filter})` : undefined} />
      <circle cx="32" cy="50" r="3.4" fill={c1} filter={glow > 0 ? `url(#${filter})` : undefined} />
      {animated && (
        <circle r="2" fill={c0}>
          <animateMotion dur="2.4s" repeatCount="indefinite"
            path="M32 14 C58 22, 58 42, 32 50" />
        </circle>
      )}
    </svg>
  );
}

/* -------------------------------------------------------------- Resistor */

export function Resistor({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  const d = "M3 32 H14 L19 20 L27 44 L35 20 L43 44 L49 32 H61";
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <path d={d} stroke={`url(#${grad})`} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
        filter={glow > 0 ? `url(#${filter})` : undefined}
        strokeDasharray={animated ? "6 10" : undefined}>
        {animated && (
          <animate attributeName="stroke-dashoffset" from="120" to="0" dur="1.8s" repeatCount="indefinite" />
        )}
      </path>
      {[[3, 32], [61, 32]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill={c0}
          filter={glow > 0 ? `url(#${filter})` : undefined} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------- Capacitor */

export function Capacitor({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  const d = "M4 32 H27 M27 16 V48 M37 16 V48 M37 32 H60";
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <path d={d} stroke={`url(#${grad})`} strokeWidth={2.4} strokeLinecap="round" fill="none"
        filter={glow > 0 ? `url(#${filter})` : undefined} />
      {/* charge crossing the gap */}
      {animated && (
        <circle cy="32" r="2.6" fill={c0}>
          <animate attributeName="cx" values="4;25" dur="1.3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;0" dur="1.3s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

/* --------------------------------------------------------------- Battery */

export function Battery({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  void animated;
  const d = "M4 32 H22 M22 16 V48 M30 23 V41 M38 16 V48 M46 23 V41 M54 16 V48 M54 32 H60";
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <path d={d} stroke={`url(#${grad})`} strokeWidth={2.4} strokeLinecap="round" fill="none"
        filter={glow > 0 ? `url(#${filter})` : undefined} />
      {/* terminal plus mark */}
      <path d="M14 12 H22 M18 8 V16" stroke={c1} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------------------------------- Inductor / coil */

export function Inductor({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  const d = "M3 38 H10 A7 7 0 1 1 24 38 A7 7 0 1 1 38 38 A7 7 0 1 1 52 38 H61";
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <path d={d} stroke={`url(#${grad})`} strokeWidth={2.4} strokeLinecap="round" fill="none"
        filter={glow > 0 ? `url(#${filter})` : undefined}
        strokeDasharray={animated ? "6 10" : undefined}>
        {animated && (
          <animate attributeName="stroke-dashoffset" from="160" to="0" dur="2s" repeatCount="indefinite" />
        )}
      </path>
      {[[3, 38], [61, 38]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill={c0}
          filter={glow > 0 ? `url(#${filter})` : undefined} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------ Lightbulb */

export function Lightbulb({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  const bulb = "M32 6 C20 6 12 14 12 25 C12 33 17 38 21 43 V48 H43 V43 C47 38 52 33 52 25 C52 14 44 6 32 6 Z";
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <path d={bulb} stroke={`url(#${grad})`} strokeWidth={2.2} strokeLinejoin="round"
        fill={`color-mix(in srgb, ${c1} 12%, transparent)`}
        filter={glow > 0 ? `url(#${filter})` : undefined} />
      {/* filament */}
      <path d="M25 30 L29 24 L32 32 L35 24 L39 30" stroke={c0} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
        filter={glow > 0 ? `url(#${filter})` : undefined}>
        {animated && (
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" />
        )}
      </path>
      {/* base */}
      <g stroke={`url(#${grad})`} strokeWidth={2.2} strokeLinecap="round">
        <path d="M24 53 H40" />
        <path d="M26 58 H38" />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------- Gauge / meter */

export function Gauge({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <path d="M8 44 A26 26 0 0 1 56 44" stroke={`url(#${grad})`} strokeWidth={2.6}
        strokeLinecap="round" fill="none" filter={glow > 0 ? `url(#${filter})` : undefined} />
      <g stroke={`url(#${grad})`} strokeWidth={2} strokeLinecap="round" opacity={0.7}>
        <path d="M13 32 L17 35" />
        <path d="M32 19 V24" />
        <path d="M51 32 L47 35" />
      </g>
      {/* needle */}
      <g>
        {animated && (
          <animateTransform attributeName="transform" type="rotate"
            values="-46 32 44; 46 32 44; -46 32 44" dur="3.2s" repeatCount="indefinite" />
        )}
        <path d="M32 44 L32 24" stroke={c1} strokeWidth={2.6} strokeLinecap="round"
          filter={glow > 0 ? `url(#${filter})` : undefined} />
      </g>
      <circle cx="32" cy="44" r="3.6" fill={c0} filter={glow > 0 ? `url(#${filter})` : undefined} />
    </svg>
  );
}

/* ---------------------------------------------------------------- Magnet */

export function Magnet({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <path d="M16 50 V30 A16 16 0 0 1 48 30 V50" stroke={`url(#${grad})`} strokeWidth={6}
        fill="none" filter={glow > 0 ? `url(#${filter})` : undefined} />
      <g strokeLinecap="round">
        <path d="M13 50 H19" stroke={c1} strokeWidth={6} />
        <path d="M45 50 H51" stroke={c0} strokeWidth={6} />
      </g>
      <g stroke={c0} strokeWidth={1.8} strokeLinecap="round" opacity={0.8}>
        <path d="M16 18 L10 12" />
        <path d="M32 12 V4" />
        <path d="M48 18 L54 12" />
        {animated && (
          <animate attributeName="opacity" values="0.2;0.9;0.2" dur="1.8s" repeatCount="indefinite" />
        )}
      </g>
    </svg>
  );
}

/* ----------------------------------------------------------- Lens / optics */

export function Lens({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  void animated;
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <path d="M32 8 C40 20 40 44 32 56 C24 44 24 20 32 8 Z" stroke={`url(#${grad})`} strokeWidth={2.2}
        fill={`color-mix(in srgb, ${c1} 12%, transparent)`} filter={glow > 0 ? `url(#${filter})` : undefined} />
      <g stroke={c0} strokeWidth={1.8} strokeLinecap="round" opacity={0.85}>
        <path d="M4 20 H26" />
        <path d="M4 32 H24" />
        <path d="M4 44 H26" />
        <path d="M40 32 H60" />
        <path d="M38 20 L58 28" />
        <path d="M38 44 L58 36" />
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------- Pendulum */

export function Pendulum({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <path d="M14 10 H50" stroke={`url(#${grad})`} strokeWidth={2.6} strokeLinecap="round"
        filter={glow > 0 ? `url(#${filter})` : undefined} />
      <g>
        {animated && (
          <animateTransform attributeName="transform" type="rotate"
            values="-30 32 10; 30 32 10; -30 32 10" dur="2.4s" repeatCount="indefinite"
            calcMode="spline" keyTimes="0;0.5;1" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" />
        )}
        <path d="M32 10 L32 46" stroke={`url(#${grad})`} strokeWidth={2} strokeLinecap="round" />
        <circle cx="32" cy="50" r="6" fill={c1} stroke={c0} strokeWidth={1.6}
          filter={glow > 0 ? `url(#${filter})` : undefined} />
      </g>
      <circle cx="32" cy="10" r="2.6" fill={c0} filter={glow > 0 ? `url(#${filter})` : undefined} />
    </svg>
  );
}

/* ---------------------------------------------------------------- Vector */

export function Vector({ size = 64, animated = true, glow = 1, tone = "spark", className = "", title }: ElectricIconProps) {
  const grad = useId();
  const filter = useId();
  const [c0, c1] = TONES[tone];
  void animated;
  void c1;
  return (
    <svg {...svgProps(size, className, title)}>
      <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
      <path d="M10 54 L46 18" stroke={`url(#${grad})`} strokeWidth={2.6} strokeLinecap="round"
        filter={glow > 0 ? `url(#${filter})` : undefined} />
      <path d="M34 16 L48 16 L48 30" stroke={`url(#${grad})`} strokeWidth={2.6} strokeLinecap="round"
        strokeLinejoin="round" fill="none" filter={glow > 0 ? `url(#${filter})` : undefined} />
      <g stroke={c0} strokeWidth={1.6} strokeDasharray="3 4" strokeLinecap="round" opacity={0.75}>
        <path d="M10 54 H46" />
        <path d="M46 54 V18" />
      </g>
      <circle cx="10" cy="54" r="2.8" fill={c0} filter={glow > 0 ? `url(#${filter})` : undefined} />
    </svg>
  );
}

export const ELECTRIC_ICONS = {
  bolt: ElectricBolt,
  atom: ElectricAtom,
  circuit: CircuitNode,
  wave: SignalWave,
  field: FieldLines,
  resistor: Resistor,
  capacitor: Capacitor,
  battery: Battery,
  inductor: Inductor,
  bulb: Lightbulb,
  gauge: Gauge,
  magnet: Magnet,
  lens: Lens,
  pendulum: Pendulum,
  vector: Vector,
} as const;

export type ElectricIconName = keyof typeof ELECTRIC_ICONS;
