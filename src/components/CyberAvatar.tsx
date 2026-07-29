import React, { useEffect, useRef } from "react";
import { AVATAR_SKIN_META, isAvatarSkin, makeAvatarVariant, type AvatarSkin } from "./faraday/avatarVariants";

interface AvatarProps {
  name: string;
  size?: number;
  showText?: boolean;
  /** Optional explicit avatar color (e.g. students.avatarColor). Overrides the
      name-derived hue so shop avatar-color purchases actually take effect. */
  color?: string;
  /** Optional equipped avatar *skin* (students.equippedAvatarSkin). A skin is a
      live canvas motif and outranks `color`; anything unrecognised falls back
      to the flat clay sphere, so an un-migrated row still renders. */
  skin?: string | null;
}

/**
 * The live-skin disc: a tiny RAF loop driving one avatar motif inside the clay
 * circle. Separate from FaradayCanvas because a skin needs the learner's
 * initial baked into the draw and no palette — it's ~40 lines of loop rather
 * than a prop-widening of the full-screen backdrop harness.
 */
function SkinDisc({ skin, size, initial }: { skin: AvatarSkin; size: number; initial: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meta = AVATAR_SKIN_META[skin];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const mouse = { x: size / 2, y: size / 2, active: false };
    const onEnter = () => { mouse.active = true; };
    const onLeave = () => { mouse.active = false; };
    canvas.addEventListener("pointerenter", onEnter);
    canvas.addEventListener("pointerleave", onLeave);

    const draw = makeAvatarVariant(skin, ctx, size, size, mouse, initial);
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    if (reduce) {
      draw();
    } else {
      const loop = () => { draw(); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      draw.dispose?.();
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [skin, size, initial]);

  return (
    <div
      className="relative flex-shrink-0 select-none"
      style={{ width: size, height: size }}
    >
      {meta.halo && (
        <div
          aria-hidden
          className={`absolute rounded-full ${meta.spin ? "motion-safe:animate-spin" : ""}`}
          style={{
            inset: -Math.max(3, size * 0.07),
            background: meta.halo,
            animationDuration: meta.spin ? "4.5s" : undefined,
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: "relative",
          width: size,
          height: size,
          display: "block",
          borderRadius: "50%",
          border: `2.5px solid ${meta.edge}`,
          boxShadow: `0 4px 0 0 ${meta.clay}, 0 0 8px ${meta.glow}`,
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

/** Parse a #rrggbb (or #rgb) hex to an {h,s,l} so an explicit avatar color can
    drive the same tinted-bg / border / text treatment as the derived hue. */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = hex.trim().replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Derive a stable hue from a name
function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) * 31 + ((h << 5) - h);
  }
  return Math.abs(h) % 360;
}

export default function CyberAvatar({ name, size = 48, showText = true, color: colorProp, skin }: AvatarProps) {
  const initial = name.slice(0, 1);
  const fontSize = Math.round(size * 0.38);

  // An equipped skin replaces the whole disc — the motif draws its own body,
  // sheen and initial, so the clay-sphere path below is skipped entirely.
  if (isAvatarSkin(skin)) {
    return <SkinDisc skin={skin} size={size} initial={showText ? initial : ""} />;
  }

  // An explicit avatar color (shop purchase) drives the hue directly; otherwise
  // derive a stable hue from the name and lean it green-wards.
  const explicit = colorProp ? hexToHsl(colorProp) : null;
  const hueBase = explicit ? explicit.h : ((nameHue(name) % 160) + 60) % 360;
  const sat = explicit ? Math.max(explicit.s, 45) : 55;

  // A radial gradient (bright highlight top-left → deeper tint bottom-right)
  // turns the flat disc into a clay sphere. Lightness stays high so the dark
  // initial keeps its contrast everywhere this avatar is used.
  const hi     = `hsl(${hueBase}, ${sat}%, 94%)`;
  const mid    = `hsl(${hueBase}, ${sat}%, 86%)`;
  const deep   = `hsl(${hueBase}, ${sat}%, 77%)`;
  const bg     = `radial-gradient(circle at 32% 26%, ${hi}, ${mid} 55%, ${deep} 100%)`;
  const border = `hsl(${hueBase}, ${sat - 5}%, 68%)`;
  const color  = `hsl(${hueBase}, ${sat + 5}%, 30%)`;
  const glow   = `hsla(${hueBase}, ${sat + 5}%, 50%, 0.34)`;
  const ring   = `hsla(${hueBase}, 40%, 100%, 0.50)`;

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0 select-none"
      style={{
        width: size,
        height: size,
        background: bg,
        border: `2.5px solid ${border}`,
        borderRadius: '50%',
        boxShadow: `0 4px 12px ${glow}, 0 0 0 3px ${ring}, inset 0 2px 2px rgba(255,255,255,0.55), inset 0 -3px 5px rgba(0,0,0,0.12)`,
        fontFamily: "'Assistant', sans-serif",
        fontWeight: 700,
        fontSize,
        color,
        lineHeight: 1,
      }}
    >
      {showText && (
        <span style={{ color, textShadow: `0 1px 2px ${glow}` }}>{initial}</span>
      )}
    </div>
  );
}

