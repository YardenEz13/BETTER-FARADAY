import { gsap, prefersReducedMotion } from "../../lib/gsapUtils";
import {
  type FaradayVariant,
  type Mouse,
  type GetP,
  type DrawFn,
  ha,
  rnd,
  clamp,
  lerp,
  glowDot,
  stampGlow,
  makeBuckets,
  addSeg,
  strokeBuckets,
} from "./types";

/**
 * Build the per-frame draw function for a variant. Particle state lives in the
 * returned closure; the harness calls draw() each frame (or once when motion is
 * reduced). The palette is read fresh every frame via getP() so theme can swap
 * without restarting the loop.
 *
 * Each variant is a real Faraday-era physics phenomenon. These are the reward
 * backdrops equipped behind the learning map (shop `theme` items), redesigned
 * for depth/physics/reactivity from the design lab (Reward Theme Lab.dc.html).
 * Price tier tracks richness: linesOfForce (300 XP, restrained — also the login
 * gate) → … → effect (1000 XP, the showpiece). The RAF harness lives in
 * FaradayCanvas.tsx; this module only supplies the draw() builders.
 *
 * Perf contract: glowDot() sprite-caches small halos, stampGlow() sprite-caches
 * big blooms, strokeBuckets()/addSeg() batches lines. No per-frame shadowBlur,
 * no per-pair stroke().
 */
