import { type Mouse, type DrawFn, MOTIF, ha, rnd, glowDot, stampGlow } from "./types";

/**
 * Avatar skins — a collectible ladder of live charged discs, ported from the
 * design lab (Reward Theme Lab.dc.html · avatars section).
 *
 * Three elements (charge / fire / ice) each rendered at four price tiers: the
 * cheap skin runs ONE simple motion on a flat body, the expensive one runs
 * layered turbulence, bloom and multi-hue colour. The price buys *execution*,
 * which is what makes the ladder legible in the shop.
 *
 * Same builder contract as the backdrops — (ctx,w,h,mouse) -> DrawFn — so the
 * RAF harness in CyberAvatar mounts them unchanged. Perf contract preserved:
 * glowDot/stampGlow sprite-cache, no per-frame shadowBlur.
 */

export type AvatarSkin =
  | "volt" | "ember" | "frost"
  | "arc" | "fire" | "snow"
  | "charged" | "magma" | "glacier"
  | "prism" | "supernova" | "aurora";

export type AvatarTier = "starter" | "rare" | "epic" | "legendary";

/** Presentation shell for a skin: the clay ring, halo and label colour that
 *  sit *outside* the canvas. Tier drives richness, matching the shop price. */
export interface AvatarSkinMeta {
  tier: AvatarTier;
  /** Hebrew display name, as shown in the shop. */
  he: string;
  edge: string;
  clay: string;
  glow: string;
  /** CSS background for the halo ring behind the disc; "" = no halo. */
  halo: string;
  /** true → the halo is a conic prestige ring that spins. */
  spin: boolean;
}

const halo = (c: string, stop: number) =>
  `radial-gradient(circle,color-mix(in srgb,${c} ${stop}%,transparent),transparent 72%)`;

export const AVATAR_SKIN_META: Record<AvatarSkin, AvatarSkinMeta> = {
  // ── Starter · 150 XP — one motion, flat body, no halo ──
  volt:      { tier: "starter", he: "מתח", edge: "#0F9E4E", clay: "#0A5C2E", glow: "rgba(23,201,100,.25)", halo: "", spin: false },
  ember:     { tier: "starter", he: "גחלת", edge: "#C25E05", clay: "#7A2E04", glow: "rgba(255,122,46,.25)", halo: "", spin: false },
  frost:     { tier: "starter", he: "כפור", edge: "#2E7DBF", clay: "#0E3F6B", glow: "rgba(91,200,255,.25)", halo: "", spin: false },
  // ── Rare · 400 XP — two layers, trails, inner glow ──
  arc:       { tier: "rare", he: "קשת חשמלית", edge: "#5E45E0", clay: "#33228C", glow: "rgba(123,97,255,.38)", halo: halo("#7B61FF", 45), spin: false },
  fire:      { tier: "rare", he: "אש", edge: "#E0621A", clay: "#8A2004", glow: "rgba(255,122,46,.4)", halo: halo("#FF7A2E", 45), spin: false },
  snow:      { tier: "rare", he: "שלג", edge: "#4FA3DE", clay: "#154E7C", glow: "rgba(146,220,255,.4)", halo: halo("#5BC8FF", 45), spin: false },
  // ── Epic · 900 XP — three layers, turbulence, core bloom ──
  charged:   { tier: "epic", he: "טעון", edge: "#E0921A", clay: "#8F4E0C", glow: "rgba(255,176,46,.45)", halo: halo("#FFB02E", 60), spin: false },
  magma:     { tier: "epic", he: "מאגמה", edge: "#FF6B2E", clay: "#7A1A04", glow: "rgba(255,75,75,.5)", halo: halo("#FF4B4B", 60), spin: false },
  glacier:   { tier: "epic", he: "קרחון", edge: "#8FDCFF", clay: "#0A3757", glow: "rgba(223,246,255,.45)", halo: halo("#5BC8FF", 60), spin: false },
  // ── Legendary · 2,000 XP — full-disc colour, multi-hue, spinning ring ──
  prism:     { tier: "legendary", he: "מנסרה", edge: "#FFD27A", clay: "#0B7A3B", glow: "rgba(234,255,244,.32)", halo: "conic-gradient(from 0deg,#22D86B,#5BFF9F,#9A85FF,#FFBE52,#22D86B)", spin: true },
  supernova: { tier: "legendary", he: "סופרנובה", edge: "#FFF3C8", clay: "#5A2E00", glow: "rgba(255,243,200,.5)", halo: "conic-gradient(from 0deg,#FFD27A,#FFFFFF,#FF7A2E,#FFF3C8,#FFD27A)", spin: true },
  aurora:    { tier: "legendary", he: "זוהר קוטבי", edge: "#5BFF9F", clay: "#0A3B2A", glow: "rgba(91,255,159,.4)", halo: "conic-gradient(from 0deg,#5BFF9F,#5BC8FF,#9A85FF,#22D86B,#5BFF9F)", spin: true },
};

