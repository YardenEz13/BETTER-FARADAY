import React from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

/* ═══════════════════════════════════════════════════════════════════════
   COMMAND CENTER — shared presentational primitives
   Pure rendering from the getCommandCenter payload. No data fetching here:
   numbers come from Convex, this file only turns them into clay + geometry.
   ═══════════════════════════════════════════════════════════════════════ */

export type CommandCenterData = FunctionReturnType<typeof api.commandCenter.getCommandCenter>;
export type CCStudent = CommandCenterData["students"][number];
export type CCStatus = CCStudent["status"];
export type CCTone = "primary" | "secondary" | "tertiary" | "error";

// ── status helpers ────────────────────────────────────────────────────────
export const STATUS: Record<CCStatus, { he: string; color: string; tone: CCTone }> = {
  risk:     { he: "דורש התערבות", color: "var(--color-error)",     tone: "error" },
  watch:    { he: "במעקב",        color: "var(--color-tertiary)",   tone: "tertiary" },
  thriving: { he: "מזנק",         color: "var(--color-primary)",    tone: "primary" },
};

export const LANES: { key: CCStatus; he: string }[] = [
  { key: "risk",     he: "דורשי תשומת לב" },
  { key: "watch",    he: "במעקב" },
  { key: "thriving", he: "מזנקים" },
];

export function toneColor(tone: CCTone): string {
  return {
    primary: "var(--color-primary)",
    secondary: "var(--color-secondary)",
    tertiary: "var(--color-tertiary)",
    error: "var(--color-error)",
  }[tone];
}

// Avatar tile painted with the student's OWN avatarColor (real data).
export function avatarStyle(color: string, size = 38, radius = 11, fs = 14): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: fs,
    border: "2px solid",
    background: `color-mix(in srgb, ${color} 20%, var(--color-surface))`,
    color: `color-mix(in srgb, ${color} 78%, var(--color-on-surface))`,
    borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
  };
}

// Mastery → cell color (heat grid). Returns bg / glow / fg.
export function cellColor(pct: number, hasData: boolean) {
  if (!hasData) return { bg: "var(--color-surface-container-low)", glow: "none", fg: "var(--color-on-surface-variant)" };
  if (pct >= 82) return { bg: "var(--color-primary)", glow: "0 0 10px rgba(23,201,100,.5)", fg: "#fff" };
  if (pct >= 62) return { bg: "color-mix(in srgb, var(--color-primary) 48%, var(--color-surface))", glow: "none", fg: "var(--color-on-surface)" };
  if (pct >= 42) return { bg: "color-mix(in srgb, var(--color-tertiary) 52%, var(--color-surface))", glow: "none", fg: "var(--color-on-surface)" };
  return { bg: "color-mix(in srgb, var(--color-error) 42%, var(--color-surface))", glow: "0 0 8px rgba(255,75,75,.3)", fg: "var(--color-on-surface)" };
}

// Mastery → segment bar color (student card strip).
export function segColor(pct: number, hasData: boolean): string {
  if (!hasData) return "var(--color-outline)";
  if (pct >= 82) return "var(--color-primary)";
  if (pct >= 62) return "color-mix(in srgb, var(--color-primary) 55%, var(--color-surface-container-high))";
  if (pct >= 42) return "var(--color-tertiary)";
  return "var(--color-error)";
}

export function accColor(pct: number): string {
  if (pct >= 78) return "var(--color-primary)";
  if (pct >= 55) return "var(--color-tertiary)";
  return "var(--color-error)";
}

// ── Avatar ────────────────────────────────────────────────────────────────
export function Avatar({ s, size = 38, radius = 11, fs = 14 }: { s: CCStudent; size?: number; radius?: number; fs?: number }) {
  return <span style={avatarStyle(s.avatarColor, size, radius, fs)}>{s.initial}</span>;
}

// ── Sparkline ───────────────────────────────────────────────────────────────
export function Sparkline({ values, color, width = 62, height = 22 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pad = 2;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0, overflow: "visible" }}>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill={color} />
    </svg>
  );
}

// ── Radar ───────────────────────────────────────────────────────────────────
// values: 0-100 per axis, aligned with `labels`. Draws rings, axes, polygon.
export function Radar({
  values,
  labels,
  size = 190,
  showLabels = false,
  stroke = "var(--color-primary)",
  fill = "color-mix(in srgb, var(--color-primary) 24%, transparent)",
  glow = "color-mix(in srgb, var(--color-primary) 50%, transparent)",
}: {
  values: number[];
  labels?: string[];
  size?: number;
  showLabels?: boolean;
  stroke?: string;
  fill?: string;
  glow?: string;
}) {
  const n = Math.max(values.length, 3);
  const vbW = size;
  const vbH = showLabels ? size * 0.95 : size * 0.9;
  const cx = vbW / 2;
  const cy = vbH / 2;
  const R = Math.min(cx, cy) - (showLabels ? 18 : 10);
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  const ring = (frac: number) =>
    Array.from({ length: n }, (_, i) => pt(i, R * frac).join(",")).join(" ");
  const shape = values.map((v, i) => pt(i, (Math.max(0, Math.min(100, v)) / 100) * R).join(",")).join(" ");
  const verts = values.map((v, i) => pt(i, (Math.max(0, Math.min(100, v)) / 100) * R));

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[1, 0.66, 0.33].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="var(--color-outline)" strokeWidth={1} />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-outline)" strokeWidth={1} />;
      })}
      <polygon points={shape} fill={fill} stroke={stroke} strokeWidth={2} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 5px ${glow})` }} />
      {verts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.4} fill={stroke} />
      ))}
      {showLabels && labels &&
        labels.map((lb, i) => {
          const [x, y] = pt(i, R + 11);
          const c = Math.cos(angle(i));
          const anchor = Math.abs(c) < 0.3 ? "middle" : c > 0 ? "start" : "end";
          return (
            <text key={i} x={x} y={y + 3} textAnchor={anchor} style={{ fontSize: 8.5, fontWeight: 700, fill: "var(--color-on-surface-variant)" }}>
              {lb}
            </text>
          );
        })}
    </svg>
  );
}

// ── Radial gauge (class energy) ───────────────────────────────────────────────
export function Gauge({ pct, size = 220, stroke = 16 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const dash = c;
  const offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "relative", zIndex: 1, transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-container-high)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={dash}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset .9s ease-out", filter: "drop-shadow(0 0 6px rgba(23,201,100,.55))" }}
      />
    </svg>
  );
}

// ── Small ring (health, KPI dials) ─────────────────────────────────────────
export function MiniRing({ pct, size = 38, stroke = 5, color = "var(--color-primary)" }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-container-high)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1s ease-out", filter: `drop-shadow(0 0 4px color-mix(in srgb, ${color} 60%, transparent))` }} />
    </svg>
  );
}
