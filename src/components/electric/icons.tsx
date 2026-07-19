import { useId, type CSSProperties } from "react";

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
export type ElectricTone = "spark" | "violet" | "amber" | "danger" | "ghost" | "current";

const TONES: Record<ElectricTone, [string, string]> = {
  spark: ["var(--color-inverse-primary)", "var(--color-primary)"],
  violet: ["color-mix(in srgb, var(--color-secondary) 50%, white)", "var(--color-secondary)"],
  amber: ["color-mix(in srgb, var(--color-tertiary) 50%, white)", "var(--color-tertiary)"],
  danger: ["color-mix(in srgb, var(--color-error) 50%, white)", "var(--color-error)"],
  // "ghost" = white, for use on filled/colored (e.g. green primary) backgrounds
  ghost: ["#ffffff", "rgba(255,255,255,0.88)"],
  // "current" = inherit the surrounding text color (currentColor). This makes the
  // functional UI icons true drop-in replacements for lucide: a parent
  // `text-error` / `style={{color}}` drives the icon color exactly as before.
  current: ["currentColor", "currentColor"],
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
  /** forwarded to the root <svg> — e.g. style={{ color }} drives currentColor, style={{ transform }} rotates */
  style?: CSSProperties;
  /** accepted for drop-in compatibility with lucide call sites; ignored (stroke width is set per icon) */
  strokeWidth?: number;
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

function svgProps(size: number, className: string, title?: string, style?: CSSProperties) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    fill: "none" as const,
    className,
    style,
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

/* ====================================================================== *
 *  Functional UI icon set — electric line-art
 *
 *  Drop-in replacements for the lucide icons used across the app, drawn in
 *  the same family grammar (gradient stroke + neon halo). They are static by
 *  default (no animated current) so they stay crisp at small/control sizes —
 *  set glow={0} for pure flat line art that recolors with the theme.
 *
 *  Built from a small factory so all ~70 share one consistent renderer.
 * ====================================================================== */

type Paintable = string | { d: string; soft?: boolean; accent?: boolean };

interface IconDef {
  /** stroked paths; {soft} fills with a faint tone wash, {accent} strokes with the light stop */
  paths?: Paintable[];
  /** stroked outline circles: [cx, cy, r] */
  rings?: [number, number, number][];
  /** filled dots (light stop): [cx, cy, r?] */
  dots?: [number, number, number?][];
  sw?: number;
  cap?: "round" | "butt" | "square";
  join?: "round" | "miter" | "bevel";
}

/** Build a theme-aware electric icon component from a declarative path spec. */
function makeIcon(def: IconDef) {
  // Functional icons default to `current` (inherit text color) + a soft halo, so
  // they drop straight into existing `text-*`/`color` styling like lucide did.
  return function Icon({ size = 24, animated = true, glow = 0.6, tone = "current", className = "", title, style }: ElectricIconProps) {
    void animated; // functional icons are static — current animation would distract at control sizes
    const grad = useId();
    const filter = useId();
    const [c0, c1] = TONES[tone];
    const sw = def.sw ?? 2.6;
    const f = glow > 0 ? `url(#${filter})` : undefined;
    return (
      <svg {...svgProps(size, className, title, style)}>
        <Defs grad={grad} filter={filter} glow={glow} c0={c0} c1={c1} />
        {def.paths?.map((p, i) => {
          const o = typeof p === "string" ? { d: p } : p;
          return (
            <path
              key={`p${i}`}
              d={o.d}
              stroke={o.accent ? c0 : `url(#${grad})`}
              strokeWidth={o.accent ? sw * 0.8 : sw}
              strokeLinecap={def.cap ?? "round"}
              strokeLinejoin={def.join ?? "round"}
              fill={o.soft ? `color-mix(in srgb, ${c1} 14%, transparent)` : "none"}
              filter={f}
            />
          );
        })}
        {def.rings?.map(([cx, cy, r], i) => (
          <circle key={`r${i}`} cx={cx} cy={cy} r={r} stroke={`url(#${grad})`} strokeWidth={sw} fill="none" filter={f} />
        ))}
        {def.dots?.map(([cx, cy, r], i) => (
          <circle key={`d${i}`} cx={cx} cy={cy} r={r ?? 2.6} fill={c0} filter={f} />
        ))}
      </svg>
    );
  };
}

/* — arrows & chevrons — */
export const ArrowRight = makeIcon({ paths: ["M10 32 H50", "M36 18 L50 32 L36 46"] });
export const ArrowLeft = makeIcon({ paths: ["M54 32 H14", "M28 18 L14 32 L28 46"] });
export const ArrowUp = makeIcon({ paths: ["M32 54 V14", "M18 28 L32 14 L46 28"] });
export const ArrowDown = makeIcon({ paths: ["M32 10 V50", "M18 36 L32 50 L46 36"] });
export const ChevronRight = makeIcon({ paths: ["M26 14 L44 32 L26 50"] });
export const ChevronLeft = makeIcon({ paths: ["M38 14 L20 32 L38 50"] });
export const ChevronDown = makeIcon({ paths: ["M14 26 L32 44 L50 26"] });
export const ChevronUp = makeIcon({ paths: ["M14 38 L32 20 L50 38"] });
export const CornerDownLeft = makeIcon({ paths: ["M50 14 V30 A8 8 0 0 1 42 38 H16", "M26 26 L14 38 L26 50"] });

/* — status — */
export const Check = makeIcon({ paths: ["M12 34 L26 48 L52 16"], sw: 3 });
export const CheckCircle = makeIcon({ rings: [[32, 32, 23]], paths: ["M22 33 L29 40 L43 24"] });
export const CircleIcon = makeIcon({ rings: [[32, 32, 22]] });
export const X = makeIcon({ paths: ["M18 18 L46 46", "M46 18 L18 46"], sw: 3 });
export const XCircle = makeIcon({ rings: [[32, 32, 23]], paths: ["M25 25 L39 39", "M39 25 L25 39"] });
export const AlertTriangle = makeIcon({ paths: [{ d: "M32 10 L57 52 A2 2 0 0 1 55 55 H9 A2 2 0 0 1 7 52 Z", soft: true }, { d: "M32 26 V40", accent: true }], dots: [[32, 47, 2.4]] });
export const Flag = makeIcon({ paths: ["M16 10 V56", { d: "M16 14 H48 L40 24 L48 34 H16", soft: true }] });

/* — energy & emphasis — */
export const Zap = makeIcon({ paths: [{ d: "M37 5 L17 35 H30 L25 59 L49 27 H35 Z", soft: true }], join: "round" });
export const Flame = makeIcon({ paths: [{ d: "M32 8 C40 20 46 24 44 36 C43 47 38 54 30 54 C22 54 18 47 20 39 C21 34 26 35 26 30 C26 22 30 14 32 8 Z", soft: true }] });
export const Sparkles = makeIcon({ paths: [{ d: "M22 10 L26 23 L39 27 L26 31 L22 44 L18 31 L5 27 L18 23 Z", soft: true }, { d: "M46 36 L48 45 L57 47 L48 49 L46 58 L44 49 L35 47 L44 45 Z", accent: true }] });
export const Star = makeIcon({ paths: [{ d: "M32 8 L39 26 L58 27 L43 39 L48 57 L32 46 L16 57 L21 39 L6 27 L25 26 Z", soft: true }] });

/* — people — */
export const User = makeIcon({ rings: [[32, 22, 10]], paths: ["M13 53 C13 41 23 37 32 37 C41 37 51 41 51 53"] });
export const Users = makeIcon({ rings: [[24, 23, 9], [45, 21, 7]], paths: ["M8 53 C8 42 16 38 24 38 C32 38 40 42 40 53", "M45 31 C51 32 56 37 56 50"] });
export const UserPlus = makeIcon({ rings: [[25, 22, 10]], paths: ["M8 53 C8 41 17 37 25 37 C29 37 33 38 37 40", { d: "M50 36 V52", accent: true }, { d: "M42 44 H58", accent: true }] });
export const GraduationCap = makeIcon({ paths: [{ d: "M8 26 L32 16 L56 26 L32 36 Z", soft: true }, "M18 31 V44 C18 49 26 51 32 51 C38 51 46 49 46 44 V31", { d: "M56 26 V41", accent: true }] });
export const Shield = makeIcon({ paths: [{ d: "M32 8 L52 16 V32 C52 44 43 52 32 56 C21 52 12 44 12 32 V16 Z", soft: true }] });
export const Bot = makeIcon({ paths: [{ d: "M18 24 H46 A5 5 0 0 1 51 29 V46 A5 5 0 0 1 46 51 H18 A5 5 0 0 1 13 46 V29 A5 5 0 0 1 18 24 Z", soft: true }, "M32 24 V14", "M25 44 H39"], dots: [[24, 36, 2.6], [40, 36, 2.6], [32, 12, 2.6]] });

/* — communication — */
export const Send = makeIcon({ paths: ["M56 8 L28 36", { d: "M56 8 L38 56 L28 36 L8 26 Z", soft: true }] });
export const MessageSquare = makeIcon({ paths: [{ d: "M10 14 H54 A4 4 0 0 1 58 18 V40 A4 4 0 0 1 54 44 H26 L14 54 V44 H10 A4 4 0 0 1 6 40 V18 A4 4 0 0 1 10 14 Z", soft: true }] });
export const Bell = makeIcon({ paths: [{ d: "M22 26 A10 10 0 0 1 42 26 C42 40 48 44 48 44 H16 C16 44 22 40 22 26 Z", soft: true }, "M27 50 A5 5 0 0 0 37 50"] });
export const ThumbsUp = makeIcon({ paths: ["M18 30 V52 H12 A2 2 0 0 1 10 50 V32 A2 2 0 0 1 12 30 Z", "M18 30 L29 10 C33 10 35 13 35 17 V26 H50 A4 4 0 0 1 54 31 L50 49 A4 4 0 0 1 46 52 H18"] });
export const QrCode = makeIcon({ paths: ["M12 12 H26 V26 H12 Z", "M38 12 H52 V26 H38 Z", "M12 38 H26 V52 H12 Z", "M38 38 H46 V46 H38 Z", "M50 50 H52", "M38 52 H42"], sw: 2.4 });
export const Smartphone = makeIcon({ paths: ["M20 8 H44 A4 4 0 0 1 48 12 V52 A4 4 0 0 1 44 56 H20 A4 4 0 0 1 16 52 V12 A4 4 0 0 1 20 8 Z", { d: "M28 50 H36", accent: true }] });
export const Camera = makeIcon({ paths: [{ d: "M12 20 H22 L26 14 H38 L42 20 H52 A4 4 0 0 1 56 24 V48 A4 4 0 0 1 52 52 H12 A4 4 0 0 1 8 48 V24 A4 4 0 0 1 12 20 Z", soft: true }], rings: [[32, 36, 9]] });
export const ImagePlus = makeIcon({ paths: ["M10 14 H40 A4 4 0 0 1 44 18 V30", "M10 14 V50 A4 4 0 0 1 14 54 H44", "M10 47 L24 33 L34 43", "M34 39 L41 32 L44 35", { d: "M52 42 V58", accent: true }, { d: "M44 50 H60", accent: true }], dots: [[20, 25, 2.6]] });
export const Copy = makeIcon({ paths: ["M22 22 H50 A2 2 0 0 1 52 24 V52 A2 2 0 0 1 50 54 H22 A2 2 0 0 1 20 52 V24 A2 2 0 0 1 22 22 Z", "M14 42 H12 A2 2 0 0 1 10 40 V12 A2 2 0 0 1 12 10 H40 A2 2 0 0 1 42 12 V14"] });

/* — media & control — */
export const Play = makeIcon({ paths: [{ d: "M20 12 L52 32 L20 52 Z", soft: true }] });
export const RotateCcw = makeIcon({ paths: ["M14 32 A18 18 0 1 0 19 19", "M19 10 V20 H9"] });
export const RefreshCw = makeIcon({ paths: ["M50 24 A18 18 0 0 0 18 18", "M50 12 V24 H38", "M14 40 A18 18 0 0 0 46 46", "M14 52 V40 H26"] });
export const History = makeIcon({ rings: [[34, 32, 21]], paths: ["M34 20 V32 L44 38", "M13 24 A21 21 0 0 1 18 17", "M8 18 L13 24 L19 19"] });
export const Loader = makeIcon({ paths: ["M32 8 A24 24 0 0 1 56 32"], dots: [[32, 8, 2.4]] });
export const Clock = makeIcon({ rings: [[32, 32, 22]], paths: ["M32 18 V32 L43 39"] });

/* — edit & tools — */
export const Edit = makeIcon({ paths: ["M38 12 L52 26 L24 54 L10 54 L10 40 Z", "M34 16 L48 30"] });
export const PencilLine = makeIcon({ paths: ["M38 10 L52 24 L26 50 H12 V36 Z", "M34 14 L48 28", { d: "M8 58 H56", accent: true }] });
export const Trash2 = makeIcon({ paths: ["M12 18 H52", "M24 18 V12 H40 V18", "M16 18 L19 52 A2 2 0 0 0 21 54 H43 A2 2 0 0 0 45 52 L48 18", { d: "M28 26 V46", accent: true }, { d: "M36 26 V46", accent: true }] });
export const Scissors = makeIcon({ rings: [[18, 18, 6], [18, 46, 6]], paths: ["M23 21 L52 50", "M23 43 L52 14"] });
export const Plus = makeIcon({ paths: ["M32 12 V52", "M12 32 H52"], sw: 3 });
export const Settings = makeIcon({ rings: [[32, 32, 9]], paths: [{ d: "M32 6 V14", accent: true }, { d: "M32 50 V58", accent: true }, { d: "M6 32 H14", accent: true }, { d: "M50 32 H58", accent: true }, { d: "M13 13 L19 19", accent: true }, { d: "M45 45 L51 51", accent: true }, { d: "M45 19 L51 13", accent: true }, { d: "M13 51 L19 45", accent: true }], dots: [[32, 32, 2.6]] });
export const Sigma = makeIcon({ paths: ["M46 14 H20 L36 32 L20 50 H46"] });
export const Calculator = makeIcon({ paths: ["M16 8 H48 A4 4 0 0 1 52 12 V52 A4 4 0 0 1 48 56 H16 A4 4 0 0 1 12 52 V12 A4 4 0 0 1 16 8 Z", "M18 18 H46 V26 H18 Z"], dots: [[22, 36], [32, 36], [42, 36], [22, 46], [32, 46], [42, 46]] });
export const Terminal = makeIcon({ paths: ["M8 14 H56 A2 2 0 0 1 58 16 V48 A2 2 0 0 1 56 50 H8 A2 2 0 0 1 6 48 V16 A2 2 0 0 1 8 14 Z", "M16 26 L24 32 L16 38", { d: "M30 40 H44", accent: true }] });
export const Search = makeIcon({ rings: [[28, 28, 16]], paths: ["M40 40 L54 54"] });

/* — view — */
export const Eye = makeIcon({ paths: ["M6 32 C14 20 24 16 32 16 C40 16 50 20 58 32 C50 44 40 48 32 48 C24 48 14 44 6 32 Z"], rings: [[32, 32, 7]], dots: [[32, 32, 3]] });
export const EyeOff = makeIcon({ paths: ["M14 20 C20 17 26 16 32 16 C40 16 50 20 58 32 C55 37 51 41 46 43", "M6 32 C9 27 13 23 18 20", "M24 40 A8 8 0 0 0 40 26", { d: "M10 8 L54 56", accent: true }] });
export const MapIcon = makeIcon({ paths: ["M22 12 L8 18 V54 L22 48 L42 54 L56 48 V12 L42 18 Z", { d: "M22 12 V48", accent: true }, { d: "M42 18 V54", accent: true }] });
export const LayoutGrid = makeIcon({ paths: ["M10 10 H28 V28 H10 Z", "M36 10 H54 V28 H36 Z", "M10 36 H28 V54 H10 Z", "M36 36 H54 V54 H36 Z"] });
export const BarChart2 = makeIcon({ paths: ["M14 54 V30", "M32 54 V14", "M50 54 V38"], sw: 4 });
export const BookOpen = makeIcon({ paths: ["M32 16 C26 12 16 12 10 14 V48 C16 46 26 46 32 50 C38 46 48 46 54 48 V14 C48 12 38 12 32 16 Z", { d: "M32 16 V50", accent: true }] });
export const FileText = makeIcon({ paths: ["M18 8 H38 L48 18 V52 A2 2 0 0 1 46 54 H18 A2 2 0 0 1 16 52 V10 A2 2 0 0 1 18 8 Z", { d: "M38 8 V18 H48", accent: true }, { d: "M24 30 H40", accent: true }, { d: "M24 38 H40", accent: true }, { d: "M24 46 H34", accent: true }] });
export const Calendar = makeIcon({ paths: ["M12 16 H52 A2 2 0 0 1 54 18 V50 A2 2 0 0 1 52 52 H12 A2 2 0 0 1 10 50 V18 A2 2 0 0 1 12 16 Z", "M10 26 H54", { d: "M20 10 V20", accent: true }, { d: "M44 10 V20", accent: true }] });
export const Package = makeIcon({ paths: ["M32 8 L54 20 V44 L32 56 L10 44 V20 Z", "M10 20 L32 32 L54 20", { d: "M32 32 V56", accent: true }] });
export const Palette = makeIcon({ paths: ["M32 8 C18 8 8 19 8 32 C8 44 17 52 28 52 C32 52 33 48 31 45 C29 42 31 38 35 38 H44 C51 38 56 32 56 26 C56 15 45 8 32 8 Z"], dots: [[22, 24], [32, 18], [44, 24], [49, 34]] });
export const LogOut = makeIcon({ paths: ["M26 12 H16 A4 4 0 0 0 12 16 V48 A4 4 0 0 0 16 52 H26", "M36 22 L48 32 L36 42", "M24 32 H48"] });
export const Upload = makeIcon({ paths: ["M32 40 V12", "M20 24 L32 12 L44 24", "M12 44 V50 A2 2 0 0 0 14 52 H50 A2 2 0 0 0 52 50 V44"] });
export const ExternalLink = makeIcon({ paths: ["M34 12 H52 V30", "M52 12 L30 34", "M44 36 V50 A2 2 0 0 1 42 52 H14 A2 2 0 0 1 12 50 V22 A2 2 0 0 1 14 20 H28"] });

/* — sound — */
export const Speaker = makeIcon({ paths: [{ d: "M10 24 H20 L32 14 V50 L20 40 H10 A2 2 0 0 1 8 38 V26 A2 2 0 0 1 10 24 Z", soft: true }, { d: "M40 24 A11 11 0 0 1 40 40", accent: true }, { d: "M46 18 A19 19 0 0 1 46 46", accent: true }] });
export const SpeakerOff = makeIcon({ paths: [{ d: "M10 24 H20 L32 14 V50 L20 40 H10 A2 2 0 0 1 8 38 V26 A2 2 0 0 1 10 24 Z", soft: true }, { d: "M42 26 L58 42", accent: true }, { d: "M58 26 L42 42", accent: true }] });

/* — theme — */
export const Moon = makeIcon({ paths: [{ d: "M46 36 A18 18 0 1 1 28 12 A14 14 0 0 0 46 36 Z", soft: true }] });
export const Sun = makeIcon({ rings: [[32, 32, 11]], paths: [{ d: "M32 6 V14", accent: true }, { d: "M32 50 V58", accent: true }, { d: "M6 32 H14", accent: true }, { d: "M50 32 H58", accent: true }, { d: "M13 13 L19 19", accent: true }, { d: "M45 45 L51 51", accent: true }, { d: "M45 19 L51 13", accent: true }, { d: "M13 51 L19 45", accent: true }] });

/* — emotion & state — */
export const Smile = makeIcon({ rings: [[32, 32, 23]], paths: ["M22 38 C26 44 38 44 42 38"], dots: [[24, 27, 2.4], [40, 27, 2.4]] });
export const Frown = makeIcon({ rings: [[32, 32, 23]], paths: ["M22 43 C26 37 38 37 42 43"], dots: [[24, 27, 2.4], [40, 27, 2.4]] });
export const Meh = makeIcon({ rings: [[32, 32, 23]], paths: ["M23 40 H41"], dots: [[24, 27, 2.4], [40, 27, 2.4]] });
export const Lock = makeIcon({ paths: ["M18 30 H46 A2 2 0 0 1 48 32 V50 A2 2 0 0 1 46 52 H18 A2 2 0 0 1 16 50 V32 A2 2 0 0 1 18 30 Z", "M22 30 V22 A10 10 0 0 1 42 22 V30"], dots: [[32, 41, 2.6]] });
export const Unlock = makeIcon({ paths: ["M18 30 H46 A2 2 0 0 1 48 32 V50 A2 2 0 0 1 46 52 H18 A2 2 0 0 1 16 50 V32 A2 2 0 0 1 18 30 Z", "M22 30 V22 A10 10 0 0 1 42 18"], dots: [[32, 41, 2.6]] });
export const Radio = makeIcon({ rings: [[32, 32, 14], [32, 32, 22]], dots: [[32, 32, 4]] });
export const Trophy = makeIcon({ paths: ["M20 12 H44 V26 A12 12 0 0 1 20 26 Z", "M20 16 H12 A2 2 0 0 0 10 18 C10 26 16 30 22 30", "M44 16 H52 A2 2 0 0 1 54 18 C54 26 48 30 42 30", "M32 38 V46", "M24 54 H40", "M26 46 H38 V54 H26 Z"] });
export const Activity = makeIcon({ paths: ["M6 32 H20 L26 16 L34 48 L40 32 H58"] });
export const TrendingUp = makeIcon({ paths: ["M8 44 L26 26 L36 36 L56 16", "M44 16 H56 V28"] });
export const Target = makeIcon({ rings: [[32, 32, 22], [32, 32, 13]], dots: [[32, 32, 4]] });

export const ELECTRIC_ICONS = {
  // physics family
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
  // functional UI set
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  cornerDownLeft: CornerDownLeft,
  check: Check,
  checkCircle: CheckCircle,
  circle: CircleIcon,
  x: X,
  xCircle: XCircle,
  alertTriangle: AlertTriangle,
  flag: Flag,
  zap: Zap,
  flame: Flame,
  sparkles: Sparkles,
  star: Star,
  user: User,
  users: Users,
  userPlus: UserPlus,
  graduationCap: GraduationCap,
  shield: Shield,
  bot: Bot,
  send: Send,
  message: MessageSquare,
  bell: Bell,
  thumbsUp: ThumbsUp,
  qrCode: QrCode,
  smartphone: Smartphone,
  camera: Camera,
  imagePlus: ImagePlus,
  copy: Copy,
  play: Play,
  rotateCcw: RotateCcw,
  refresh: RefreshCw,
  history: History,
  loader: Loader,
  clock: Clock,
  edit: Edit,
  pencilLine: PencilLine,
  trash: Trash2,
  scissors: Scissors,
  plus: Plus,
  settings: Settings,
  sigma: Sigma,
  calculator: Calculator,
  terminal: Terminal,
  search: Search,
  eye: Eye,
  eyeOff: EyeOff,
  map: MapIcon,
  layoutGrid: LayoutGrid,
  barChart: BarChart2,
  bookOpen: BookOpen,
  fileText: FileText,
  calendar: Calendar,
  package: Package,
  palette: Palette,
  logOut: LogOut,
  upload: Upload,
  externalLink: ExternalLink,
  speaker: Speaker,
  speakerOff: SpeakerOff,
  moon: Moon,
  sun: Sun,
  smile: Smile,
  frown: Frown,
  meh: Meh,
  lock: Lock,
  unlock: Unlock,
  radio: Radio,
  trophy: Trophy,
  activity: Activity,
  trendingUp: TrendingUp,
  target: Target,
} as const;

export type ElectricIconName = keyof typeof ELECTRIC_ICONS;