export function makeVariant(
  variant: FaradayVariant,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mouse: Mouse,
  getP: GetP,
): DrawFn {
  switch (variant) {
    // ── Bohr atoms — 3 parallax depth bands, orbital clouds, multi-electron
    // motion-blur trails, white-hot nuclei; the cursor acts as a charge that
    // excites nearby atoms (electrons speed up, nucleus flares). ──
    case "atom": {
      type Ring = { rx: number; ry: number; tilt: number; els: { ang: number; spd: number }[] };
      const atoms = Array.from({ length: 11 }, () => {
        const depth = rnd(0.28, 1);
        const scale = 0.55 + depth * 0.95;
        const nRings = depth > 0.7 ? 3 : depth > 0.45 ? 2 : 1;
        const rings: Ring[] = Array.from({ length: nRings }, (_, r) => ({
          rx: (28 + r * 15) * scale,
          ry: (12 + r * 6) * scale,
          tilt: rnd(0, Math.PI),
          els: Array.from({ length: 1 + (r % 2) }, () => ({
            ang: rnd(0, 6.28),
            spd: rnd(0.018, 0.05) * (Math.random() < 0.5 ? 1 : -1),
          })),
        }));
        return {
          x: rnd(0, w), y: rnd(0, h),
          vx: rnd(-0.55, 0.55) * (0.4 + depth * 0.6),
          vy: rnd(-0.42, 0.42) * (0.4 + depth * 0.6),
          depth, scale, rings,
          spin: rnd(0.003, 0.012) * (Math.random() < 0.5 ? 1 : -1),
        };
      }).sort((a, b) => a.depth - b.depth);
      return () => {
        const p = getP();
        const t = performance.now() * 0.001;
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        atoms.forEach((a) => {
          a.x += a.vx;
          a.y += a.vy;
          const M = a.scale * 90;
          if (a.x < -M) a.x = w + M;
          if (a.x > w + M) a.x = -M;
          if (a.y < -M) a.y = h + M;
          if (a.y > h + M) a.y = -M;
          let ox = 0, oy = 0, exc = 0;
          if (mouse.active) {
            const dx = mouse.x - a.x, dy = mouse.y - a.y, d = Math.hypot(dx, dy) || 1;
            ox = dx * 0.02 * a.depth;
            oy = dy * 0.02 * a.depth;
            exc = Math.max(0, 1 - d / 260);
          }
          const cx = a.x + ox, cy = a.y + oy;
          const base = 0.35 + a.depth * 0.5;
          stampGlow(ctx, cx, cy, 26 * a.scale, p.green, (p.glow ? 0.16 : 0.08) * base * (1 + exc));
          a.rings.forEach((r) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(r.tilt + t * a.spin);
            ctx.beginPath();
            ctx.ellipse(0, 0, r.rx, r.ry, 0, 0, 6.2832);
            ctx.fillStyle = ha(p.green, (p.glow ? 0.05 : 0.03) * base);
            ctx.fill();
            ctx.strokeStyle = ha(p.green, (p.glow ? 0.3 : 0.2) * base);
            ctx.lineWidth = 1.1 * a.scale;
            ctx.stroke();
            r.els.forEach((e) => {
              e.ang += e.spd * (1 + exc * 2.2);
              // 4-sample motion-blur trail behind each electron
              for (let s = 0; s < 4; s++) {
                const aa = e.ang - s * 0.16 * Math.sign(e.spd);
                glowDot(
                  ctx,
                  Math.cos(aa) * r.rx, Math.sin(aa) * r.ry,
                  (2.6 - s * 0.45) * a.scale,
                  p.spark, p.glow ? 10 : 5,
                  base * (1 - s * 0.22),
                );
              }
            });
            ctx.restore();
          });
          glowDot(
            ctx, cx, cy,
            (2.4 + a.depth * 1.8) * a.scale,
            exc > 0.2 ? p.hot : p.green,
            p.glow ? 14 : 7,
            Math.min(1, base + exc * 0.5),
          );
        });
        ctx.restore();
      };
    }

    // ── Knowledge constellation — near/far star layers with twinkle + nebula
    // depth, concept nodes with orbiting satellites and travelling "learned
    // path" sparks between topics, and a brighter gravitational-lens cursor. ──
    case "constellation": {
      const nNear = Math.min(120, Math.round((w * h) / 13000));
      const nFar = Math.min(150, Math.round((w * h) / 9000));
      const stars = Array.from({ length: nNear }, () => ({
        x: rnd(0, w), y: rnd(0, h), vx: rnd(-0.26, 0.26), vy: rnd(-0.26, 0.26), tw: rnd(0, 6.28),
      }));
      const farStars = Array.from({ length: nFar }, () => ({
        x: rnd(0, w), y: rnd(0, h), r: rnd(0.4, 1.2), tw: rnd(0, 6.28), tws: rnd(0.6, 1.8),
      }));
      const concepts = [
        { label: "טריג'", x: rnd(0.12, 0.28) * w, y: rnd(0.18, 0.36) * h },
        { label: "אלגברה", x: rnd(0.52, 0.72) * w, y: rnd(0.14, 0.32) * h },
        { label: "פונקציות", x: rnd(0.18, 0.36) * w, y: rnd(0.56, 0.74) * h },
        { label: "חשבון", x: rnd(0.62, 0.8) * w, y: rnd(0.52, 0.7) * h },
        { label: "גיאומטריה", x: rnd(0.35, 0.55) * w, y: rnd(0.32, 0.5) * h },
      ];
      const nebula = Array.from({ length: 4 }, () => ({
        x: rnd(0.15, 0.85) * w, y: rnd(0.15, 0.85) * h, r: rnd(120, 240),
        c: (Math.random() < 0.5 ? "violet" : "green") as "violet" | "green",
        ph: rnd(0, 6.28),
      }));
      const D = 132;
      return () => {
        const p = getP();
        const t = performance.now() * 0.001;
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        nebula.forEach((nb) =>
          stampGlow(ctx, nb.x, nb.y, nb.r, p[nb.c], (p.glow ? 0.07 : 0.03) * (0.7 + 0.3 * Math.sin(t * 0.3 + nb.ph))),
        );
        farStars.forEach((s) => {
          const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * s.tws + s.tw));
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, 6.2832);
          ctx.fillStyle = ha(p.green, a * (p.glow ? 0.7 : 0.5));
          ctx.fill();
        });
        stars.forEach((s) => {
          s.x += s.vx; s.y += s.vy;
          if (s.x < 0 || s.x > w) s.vx *= -1;
          if (s.y < 0 || s.y > h) s.vy *= -1;
          if (mouse.active) {
            const dx = s.x - mouse.x, dy = s.y - mouse.y, d = Math.hypot(dx, dy);
            if (d < 120 && d > 0.5) { const f = ((120 - d) / 120) * 2.4; s.x += (dx / d) * f; s.y += (dy / d) * f; }
          }
        });
        const lb = makeBuckets();
        for (let i = 0; i < stars.length; i++) {
          for (let j = i + 1; j < stars.length; j++) {
            const a = stars[i], b = stars[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < D) addSeg(lb, a.x, a.y, b.x, b.y, 1 - d / D);
          }
        }
        strokeBuckets(ctx, lb, p.green, p.glow ? 0.34 : 0.2, 0.9);
        const cb = makeBuckets();
        stars.forEach((s) =>
          concepts.forEach((cn) => {
            const d = Math.hypot(s.x - cn.x, s.y - cn.y);
            if (d < D * 1.3) addSeg(cb, s.x, s.y, cn.x, cn.y, 1 - d / (D * 1.3));
          }),
        );
        strokeBuckets(ctx, cb, p.violet, p.glow ? 0.4 : 0.22, 0.9);
        for (let i = 0; i < concepts.length; i++) {
          for (let j = i + 1; j < concepts.length; j++) {
            const a = concepts[i], b = concepts[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < D * 2.2) {
              const al = (1 - d / (D * 2.2)) * 0.5;
              ctx.strokeStyle = ha(p.violet, al);
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
              // spark travelling the "learned path" between two topics
              const tp = (t * 0.25 + (i + j) * 0.2) % 1;
              glowDot(ctx, lerp(a.x, b.x, tp), lerp(a.y, b.y, tp), 2, p.spark, p.glow ? 10 : 5, Math.min(1, al * 1.8));
            }
          }
        }
        if (mouse.active) {
          const mb = makeBuckets();
          stars.forEach((s) => {
            const d = Math.hypot(s.x - mouse.x, s.y - mouse.y);
            if (d < 190) addSeg(mb, mouse.x, mouse.y, s.x, s.y, 1 - d / 190);
          });
          strokeBuckets(ctx, mb, p.spark, 0.6, 1);
          stampGlow(ctx, mouse.x, mouse.y, 60, p.spark, p.glow ? 0.2 : 0.1);
          glowDot(ctx, mouse.x, mouse.y, 5, p.spark, 16);
        }
        stars.forEach((s) => {
          glowDot(ctx, s.x, s.y, 1.9, p.green, p.glow ? 6 : 3, 0.7 + 0.3 * Math.sin(t * 2 + s.tw));
        });
        ctx.restore();
        concepts.forEach((cn, i) => {
          const ph = ((t * 0.4) + i * 0.42) % 1;
          ctx.beginPath();
          ctx.arc(cn.x, cn.y, 10 + ph * 36, 0, 6.2832);
          ctx.strokeStyle = ha(p.violet, (1 - ph) * 0.5);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          const oa = t * 0.9 + i;
          glowDot(ctx, cn.x + Math.cos(oa) * 15, cn.y + Math.sin(oa) * 15, 1.6, p.spark, p.glow ? 8 : 4);
          stampGlow(ctx, cn.x, cn.y, 30, p.violet, p.glow ? 0.14 : 0.06);
          glowDot(ctx, cn.x, cn.y, 5.5, p.violet, p.glow ? 16 : 10);
          ctx.save();
          ctx.font = "700 13px Assistant, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.direction = "rtl";
          ctx.fillStyle = ha(p.violet, 0.9);
          ctx.fillText(cn.label, cn.x, cn.y + 10);
          ctx.restore();
        });
      };
    }

    // ── PCB — Manhattan-routed copper mesh with solder pads/vias, current
    // packets travelling the traces, traces energising in sequence, and a
    // cursor probe that lights the board and ripples outward. ──
    case "circuit": {
      type Pt = { x: number; y: number };
      type Trace = { pts: Pt[]; len: number; off: number; speed: number; phase: number; path: Path2D };
      const cols = 7, rows = 5;
      const gx = (i: number) => (w * (i + 0.5)) / cols;
      const gy = (j: number) => (h * (j + 0.5)) / rows;
      const ri = (n: number) => Math.floor(Math.random() * n);
      const buildPath = (pts: Pt[]) => {
        const pth = new Path2D();
        pth.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) pth.lineTo(pts[k].x, pts[k].y);
        return pth;
      };
      const ptAt = (tr: Trace, s: number): Pt => {
        let target = s * tr.len;
        for (let k = 1; k < tr.pts.length; k++) {
          const a = tr.pts[k - 1], b = tr.pts[k];
          const seg = Math.hypot(b.x - a.x, b.y - a.y);
          if (target <= seg || k === tr.pts.length - 1) {
            const f = seg ? target / seg : 0;
            return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) };
          }
          target -= seg;
        }
        return tr.pts[0];
      };
      const traces: Trace[] = [];
      for (let n = 0; n < 9; n++) {
        let ci = ri(cols), rj = ri(rows);
        const pts: Pt[] = [{ x: gx(ci), y: gy(rj) }];
        const steps = 3 + ri(3);
        for (let s = 0; s < steps; s++) {
          if (Math.random() < 0.5) ci = clamp(ci + (Math.random() < 0.5 ? 1 : -1), 0, cols - 1);
          else rj = clamp(rj + (Math.random() < 0.5 ? 1 : -1), 0, rows - 1);
          const last = pts[pts.length - 1];
          pts.push({ x: gx(ci), y: last.y }); // horizontal leg
          pts.push({ x: gx(ci), y: gy(rj) }); // vertical leg (Manhattan routing)
        }
        let len = 0;
        for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
        traces.push({ pts, len, off: rnd(0, 1), speed: rnd(0.05, 0.12), phase: rnd(0, 6.28), path: buildPath(pts) });
      }
      const pads: { x: number; y: number; ph: number }[] = [];
      traces.forEach((tr) => {
        pads.push({ x: tr.pts[0].x, y: tr.pts[0].y, ph: rnd(0, 6.28) });
        pads.push({ x: tr.pts[tr.pts.length - 1].x, y: tr.pts[tr.pts.length - 1].y, ph: rnd(0, 6.28) });
      });
      const ripples: { x: number; y: number; t: number }[] = [];
      let lastRx = -999, lastRy = -999;
      return () => {
        const p = getP();
        const t = performance.now() * 0.001;
        if (mouse.active && Math.hypot(mouse.x - lastRx, mouse.y - lastRy) > 46) {
          ripples.push({ x: mouse.x, y: mouse.y, t: performance.now() });
          lastRx = mouse.x; lastRy = mouse.y;
          if (ripples.length > 12) ripples.shift();
        }
        ctx.clearRect(0, 0, w, h);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        // dim copper underlay
        traces.forEach((tr) => {
          ctx.strokeStyle = ha(p.green, p.glow ? 0.12 : 0.1);
          ctx.lineWidth = 2;
          ctx.stroke(tr.path);
        });
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        traces.forEach((tr) => {
          let energy = 0.5 + 0.5 * Math.sin(t * 0.8 + tr.phase);
          if (mouse.active) {
            const mid = ptAt(tr, 0.5);
            energy = Math.max(energy, 1 - Math.hypot(mid.x - mouse.x, mid.y - mouse.y) / 260);
          }
          ctx.strokeStyle = ha(p.spark, (p.glow ? 0.3 : 0.2) * energy);
          ctx.lineWidth = 4.5;
          ctx.stroke(tr.path);
          ctx.strokeStyle = ha(p.spark, 0.85 * energy);
          ctx.lineWidth = 1.8;
          ctx.stroke(tr.path);
          for (let q = 0; q < 2; q++) {
            const pt = ptAt(tr, (t * tr.speed + tr.off + q * 0.5) % 1);
            glowDot(ctx, pt.x, pt.y, 2.6, p.hot, p.glow ? 12 : 6, 0.5 + 0.5 * energy);
          }
        });
        pads.forEach((pd) => {
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.6 + pd.ph);
          ctx.beginPath();
          ctx.arc(pd.x, pd.y, 9 + pulse * 10, 0, 6.2832);
          ctx.strokeStyle = ha(p.green, (1 - pulse) * 0.4);
          ctx.lineWidth = 1.6;
          ctx.stroke();
          glowDot(ctx, pd.x, pd.y, 3.4, p.green, p.glow ? 12 : 6);
          ctx.beginPath();
          ctx.arc(pd.x, pd.y, 1.6, 0, 6.2832);
          ctx.fillStyle = p.glow ? p.hot : "#fff";
          ctx.fill();
        });
        for (let k = ripples.length - 1; k >= 0; k--) {
          const rp = ripples[k];
          const age = performance.now() - rp.t;
          const a = 1 - age / 1100;
          if (a <= 0) { ripples.splice(k, 1); continue; }
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, age * 0.28, 0, 6.2832);
          ctx.strokeStyle = ha(p.spark, a * 0.55);
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        if (mouse.active) {
          stampGlow(ctx, mouse.x, mouse.y, 55, p.spark, p.glow ? 0.18 : 0.09);
          glowDot(ctx, mouse.x, mouse.y, 4, p.spark, 14);
        }
        ctx.restore();
      };
    }

    // ── Electromagnetic induction — a real solenoid threaded by a moving bar
    // magnet (cursor-driven, else auto-sweeps). Changing flux drives induced
    // current racing the windings and brightening the coil (Lenz's law feel). ──
    case "induction": {
      const cy = h * 0.5;
      const loops = Math.max(10, Math.round(w / 46));
      const coilX0 = w * 0.16, coilX1 = w * 0.84;
      const coilR = Math.min(h * 0.2, 74);
      const loopGap = (coilX1 - coilX0) / loops;
      const coilC = (coilX0 + coilX1) / 2;
      let magX = coilC;
      let prevFlux: number | null = null;
      let current = 0;
      return () => {
        const p = getP();
        const t = performance.now() * 0.001;
        ctx.clearRect(0, 0, w, h);
        const target = mouse.active ? clamp(mouse.x, 0, w) : w * 0.5 + Math.sin(t * 0.6) * (w * 0.42);
        magX = lerp(magX, target, mouse.active ? 0.18 : 0.06);
        const magY = mouse.active ? lerp(cy, clamp(mouse.y, cy - coilR, cy + coilR), 0.3) : cy;
        // Gaussian flux linkage: peaks as the magnet passes the coil centre.
        const flux = Math.exp(-Math.pow(((magX - coilC) / (coilX1 - coilX0)) * 2.4, 2));
        if (prevFlux === null) prevFlux = flux;
        const dPhi = flux - prevFlux;
        prevFlux = flux;
        current = lerp(current, clamp(dPhi * 60, -1, 1), 0.25);
        const iMag = Math.abs(current), dir = current >= 0 ? 1 : -1;

        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        // magnet dipole field rings
        for (let k = 1; k <= 6; k++) {
          const spread = k / 6;
          ctx.beginPath();
          ctx.ellipse(magX, magY, spread * (w * 0.22) + 24, spread * coilR * 2.1 + 12, 0, 0, 6.2832);
          ctx.strokeStyle = ha(p.violet, (p.glow ? 0.16 : 0.1) * (1 - spread * 0.6));
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
        for (let s = 0; s < 3; s++) {
          const fp = (t * 0.5 + s / 3) % 1;
          glowDot(ctx, magX + (fp - 0.5) * w * 0.4, magY, 1.8, p.violet, p.glow ? 8 : 4, 0.6 * (1 - Math.abs(fp - 0.5) * 2));
        }
        // solenoid windings — back half then front half, brightness ∝ |current|
        const coilBright = (p.glow ? 0.22 : 0.16) + iMag * 0.6;
        ctx.strokeStyle = ha(p.green, p.glow ? 0.2 : 0.14);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(coilX0 - 24, cy); ctx.lineTo(coilX0, cy);
        ctx.moveTo(coilX1, cy); ctx.lineTo(coilX1 + 24, cy);
        ctx.stroke();
        for (let i = 0; i < loops; i++) {
          const lx = coilX0 + (i + 0.5) * loopGap;
          ctx.beginPath();
          ctx.ellipse(lx, cy, loopGap * 0.62, coilR, 0, Math.PI * 0.15, Math.PI * 0.85);
          ctx.strokeStyle = ha(p.green, coilBright * 0.5);
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
        for (let i = 0; i < loops; i++) {
          const lx = coilX0 + (i + 0.5) * loopGap;
          ctx.beginPath();
          ctx.ellipse(lx, cy, loopGap * 0.62, coilR, 0, Math.PI * 0.85, Math.PI * 2.15);
          ctx.strokeStyle = ha(p.green, coilBright);
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        // induced-current charges racing the winding; density + speed ∝ current
        const nCharges = Math.round(6 + iMag * 18);
        for (let c = 0; c < nCharges; c++) {
          const f = ((((t * (0.4 + iMag * 2.2) * dir) + c / nCharges) % 1) + 1) % 1;
          const lx = coilX0 + f * (coilX1 - coilX0);
          const wind = f * loops * Math.PI * 2;
          const front = Math.cos(wind) > 0;
          glowDot(ctx, lx, cy + Math.sin(wind) * coilR, front ? 2.6 : 1.6, front ? p.hot : p.spark, p.glow ? 12 : 6, (front ? 0.9 : 0.4) * (0.3 + iMag));
        }
        if (iMag > 0.02) stampGlow(ctx, coilC, cy, (coilX1 - coilX0) * 0.5, p.spark, (p.glow ? 0.12 : 0.06) * iMag);
        // the bar magnet, N/S poles
        const mw = 30, mh = coilR * 0.7;
        stampGlow(ctx, magX, magY, 40, p.green, p.glow ? 0.14 : 0.06);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = ha(p.green, p.glow ? 0.92 : 0.82);
        ctx.fillRect(magX - mw, magY - mh / 2, mw, mh);
        ctx.fillStyle = ha(p.violet, p.glow ? 0.92 : 0.82);
        ctx.fillRect(magX, magY - mh / 2, mw, mh);
        ctx.strokeStyle = ha(p.glow ? p.hot : "#0C140E", 0.4);
        ctx.lineWidth = 1;
        ctx.strokeRect(magX - mw, magY - mh / 2, mw * 2, mh);
        ctx.fillStyle = "#fff";
        ctx.font = "700 12px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("N", magX - mw / 2, magY);
        ctx.fillText("S", magX + mw / 2, magY);
        ctx.restore();
      };
    }

    // ── Magnetic lines of force — dipole with integrated streamline field lines
    // traced N→S, iron-filing grid, flowing test charges, labelled poles, and a
    // cursor third pole that re-routes the whole field. Restrained (entry tier,
    // also runs on the login gate). ──
    case "linesOfForce": {
      const poles = [
        { x: w * 0.28, y: h * 0.34, s: 1 },
        { x: w * 0.72, y: h * 0.66, s: -1 },
      ];
      const fieldAt = (x: number, y: number): [number, number] => {
        let fx = 0, fy = 0;
        const all = poles.slice();
        if (mouse.active) all.push({ x: mouse.x, y: mouse.y, s: 1.5 });
        for (const c of all) {
          const dx = x - c.x, dy = y - c.y;
          let r2 = dx * dx + dy * dy;
          if (r2 < 90) r2 = 90;
          const inv = c.s / (r2 * Math.sqrt(r2));
          fx += dx * inv * 1400;
          fy += dy * inv * 1400;
        }
        return [fx, fy];
      };
      const sp = 46;
      const grid: { x: number; y: number }[] = [];
      for (let x = sp * 0.5; x < w; x += sp) for (let y = sp * 0.5; y < h; y += sp) grid.push({ x, y });
      const flow = Array.from({ length: 80 }, () => ({ x: rnd(0, w), y: rnd(0, h), life: rnd(0, 80) }));
      return () => {
        const p = getP();
        ctx.clearRect(0, 0, w, h);
        ctx.lineCap = "round";
        // iron filings — grid segments aligned to the field
        const gb = makeBuckets();
        grid.forEach((g) => {
          const [fx, fy] = fieldAt(g.x, g.y);
          const mag = Math.hypot(fx, fy);
          if (mag < 5e-5) return;
          const a = Math.atan2(fy, fx);
          const len = Math.min(sp * 0.4, 4 + mag * 6);
          const al = Math.min(0.4, 0.06 + mag * 0.4);
          addSeg(gb, g.x - Math.cos(a) * len, g.y - Math.sin(a) * len, g.x + Math.cos(a) * len, g.y + Math.sin(a) * len, al / 0.4);
        });
        strokeBuckets(ctx, gb, p.green, 0.4, 1.2);
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        // integrated field lines, streamed from the + pole toward the − pole
        const plus = poles[0];
        for (let n = 0; n < 12; n++) {
          const a0 = (n / 12) * Math.PI * 2;
          let x = plus.x + Math.cos(a0) * 12, y = plus.y + Math.sin(a0) * 12;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let step = 0; step < 120; step++) {
            const [fx, fy] = fieldAt(x, y);
            const m = Math.hypot(fx, fy) || 1;
            x += (fx / m) * 6;
            y += (fy / m) * 6;
            if (x < -20 || x > w + 20 || y < -20 || y > h + 20) break;
            ctx.lineTo(x, y);
            if (Math.hypot(x - poles[1].x, y - poles[1].y) < 12) break;
          }
          ctx.strokeStyle = ha(p.green, p.glow ? 0.22 : 0.15);
          ctx.lineWidth = 1.3;
          ctx.stroke();
        }
        flow.forEach((f) => {
          const [fx, fy] = fieldAt(f.x, f.y);
          const m = Math.hypot(fx, fy) || 1;
          f.x += (fx / m) * 1.6;
          f.y += (fy / m) * 1.6;
          f.life -= 1;
          if (f.life <= 0 || f.x < -8 || f.x > w + 8 || f.y < -8 || f.y > h + 8) {
            f.x = rnd(0, w); f.y = rnd(0, h); f.life = rnd(60, 120);
          }
          glowDot(ctx, f.x, f.y, 1.8, p.spark, p.glow ? 8 : 4);
        });
        ctx.restore();
        const br = 0.5 + 0.5 * Math.sin(performance.now() * 0.002);
        poles.forEach((c, i) => {
          const col = i === 0 ? p.green : p.violet;
          stampGlow(ctx, c.x, c.y, 34 + br * 6, col, p.glow ? 0.16 : 0.08);
          glowDot(ctx, c.x, c.y, 7, col, p.glow ? 20 : 10);
          ctx.fillStyle = "#fff";
          ctx.font = "700 13px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(i === 0 ? "N" : "S", c.x, c.y);
        });
        if (mouse.active) {
          stampGlow(ctx, mouse.x, mouse.y, 40, p.spark, p.glow ? 0.16 : 0.08);
          glowDot(ctx, mouse.x, mouse.y, 8, p.spark, 16);
        }
      };
    }

    // ── Faraday cage — shielding made visible. Depth-layered charges swarm a
    // rotating 3D wire box; proximity links form a graph, but the cage SEVERS
    // any link that would cross it (clipEntry) and sparks at the cut, while the
    // interior stays calm with a safe-glow. Bars shimmer, corners arc, cursor
    // charge. Also the landing-page hero (RolePage). ──
    case "cage": {
      const isMobile = w < 768;
      const cage = isMobile
        ? { x0: w * 0.16, y0: h * 0.05, x1: w * 0.84, y1: h * 0.4 }
        : { x0: w * 0.34, y0: h * 0.28, x1: w * 0.66, y1: h * 0.74 };
      const inside = (x: number, y: number) => x > cage.x0 && x < cage.x1 && y > cage.y0 && y < cage.y1;
      const ccx = (cage.x0 + cage.x1) / 2;
      const ccy = (cage.y0 + cage.y1) / 2;
      // shield margin: the cursor charge is repelled a little OUTSIDE the box too
      const shield = { x0: cage.x0 - 20, y0: cage.y0 - 20, x1: cage.x1 + 20, y1: cage.y1 + 20 };
      const inShield = (x: number, y: number) => x > shield.x0 && x < shield.x1 && y > shield.y0 && y < shield.y1;
      const N = isMobile ? 40 : 74;
      const ps = Array.from({ length: N }, () => {
        const depth = rnd(0.4, 1);
        let x = 0, y = 0, tries = 0;
        do { x = rnd(0, w); y = rnd(0, h); tries++; } while (inside(x, y) && tries < 20);
        return { x, y, vx: rnd(-0.3, 0.3) * (0.5 + depth * 0.5), vy: rnd(-0.3, 0.3) * (0.5 + depth * 0.5), depth };
      }).sort((a, b) => a.depth - b.depth);
      const calm = Array.from({ length: isMobile ? 6 : 12 }, () => ({
        x: rnd(cage.x0 + 20, cage.x1 - 20),
        y: rnd(cage.y0 + 20, cage.y1 - 20),
        ph: rnd(0, 6.28),
      }));

      // ── 3D cage — perspective-projected wireframe box, GSAP-driven ──
      const hx = (cage.x1 - cage.x0) * 0.5 * 0.58;
      const hy = (cage.y1 - cage.y0) * 0.5 * 0.72;
      const hz = hx;
      const diagXZ = Math.hypot(hx, hz);
      const PERSP = isMobile ? 620 : 950;
      const rot = { yaw: 0.55, pitch: -0.18, mouseYaw: 0, mousePitch: 0, scale: 1 };
      const reduced = prefersReducedMotion();
      let yawTo: ((v: number) => void) | null = null;
      let pitchTo: ((v: number) => void) | null = null;
      if (!reduced) {
        rot.scale = 0;
        gsap.to(rot, { yaw: 0.55 + Math.PI * 2, duration: isMobile ? 22 : 30, ease: "none", repeat: -1 });
        gsap.to(rot, { scale: 1, duration: 1.4, ease: "elastic.out(1, 0.6)", delay: 0.1 });
        gsap.to(rot, { pitch: -0.1, duration: 3.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
        yawTo = gsap.quickTo(rot, "mouseYaw", { duration: 0.9, ease: "power2.out" });
        pitchTo = gsap.quickTo(rot, "mousePitch", { duration: 0.9, ease: "power2.out" });
      }
      const project = (x: number, y: number, z: number) => {
        const yaw = rot.yaw + rot.mouseYaw;
        const pitch = rot.pitch + rot.mousePitch;
        const cyw = Math.cos(yaw), syw = Math.sin(yaw);
        const X = x * cyw + z * syw;
        const Z0 = z * cyw - x * syw;
        const cpt = Math.cos(pitch), spt = Math.sin(pitch);
        const Y = y * cpt - Z0 * spt;
        const Z = y * spt + Z0 * cpt;
        const s = (PERSP / (PERSP + Z)) * rot.scale;
        return { x: ccx + X * s, y: ccy + Y * s, z: Z };
      };
      const BARS = isMobile ? 4 : 5;
      const barAnchors: { x: number; z: number }[] = [];
      for (let i = 0; i < BARS; i++) {
        const bt = i / (BARS - 1);
        barAnchors.push({ x: -hx + 2 * hx * bt, z: -hz });
        barAnchors.push({ x: -hx + 2 * hx * bt, z: hz });
      }
      for (let i = 1; i < BARS - 1; i++) {
        const bt = i / (BARS - 1);
        barAnchors.push({ x: -hx, z: -hz + 2 * hz * bt });
        barAnchors.push({ x: hx, z: -hz + 2 * hz * bt });
      }
      const ringYs = isMobile ? [-hy, 0, hy] : [-hy, -hy / 2, 0, hy / 2, hy];
      const ringCorners = [
        { x: -hx, z: -hz }, { x: hx, z: -hz }, { x: hx, z: hz }, { x: -hx, z: hz },
      ];
      const depthCue = (z: number) => Math.max(0, Math.min(1, (1 - z / diagXZ) / 2));
      // Liang–Barsky entry-t of segment into the cage rect, or 1 if it misses.
      const clipEntry = (x1: number, y1: number, x2: number, y2: number) => {
        const dx = x2 - x1, dy = y2 - y1;
        let t0 = 0, t1 = 1;
        const edges: [number, number][] = [
          [-dx, x1 - cage.x0],
          [dx, cage.x1 - x1],
          [-dy, y1 - cage.y0],
          [dy, cage.y1 - y1],
        ];
        for (const [pp, qq] of edges) {
          if (pp === 0) {
            if (qq < 0) return 1;
          } else {
            const r = qq / pp;
            if (pp < 0) {
              if (r > t1) return 1;
              if (r > t0) t0 = r;
            } else {
              if (r < t0) return 1;
              if (r < t1) t1 = r;
            }
          }
        }
        return t0 > 0 ? t0 : 1;
      };
      const D = isMobile ? 112 : 134;
      const draw: DrawFn = () => {
        const p = getP();
        const t = performance.now() * 0.001;
        ctx.clearRect(0, 0, w, h);
        // interior safe-glow (shielded calm)
        stampGlow(ctx, ccx, ccy, (cage.x1 - cage.x0) * 0.5, p.green, p.glow ? 0.07 : 0.035);
        ps.forEach((pt) => {
          pt.x += pt.vx;
          pt.y += pt.vy;
          if (pt.x < 0 || pt.x > w) pt.vx *= -1;
          if (pt.y < 0 || pt.y > h) pt.vy *= -1;
          if (mouse.active && !inShield(mouse.x, mouse.y)) {
            const dx = pt.x - mouse.x, dy = pt.y - mouse.y, d = Math.hypot(dx, dy);
            if (d < 130 && d > 0.1) { const f = ((130 - d) / 130) * 1.9; pt.x += (dx / d) * f; pt.y += (dy / d) * f; }
          }
          if (inside(pt.x, pt.y)) {
            const toL = pt.x - cage.x0, toR = cage.x1 - pt.x, toT = pt.y - cage.y0, toB = cage.y1 - pt.y;
            const m = Math.min(toL, toR, toT, toB);
            if (m === toL) { pt.x = cage.x0; pt.vx = -Math.abs(pt.vx); }
            else if (m === toR) { pt.x = cage.x1; pt.vx = Math.abs(pt.vx); }
            else if (m === toT) { pt.y = cage.y0; pt.vy = -Math.abs(pt.vy); }
            else { pt.y = cage.y1; pt.vy = Math.abs(pt.vy); }
          }
        });
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        // proximity graph — the cage severs links that cross it (shielding made visible)
        const linkBuckets = makeBuckets();
        const sparks: { x: number; y: number }[] = [];
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            const a = ps[i], b = ps[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d >= D) continue;
            const te = clipEntry(a.x, a.y, b.x, b.y);
            if (te >= 1) addSeg(linkBuckets, a.x, a.y, b.x, b.y, (1 - d / D) * (0.55 + (a.depth + b.depth) * 0.225));
            else if (sparks.length < 22 && Math.random() < 0.05) sparks.push({ x: a.x + (b.x - a.x) * te, y: a.y + (b.y - a.y) * te });
          }
        }
        strokeBuckets(ctx, linkBuckets, p.green, p.glow ? 0.42 : 0.26, 1);
        sparks.forEach((s) => glowDot(ctx, s.x, s.y, 1.7, p.spark, p.glow ? 10 : 5, 0.78));
        if (mouse.active && !inShield(mouse.x, mouse.y)) {
          const rayBuckets = makeBuckets();
          ps.forEach((pt) => {
            const d = Math.hypot(pt.x - mouse.x, pt.y - mouse.y);
            if (d < 210) {
              const te = clipEntry(mouse.x, mouse.y, pt.x, pt.y);
              addSeg(rayBuckets, mouse.x, mouse.y, mouse.x + (pt.x - mouse.x) * te, mouse.y + (pt.y - mouse.y) * te, 1 - d / 210);
            }
          });
          strokeBuckets(ctx, rayBuckets, p.spark, 0.55, 1.1);
          stampGlow(ctx, mouse.x, mouse.y, 46, p.spark, p.glow ? 0.16 : 0.08);
        }
        // depth-scaled charge dots
        ps.forEach((pt) => glowDot(ctx, pt.x, pt.y, 1.3 + pt.depth * 1.5, p.green, p.glow ? 7 : 4, 0.4 + pt.depth * 0.5));
        ctx.restore();

        // pointer chase — the cage leans toward the cursor / touch
        if (!reduced && yawTo && pitchTo) {
          if (mouse.active) {
            yawTo(((mouse.x - ccx) / w) * 0.5);
            pitchTo(((mouse.y - ccy) / h) * -0.3);
          } else {
            yawTo(0);
            pitchTo(0);
          }
        }
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        // vertical bars — nearer bars brighter/thicker, a spark shimmers along each
        barAnchors.forEach((b) => {
          const top = project(b.x, -hy, b.z);
          const bot = project(b.x, hy, b.z);
          const k = depthCue((top.z + bot.z) / 2);
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(bot.x, bot.y);
          ctx.strokeStyle = ha(p.green, (p.glow ? 0.32 : 0.22) + 0.42 * k);
          ctx.lineWidth = 0.8 + 1.4 * k;
          ctx.stroke();
          const sf = (t * 0.5 + b.x * 0.01) % 1;
          glowDot(ctx, lerp(top.x, bot.x, sf), lerp(top.y, bot.y, sf), 1.4 + k, p.spark, p.glow ? 10 : 5, 0.4 + 0.4 * k);
        });
        // horizontal rings — per-segment depth cue
        ringYs.forEach((ry) => {
          for (let i = 0; i < 4; i++) {
            const a = ringCorners[i], b = ringCorners[(i + 1) % 4];
            const pa = project(a.x, ry, a.z);
            const pb = project(b.x, ry, b.z);
            const k = depthCue((pa.z + pb.z) / 2);
            const isFrame = Math.abs(ry) === hy;
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.strokeStyle = ha(p.green, ((p.glow ? 0.32 : 0.22) + 0.44 * k) * (isFrame ? 1 : 0.68));
            ctx.lineWidth = (isFrame ? 1.5 : 0.7) + 1.2 * k;
            ctx.stroke();
          }
        });
        // corner charges + an occasional arc between adjacent top corners
        const topProj = ringCorners.map((c) => project(c.x, -hy, c.z));
        topProj.forEach((pc) => {
          const k = depthCue(pc.z);
          glowDot(ctx, pc.x, pc.y, 1.8 + 1.8 * k, p.hot, (p.glow ? 12 : 6) * k, 0.4 + 0.55 * k);
        });
        ringCorners.forEach((c) => {
          const pc = project(c.x, hy, c.z);
          const k = depthCue(pc.z);
          glowDot(ctx, pc.x, pc.y, 1.4 + 1.4 * k, p.spark, (p.glow ? 10 : 5) * k, 0.3 + 0.5 * k);
        });
        const arcPhase = (t * 0.5) % 4;
        if (arcPhase < 0.6) {
          const ai = Math.floor(t * 0.5) % 4;
          const a = topProj[ai], b = topProj[(ai + 1) % 4];
          const alpha = (0.6 - arcPhase) / 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          const seg = 5;
          for (let k = 1; k < seg; k++) {
            const f = k / seg;
            ctx.lineTo(lerp(a.x, b.x, f) + rnd(-6, 6), lerp(a.y, b.y, f) + rnd(-6, 6));
          }
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = ha(p.hot, alpha * 0.8);
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
        ctx.restore();
        // calm shielded interior dots
        calm.forEach((c) => {
          const jx = Math.sin(t * 1.3 + c.ph) * 1.5, jy = Math.cos(t * 1.1 + c.ph) * 1.5;
          glowDot(ctx, c.x + jx, c.y + jy, 2.2, p.spark, p.glow ? 8 : 4, 0.7);
        });
        if (mouse.active && !inShield(mouse.x, mouse.y)) glowDot(ctx, mouse.x, mouse.y, 4.5, p.spark, 14);
      };
      draw.dispose = () => {
        gsap.killTweensOf(rot);
      };
      return draw;
    }

    // ── Faraday magneto-optic effect — the showpiece. Layered, parallaxed,
    // twisting polarization ribbons with along-length spectral gradients, hot
    // spines and polarization rungs, drifting light motes, and a spectral rotor
    // at the cursor whose sweep rotates the whole polarization field. ──
    case "effect": {
      const LAYERS = 6;
      const motes = Array.from({ length: 42 }, () => ({ x: rnd(0, w), y: rnd(0, h), s: rnd(0.3, 1), ph: rnd(0, 6.28) }));
      let polar = 0;
      let lastMx: number | null = null;
      return () => {
        const p = getP();
        const t = performance.now() * 0.001;
        ctx.clearRect(0, 0, w, h);
        let field = 0;
        // cursor sweep drives the polarization angle; idle drifts on its own
        if (mouse.active) {
          if (lastMx != null) polar += (mouse.x - lastMx) * 0.004;
          lastMx = mouse.x;
          field = 1;
        } else {
          polar += 0.004;
          lastMx = null;
        }
        const cols = [p.green, p.spark, p.violet, p.amber];
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        for (let L = 0; L < LAYERS; L++) {
          const depth = L / (LAYERS - 1);
          const baseY = ((L + 0.5) / LAYERS) * h;
          const amp = 18 + depth * 46, speed = 0.6 + depth * 1.1, width = 6 + depth * 20, step = 12;
          const xs: number[] = [], offs: number[] = [];
          for (let x = 0; x <= w; x += step) {
            let a = Math.sin(x * 0.008 + t * speed + L * 0.9 + polar + x * 0.006);
            if (field) {
              const dy = Math.abs(baseY - mouse.y);
              a += Math.sin(x * 0.03 + t * 4) * Math.max(0, 1 - Math.abs(x - mouse.x) / 240) * Math.max(0, 1 - dy / 220) * 1.4;
            }
            xs.push(x);
            offs.push(baseY + a * amp);
          }
          const band = new Path2D();
          band.moveTo(xs[0], offs[0] - width / 2);
          for (let i = 1; i < xs.length; i++) band.lineTo(xs[i], offs[i] - width / 2);
          for (let i = xs.length - 1; i >= 0; i--) band.lineTo(xs[i], offs[i] + width / 2);
          band.closePath();
          const g = ctx.createLinearGradient(0, 0, w, 0);
          const sh = Math.floor(((t * 0.05 + depth * 0.3) % 1) * 4);
          for (let s = 0; s <= 4; s++) g.addColorStop(s / 4, ha(cols[(s + sh) % 4], (p.glow ? 0.3 : 0.2) * (0.4 + depth * 0.6)));
          ctx.fillStyle = g;
          ctx.fill(band);
          if (depth > 0.35) {
            const spine = new Path2D();
            spine.moveTo(xs[0], offs[0]);
            for (let i = 1; i < xs.length; i++) spine.lineTo(xs[i], offs[i]);
            ctx.strokeStyle = ha(p.hot, (p.glow ? 0.5 : 0.3) * depth);
            ctx.lineWidth = 1.4;
            ctx.stroke(spine);
            ctx.strokeStyle = ha(p.spark, 0.4 * depth);
            ctx.lineWidth = 1;
            for (let i = 0; i < xs.length; i += 4) {
              ctx.beginPath();
              ctx.moveTo(xs[i], offs[i] - width / 2);
              ctx.lineTo(xs[i], offs[i] + width / 2);
              ctx.stroke();
            }
          }
        }
        if (field) {
          stampGlow(ctx, mouse.x, mouse.y, 90, p.hot, p.glow ? 0.22 : 0.12);
          for (let r = 0; r < 4; r++) {
            const rr = 18 + r * 16 + ((t * 20) % 16);
            ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, rr, 0, 6.2832);
            ctx.strokeStyle = ha(cols[r % 4], (1 - r / 4) * 0.5);
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
          for (let k = 0; k < 8; k++) {
            const a = polar * 3 + (k / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(mouse.x + Math.cos(a) * 46, mouse.y + Math.sin(a) * 46);
            ctx.strokeStyle = ha(cols[k % 4], 0.5);
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          glowDot(ctx, mouse.x, mouse.y, 5, p.hot, 18);
        }
        motes.forEach((m) => {
          m.x += Math.cos(m.ph + t * 0.3) * 0.4 * m.s;
          m.y += Math.sin(m.ph + t * 0.4) * 0.3 * m.s;
          if (m.x < 0) m.x = w;
          if (m.x > w) m.x = 0;
          if (m.y < 0) m.y = h;
          if (m.y > h) m.y = 0;
          glowDot(ctx, m.x, m.y, 1.2 * m.s, p.spark, p.glow ? 8 : 4, 0.5 + 0.4 * Math.sin(t * 2 + m.ph));
        });
        ctx.restore();
      };
    }
  }
}
