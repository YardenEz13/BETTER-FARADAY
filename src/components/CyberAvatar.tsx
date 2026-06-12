import React from "react";

interface AvatarProps {
  name: string;
  size?: number;
  showText?: boolean;
}

// Derive a stable hue from a name
function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) * 31 + ((h << 5) - h);
  }
  return Math.abs(h) % 360;
}

export default function CyberAvatar({ name, size = 48, showText = true }: AvatarProps) {
  const hue    = nameHue(name);
  const initial = name.slice(0, 1);
  const fontSize   = Math.round(size * 0.38);
  const borderRadius = Math.round(size * 0.28);

  // Lean green-wards: shift hue toward green band (80–160)
  const greenBias = ((hue % 160) + 60) % 360;

  const bg     = `hsl(${greenBias}, 35%, 12%)`;
  const border = `hsl(${greenBias}, 40%, 25%)`;
  const color  = `hsl(${greenBias}, 70%, 62%)`;
  const glow   = `hsla(${greenBias}, 60%, 50%, 0.25)`;

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0 select-none"
      style={{
        width: size,
        height: size,
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius,
        boxShadow: `0 0 12px ${glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
        fontFamily: 'var(--font-display)',
        fontWeight: 'var(--font-weight-bold)',
        fontSize,
        color,
        lineHeight: 1,
      }}
    >
      {showText && (
        <span style={{ color, textShadow: `0 0 6px ${glow}` }}>{initial}</span>
      )}
    </div>
  );
}