export const AVATAR_SKINS = Object.keys(AVATAR_SKIN_META) as AvatarSkin[];

export function isAvatarSkin(v: string | undefined | null): v is AvatarSkin {
  return !!v && v in AVATAR_SKIN_META;
}

const TAU = Math.PI * 2;
/** Disc radius the motifs were tuned against (the lab's 64px preview). */
const REF_R = 32;

type Body = (cx: number, cy: number, R: number) => void;

/**
 * Clay disc shell: clip, paint the body gradient, run the motif *additively*,
 * then re-apply weight-shade + sheen + the learner's initial on top so the
 * initial stays legible no matter how hot the motif burns.
 */
function disc(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  initial: string,
  hi: string,
  lo: string,
  body: Body,
  ink: string,
  shade?: string,
) {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  const g = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.42, R * 0.08, cx, cy, R * 1.18);
  g.addColorStop(0, hi); g.addColorStop(1, lo);
  ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  // Scale the motif to the disc: glow radii shrink with it, and below ~48px
  // the particle counts thin out rather than turning into a smear.
  const prevK = MOTIF.k, prevLod = MOTIF.lod;
  MOTIF.k = Math.min(1, R / REF_R);
  MOTIF.lod = R >= REF_R * 0.75 ? 1 : Math.max(0.35, R / (REF_R * 0.75));
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  body(cx, cy, R);
  ctx.restore();
  MOTIF.k = prevK; MOTIF.lod = prevLod;

  const sg = ctx.createLinearGradient(0, cy + R * 0.1, 0, cy + R);
  sg.addColorStop(0, "rgba(0,0,0,0)"); sg.addColorStop(1, shade || "rgba(0,0,0,.34)");
  ctx.fillStyle = sg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.beginPath(); ctx.ellipse(cx - R * 0.16, cy - R * 0.52, R * 0.62, R * 0.3, -0.34, 0, TAU);
  ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fill();
  if (initial) {
    ctx.font = `800 ${Math.round(R * 0.92)}px Assistant, system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillText(initial, cx, cy + R * 0.09);
    ctx.fillStyle = ink || "#fff"; ctx.fillText(initial, cx, cy + R * 0.06);
  }
  ctx.beginPath(); ctx.arc(cx, cy, R - 1.4, 0, TAU);
  ctx.strokeStyle = "rgba(255,255,255,.26)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

/** Rising heat blobs — n tongues; richer tiers use more, with hotter cores. */
function tongues(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, t: number,
  n: number, spd: number, sway: number, cols: string[], size: number, alpha: number,
) {
  for (let i = 0; i < n; i++) {
    const ph = (i / n) * TAU;
    const f = (t * spd + i / n) % 1;
    const x = cx + Math.sin(t * 1.8 + ph) * R * sway + Math.cos(ph) * R * 0.3;
    const y = cy + R * (0.92 - f * 1.85);
    const r = R * size * (1 - f * 0.85);
    if (r > 0.5) stampGlow(ctx, x, y, r, cols[i % cols.length], alpha * (1 - f * 0.7));
  }
}

type Flake = { x: number; o: number; s: number; w: number };
const mkFlakes = (n: number): Flake[] =>
  Array.from({ length: n }, () => ({ x: rnd(-1, 1), o: Math.random(), s: rnd(0.5, 1.1), w: rnd(0.8, 2.2) }));

/** Falling flakes with sway. */
function fall(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, t: number,
  arr: Flake[], col: string, size: number, alpha: number,
) {
  arr.forEach((f) => {
    const y = cy - R + ((t * f.s * 0.11 + f.o) % 1) * R * 2.1;
    const x = cx + f.x * R * 0.85 + Math.sin(t * f.w + f.o * 6) * R * 0.22;
    glowDot(ctx, x, y, size * f.s, col, 8, alpha);
  });
}

/** Six-fold ice crystal; `barbs` adds the dendrite branches of the epic tier. */
function crystal(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number,
  rot: number, col: string, a: number, barbs: boolean,
) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const an = (i / 6) * TAU;
    ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * R, Math.sin(an) * R);
    if (barbs) [0.46, 0.7].forEach((f) => {
      const bx = Math.cos(an) * R * f, by = Math.sin(an) * R * f;
      [-0.55, 0.55].forEach((d) => {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(an + d) * R * 0.22, by + Math.sin(an + d) * R * 0.22);
      });
    });
  }
  ctx.strokeStyle = ha(col, a); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

type Builder = (ctx: CanvasRenderingContext2D, w: number, h: number, mouse: Mouse, initial: string) => DrawFn;

const BUILDERS: Record<AvatarSkin, Builder> = {
  /* ── STARTER · 150 XP — one motion, flat body, no halo ────────────── */

  // VOLT — a single current packet running a closed trace
  volt: (ctx, w, h, mouse, initial) => () => {
    const t = performance.now() * 0.001, b = mouse.active ? 2.1 : 1;
    disc(ctx, w, h, initial, "#4CF294", "#0B7A3D", (cx, cy, R) => {
      ctx.strokeStyle = "rgba(255,255,255,.09)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(cx + i * R * 0.5, cy - R); ctx.lineTo(cx + i * R * 0.5, cy + R);
        ctx.moveTo(cx - R, cy + i * R * 0.5); ctx.lineTo(cx + R, cy + i * R * 0.5);
      }
      ctx.stroke();
      const rr = R * 0.66;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU);
      ctx.strokeStyle = "rgba(234,255,244,.28)"; ctx.lineWidth = 2; ctx.stroke();
      const a = (t * 1.15 * b) % TAU;
      for (let k = 0; k < 4; k++) {
        const aa = a - k * 0.15;
        glowDot(ctx, cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, 2.5 - k * 0.45, "#EAFFF4", 9, 0.95 - k * 0.22);
      }
    }, "#062E19");
  },

  // EMBER — a few sparks lifting off a warm base
  ember: (ctx, w, h, mouse, initial) => () => {
    const t = performance.now() * 0.001, b = mouse.active ? 1.8 : 1;
    disc(ctx, w, h, initial, "#FFB86B", "#A33D06", (cx, cy, R) => {
      tongues(ctx, cx, cy, R, t * b, 5, 0.26, 0.16, ["#FFB02E", "#FF7A2E"], 0.19, 0.5);
    }, "#3D1500", "rgba(50,15,0,.4)");
  },

  // FROST — slow drifting flakes
  frost: (ctx, w, h, mouse, initial) => {
    const fl = mkFlakes(9);
    return () => {
      const t = performance.now() * 0.001, b = mouse.active ? 2.2 : 1;
      disc(ctx, w, h, initial, "#A8E4FF", "#14568F", (cx, cy, R) => {
        fall(ctx, cx, cy, R, t * b, fl, "#EDF9FF", 1.5, 0.85);
      }, "#062338", "rgba(0,20,40,.38)");
    };
  },

  /* ── RARE · 400 XP — two layers, trails, inner glow ───────────────── */

  // ARC — violet dipole shells precessing, counter-orbiting charges
  arc: (ctx, w, h, mouse, initial) => () => {
    const t = performance.now() * 0.001, b = mouse.active ? 2.4 : 1;
    disc(ctx, w, h, initial, "#C4B4FF", "#3F23C4", (cx, cy, R) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.26 * b);
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath(); ctx.ellipse(0, 0, R * 0.26 * i, R * 0.78, 0, 0, TAU);
        ctx.strokeStyle = ha("#EFEAFF", 0.34 - i * 0.07); ctx.lineWidth = 1.4; ctx.stroke();
      }
      const oa = t * 1.25 * b;
      for (let k = 0; k < 3; k++) {
        const aa = oa - k * 0.18;
        glowDot(ctx, Math.cos(aa) * R * 0.52, Math.sin(aa) * R * 0.78, 2.3 - k * 0.5, "#FFFFFF", 10, 0.95 - k * 0.25);
        glowDot(ctx, -Math.cos(aa) * R * 0.52, -Math.sin(aa) * R * 0.78, 2.1 - k * 0.5, "#DDD2FF", 10, 0.8 - k * 0.22);
      }
      ctx.restore();
      stampGlow(ctx, cx, cy, R * 0.4, "#EFEAFF", 0.26);
    }, "#FFFFFF", "rgba(10,0,40,.4)");
  },

  // FIRE — layered flame body with a licking crown and heat bloom
  fire: (ctx, w, h, mouse, initial) => () => {
    const t = performance.now() * 0.001, b = mouse.active ? 1.9 : 1;
    disc(ctx, w, h, initial, "#FFC46B", "#B02A05", (cx, cy, R) => {
      stampGlow(ctx, cx, cy + R * 0.42, R * 0.8, "#FF7A2E", 0.3);
      tongues(ctx, cx, cy, R, t * b, 9, 0.3, 0.2, ["#FFD27A", "#FF7A2E", "#FF4B4B"], 0.24, 0.55);
      ctx.beginPath();
      for (let i = 0; i <= 22; i++) {
        const f = i / 22, x = cx - R + f * R * 2;
        const y = cy + R * 0.15 - Math.abs(Math.sin(f * 3.1 + t * 3 * b)) * R * 0.5 * (1 - Math.abs(f - 0.5) * 1.3);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = ha("#FFE9B8", 0.55); ctx.lineWidth = 1.6; ctx.stroke();
    }, "#431400", "rgba(60,15,0,.4)");
  },

  // SNOW — a turning crystal inside a steady snowfall
  snow: (ctx, w, h, mouse, initial) => {
    const fl = mkFlakes(14);
    return () => {
      const t = performance.now() * 0.001, b = mouse.active ? 2.2 : 1;
      disc(ctx, w, h, initial, "#CFEBFF", "#1E6BA8", (cx, cy, R) => {
        crystal(ctx, cx, cy, R * 0.72, t * 0.18 * b, "#FFFFFF", 0.4, false);
        fall(ctx, cx, cy, R, t * b, fl, "#FFFFFF", 1.6, 0.9);
        stampGlow(ctx, cx, cy, R * 0.45, "#EDF9FF", 0.22);
      }, "#08334F", "rgba(0,25,50,.36)");
    };
  },

  /* ── EPIC · 900 XP — three layers, turbulence, core bloom ─────────── */

  // CHARGED — hot nucleus, two counter-tilted orbitals, electron trails
  charged: (ctx, w, h, mouse, initial) => () => {
    const t = performance.now() * 0.001, b = mouse.active ? 2.2 : 1;
    disc(ctx, w, h, initial, "#FFE8B0", "#C25E05", (cx, cy, R) => {
      ctx.save(); ctx.translate(cx, cy);
      const pulse = 0.74 + 0.26 * Math.sin(t * 3 * b);
      stampGlow(ctx, 0, 0, R * 0.66 * pulse, "#FFF6D8", 0.4);
      [-0.55, 0.55].forEach((tilt, i) => {
        ctx.save(); ctx.rotate(tilt + t * 0.12 * (i ? -1 : 1));
        ctx.beginPath(); ctx.ellipse(0, 0, R * 0.8, R * 0.32, 0, 0, TAU);
        ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 1.5; ctx.stroke();
        const a = t * (1.8 + i * 0.7) * b + i * 2;
        for (let k = 0; k < 4; k++) {
          const aa = a - k * 0.19;
          glowDot(ctx, Math.cos(aa) * R * 0.8, Math.sin(aa) * R * 0.32, 2.4 - k * 0.42, "#FFFFFF", 10, 0.95 - k * 0.22);
        }
        ctx.restore();
      });
      ctx.restore();
    }, "#4A2A00", "rgba(70,30,0,.36)");
  },

  // MAGMA — cracked crust breathing over a molten core, ash lifting off
  magma: (ctx, w, h, mouse, initial) => {
    const cracks = Array.from({ length: 5 }, () => ({ a: rnd(0, TAU), l: rnd(0.4, 0.95), o: rnd(0, 6.28) }));
    return () => {
      const t = performance.now() * 0.001, b = mouse.active ? 1.9 : 1;
      disc(ctx, w, h, initial, "#FF8A5B", "#4A0A02", (cx, cy, R) => {
        const beat = 0.6 + 0.4 * Math.sin(t * 1.6 * b);
        stampGlow(ctx, cx, cy + R * 0.3, R * (0.75 + beat * 0.25), "#FF4B4B", 0.4);
        cracks.forEach((c) => {
          const gl = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.2 * b + c.o));
          ctx.beginPath(); ctx.moveTo(cx, cy);
          let x = cx, y = cy;
          for (let k = 1; k <= 4; k++) {
            const f = k / 4;
            const an = c.a + Math.sin(f * 3 + c.o) * 0.6;
            x = cx + Math.cos(an) * R * c.l * f; y = cy + Math.sin(an) * R * c.l * f;
            ctx.lineTo(x, y);
          }
          ctx.strokeStyle = ha("#FFD27A", gl * 0.85); ctx.lineWidth = 2.2 - c.l; ctx.stroke();
          glowDot(ctx, x, y, 1.6, "#FFE9B8", 9, gl);
        });
        tongues(ctx, cx, cy, R, t * b, 12, 0.34, 0.22, ["#FFD27A", "#FF7A2E", "#FF4B4B"], 0.24, 0.42);
        stampGlow(ctx, cx, cy + R * 0.45, R * 0.42 * beat, "#FFF3C8", 0.3);
      }, "#FFF0DC", "rgba(40,5,0,.44)");
    };
  },

  // GLACIER — refracting shards, an aurora sheen and a barbed crystal
  glacier: (ctx, w, h, mouse, initial) => {
    const fl = mkFlakes(16);
    const shards = Array.from({ length: 6 }, () => ({ a: rnd(0, TAU), r: rnd(0.35, 0.85), s: rnd(0.5, 1), o: rnd(0, 6.28) }));
    return () => {
      const t = performance.now() * 0.001, b = mouse.active ? 2.3 : 1;
      disc(ctx, w, h, initial, "#DFF6FF", "#0B4C7A", (cx, cy, R) => {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          for (let k = 0; k <= 18; k++) {
            const f = k / 18, x = cx - R + f * R * 2;
            const y = cy + (i - 1) * R * 0.34 + Math.sin(f * 4 + t * (0.6 + i * 0.3) * b + i) * R * 0.14;
            if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.strokeStyle = ha(["#5BC8FF", "#EDF9FF", "#9A85FF"][i], 0.3);
          ctx.lineWidth = 3 - i * 0.6; ctx.stroke();
        }
        shards.forEach((s) => {
          const an = s.a + t * 0.12 * b, x = cx + Math.cos(an) * R * s.r, y = cy + Math.sin(an) * R * s.r;
          ctx.save(); ctx.translate(x, y); ctx.rotate(an + t * 0.5);
          ctx.beginPath();
          ctx.moveTo(0, -R * 0.16 * s.s); ctx.lineTo(R * 0.07 * s.s, 0);
          ctx.lineTo(0, R * 0.16 * s.s); ctx.lineTo(-R * 0.07 * s.s, 0);
          ctx.closePath();
          ctx.fillStyle = ha("#EDF9FF", 0.3 + 0.25 * Math.sin(t * 2 + s.o)); ctx.fill();
          ctx.restore();
        });
        crystal(ctx, cx, cy, R * 0.66, -t * 0.2 * b, "#FFFFFF", 0.45, true);
        fall(ctx, cx, cy, R, t * b, fl, "#FFFFFF", 1.5, 0.85);
        stampGlow(ctx, cx, cy, R * 0.5, "#DFF6FF", 0.28);
      }, "#04314F", "rgba(0,25,50,.4)");
    };
  },

  /* ── LEGENDARY · 2,000 XP — full-disc colour, multi-hue, bloom ────── */

  // PRISM — spectral rotor sweep, crossing polarization chords, motes
  prism: (ctx, w, h, mouse, initial) => {
    const cols = ["#5BFF9F", "#22D86B", "#9A85FF", "#FFBE52"];
    const motes = Array.from({ length: 8 }, (_, i) => ({ a: rnd(0, TAU), r: rnd(0.3, 0.92), s: rnd(0.5, 1.1), c: cols[i % 4] }));
    return () => {
      const t = performance.now() * 0.001, b = mouse.active ? 2.6 : 1;
      const spin = t * 0.5 * b;
      disc(ctx, w, h, initial, "#16382A", "#03100A", (cx, cy, R) => {
        ctx.save(); ctx.translate(cx, cy);
        for (let s = 0; s < 4; s++) {
          const a0 = spin + (s / 4) * TAU;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a0 + TAU / 4.4); ctx.closePath();
          const g = ctx.createLinearGradient(Math.cos(a0) * R, Math.sin(a0) * R, -Math.cos(a0) * R * 0.4, -Math.sin(a0) * R * 0.4);
          g.addColorStop(0, ha(cols[s], 0.55)); g.addColorStop(1, ha(cols[s], 0));
          ctx.fillStyle = g; ctx.fill();
        }
        for (let i = 0; i < 3; i++) {
          const a = spin * 1.7 + (i / 3) * TAU;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92);
          ctx.quadraticCurveTo(0, 0, -Math.cos(a) * R * 0.92, -Math.sin(a) * R * 0.92);
          ctx.strokeStyle = ha("#EAFFF4", 0.34); ctx.lineWidth = 1.2; ctx.stroke();
        }
        motes.forEach((m) => {
          m.a += 0.005 * m.s * b;
          glowDot(ctx, Math.cos(m.a) * R * m.r, Math.sin(m.a) * R * m.r, 1.5 * m.s, m.c, 9, 0.85);
        });
        stampGlow(ctx, 0, 0, R * 0.55, "#EAFFF4", 0.38);
        ctx.restore();
      }, "#FFFFFF", "rgba(0,0,0,.42)");
    };
  },

  // SUPERNOVA — a collapsing core that fires shockwaves and rays
  supernova: (ctx, w, h, mouse, initial) => {
    const sparks = Array.from({ length: 10 }, () => ({ a: rnd(0, TAU), o: Math.random(), s: rnd(0.6, 1.2) }));
    return () => {
      const t = performance.now() * 0.001, b = mouse.active ? 2.2 : 1;
      disc(ctx, w, h, initial, "#FFF3C8", "#8A4A00", (cx, cy, R) => {
        const beat = (t * 0.55 * b) % 1;
        for (let k = 0; k < 3; k++) {
          const f = (beat + k / 3) % 1;
          ctx.beginPath(); ctx.arc(cx, cy, R * 0.2 + f * R * 0.95, 0, TAU);
          ctx.strokeStyle = ha(["#FFD27A", "#FFFFFF", "#FF7A2E"][k], (1 - f) * 0.6);
          ctx.lineWidth = 2.4 * (1 - f) + 0.6; ctx.stroke();
        }
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * TAU + t * 0.3 * b;
          const len = R * (0.5 + 0.42 * Math.abs(Math.sin(t * 2 * b + k)));
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2);
          ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
          ctx.strokeStyle = ha(k % 2 ? "#FFFFFF" : "#FFD27A", 0.42); ctx.lineWidth = 1.3; ctx.stroke();
        }
        sparks.forEach((s) => {
          const f = (t * 0.3 * b + s.o) % 1;
          glowDot(ctx, cx + Math.cos(s.a) * R * f, cy + Math.sin(s.a) * R * f, 1.7 * s.s * (1 - f), "#FFFFFF", 10, 1 - f);
        });
        stampGlow(ctx, cx, cy, R * (0.34 + 0.14 * Math.sin(t * 4 * b)), "#FFFFFF", 0.6);
      }, "#5A2E00", "rgba(60,25,0,.4)");
    };
  },

  // AURORA — polar curtains over a night sky, with stars
  aurora: (ctx, w, h, mouse, initial) => {
    const stars = Array.from({ length: 16 }, () => ({ x: rnd(-1, 1), y: rnd(-1, 1), o: rnd(0, 6.28), s: rnd(0.5, 1) }));
    const cols = ["#5BFF9F", "#22D86B", "#9A85FF", "#5BC8FF"];
    return () => {
      const t = performance.now() * 0.001, b = mouse.active ? 2.3 : 1;
      disc(ctx, w, h, initial, "#0E2A3A", "#04121A", (cx, cy, R) => {
        stars.forEach((s) =>
          glowDot(ctx, cx + s.x * R * 0.9, cy + s.y * R * 0.9, 1.1 * s.s, "#EAFFF4", 6,
            0.4 + 0.5 * Math.abs(Math.sin(t * 1.4 + s.o))));
        for (let i = 0; i < 4; i++) {
          const col = cols[i], amp = R * (0.16 + i * 0.05);
          const curtain = (f: number) =>
            cy + (i - 1.5) * R * 0.28 + Math.sin(f * 3.4 + t * (0.7 + i * 0.25) * b + i * 1.4) * amp;
          ctx.beginPath();
          for (let k = 0; k <= 20; k++) {
            const f = k / 20, x = cx - R + f * R * 2;
            if (k) ctx.lineTo(x, curtain(f)); else ctx.moveTo(x, curtain(f));
          }
          for (let k = 20; k >= 0; k--) {
            const f = k / 20, x = cx - R + f * R * 2;
            ctx.lineTo(x, curtain(f) + R * 0.2);
          }
          ctx.closePath();
          const g = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
          g.addColorStop(0, ha(col, 0.05)); g.addColorStop(0.5, ha(col, 0.4)); g.addColorStop(1, ha(col, 0.05));
          ctx.fillStyle = g; ctx.fill();
        }
        stampGlow(ctx, cx, cy, R * 0.55, "#5BFF9F", 0.16);
      }, "#FFFFFF", "rgba(0,10,20,.44)");
    };
  },
};

/** Build the per-frame draw function for an avatar skin. Mirrors makeVariant(). */
export function makeAvatarVariant(
  skin: AvatarSkin,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mouse: Mouse,
  initial: string,
): DrawFn {
  return BUILDERS[skin](ctx, w, h, mouse, initial);
}
