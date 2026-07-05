import { gsap, prefersReducedMotion } from "../../lib/gsapUtils";
import { type FaradayVariant, type Mouse, type GetP, type DrawFn, ha, rnd } from "./types";

/**
 * Build the per-frame draw function for a variant. Particle state lives in the
 * returned closure; the harness calls draw() each frame (or once when motion is
 * reduced). The palette is read fresh every frame via getP() so theme can swap
 * without restarting the loop.
 *
 * Each variant is a real Faraday-era physics phenomenon ported verbatim from the
 * design prototypes (see handoff/*.dc.html). The RAF harness lives in
 * FaradayCanvas.tsx; this module only supplies the draw() builders.
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
    // ── Bohr atoms — orbiting electrons, nuclei parallax toward cursor ──
    case "atom": {
      const atoms = Array.from({ length: 7 }, (_, i) => {
        const rings = Array.from({ length: 2 + (i % 2) }, () => ({
          rx: rnd(34, 72),
          ry: rnd(13, 30),
          tilt: rnd(0, Math.PI),
          ang: rnd(0, Math.PI * 2),
          spd: rnd(0.012, 0.028) * (Math.random() < 0.5 ? 1 : -1),
        }));
        return {
          x: rnd(0.08, 0.92) * w,
          y: rnd(0.08, 0.92) * h,
          vx: rnd(-0.14, 0.14),
          vy: rnd(-0.11, 0.11),
          depth: rnd(0.4, 1),
          rings,
        };
      });
      return () => {
        const p = getP();
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        atoms.forEach((a) => {
          a.x += a.vx;
          a.y += a.vy;
          if (a.x < -100) a.x = w + 100;
          if (a.x > w + 100) a.x = -100;
          if (a.y < -100) a.y = h + 100;
          if (a.y > h + 100) a.y = -100;
          const ox = (mouse.active ? mouse.x - a.x : 0) * 0.016 * a.depth;
          const oy = (mouse.active ? mouse.y - a.y : 0) * 0.016 * a.depth;
          const cx = a.x + ox, cy = a.y + oy;
          const alpha = 0.5 * a.depth + 0.25;
          a.rings.forEach((r) => {
            r.ang += r.spd;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(r.tilt);
            ctx.beginPath();
            ctx.ellipse(0, 0, r.rx, r.ry, 0, 0, Math.PI * 2);
            ctx.strokeStyle = ha(p.green, (p.glow ? 0.22 : 0.16) * alpha);
            ctx.lineWidth = 1.2;
            ctx.stroke();
            const ex = Math.cos(r.ang) * r.rx, ey = Math.sin(r.ang) * r.ry;
            ctx.beginPath();
            ctx.arc(ex, ey, 2.6, 0, Math.PI * 2);
            ctx.fillStyle = p.spark;
            ctx.shadowColor = p.spark;
            ctx.shadowBlur = p.glow ? 10 : 6;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
          });
          ctx.beginPath();
          ctx.arc(cx, cy, 3.4, 0, Math.PI * 2);
          ctx.fillStyle = p.green;
          ctx.shadowColor = p.green;
          ctx.shadowBlur = p.glow ? 16 : 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
        ctx.restore();
      };
    }

    // ── Knowledge particle network; optional named concept nodes ──
    case "constellation": {
      // Density per the AIChatPanel tuning (/11000). Capped so very large
      // displays don't blow up the O(N²) link pass.
      const N = Math.min(150, Math.round((w * h) / 11000));
      const ps = Array.from({ length: N }, () => ({
        x: rnd(0, w),
        y: rnd(0, h),
        vx: rnd(-0.28, 0.28),
        vy: rnd(-0.28, 0.28),
      }));
      const concepts = [
        { label: "טריג'", x: rnd(0.12, 0.28) * w, y: rnd(0.18, 0.36) * h },
        { label: "אלגברה", x: rnd(0.52, 0.72) * w, y: rnd(0.14, 0.32) * h },
        { label: "פונקציות", x: rnd(0.18, 0.36) * w, y: rnd(0.56, 0.74) * h },
        { label: "חשבון", x: rnd(0.62, 0.8) * w, y: rnd(0.52, 0.7) * h },
        { label: "גיאומטריה", x: rnd(0.35, 0.55) * w, y: rnd(0.32, 0.5) * h },
      ];
      const D = 130;
      return () => {
        const p = getP();
        const t = performance.now() * 0.001;
        ctx.clearRect(0, 0, w, h);
        ps.forEach((pt) => {
          pt.x += pt.vx;
          pt.y += pt.vy;
          if (pt.x < 0 || pt.x > w) pt.vx *= -1;
          if (pt.y < 0 || pt.y > h) pt.vy *= -1;
          if (mouse.active) {
            const dx = pt.x - mouse.x, dy = pt.y - mouse.y, d = Math.hypot(dx, dy);
            if (d < 100 && d > 0.5) {
              const f = ((100 - d) / 100) * 2;
              pt.x += (dx / d) * f;
              pt.y += (dy / d) * f;
            }
          }
        });
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            const a = ps[i], b = ps[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < D) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = ha(p.green, (1 - d / D) * (p.glow ? 0.36 : 0.2));
              ctx.lineWidth = 0.9;
              ctx.stroke();
            }
          }
        }
        ps.forEach((pt) => {
          concepts.forEach((cn) => {
            const d = Math.hypot(pt.x - cn.x, pt.y - cn.y);
            if (d < D * 1.3) {
              ctx.beginPath();
              ctx.moveTo(pt.x, pt.y);
              ctx.lineTo(cn.x, cn.y);
              ctx.strokeStyle = ha(p.violet, (1 - d / (D * 1.3)) * (p.glow ? 0.4 : 0.2));
              ctx.lineWidth = 0.9;
              ctx.stroke();
            }
          });
        });
        for (let i = 0; i < concepts.length; i++) {
          for (let j = i + 1; j < concepts.length; j++) {
            const a = concepts[i], b = concepts[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < D * 2.2) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = ha(p.violet, (1 - d / (D * 2.2)) * 0.55);
              ctx.lineWidth = 1.3;
              ctx.stroke();
            }
          }
        }
        if (mouse.active) {
          ps.forEach((pt) => {
            const d = Math.hypot(pt.x - mouse.x, pt.y - mouse.y);
            if (d < 180) {
              ctx.beginPath();
              ctx.moveTo(mouse.x, mouse.y);
              ctx.lineTo(pt.x, pt.y);
              ctx.strokeStyle = ha(p.spark, (1 - d / 180) * 0.55);
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          });
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = p.spark;
          ctx.shadowColor = p.spark;
          ctx.shadowBlur = 14;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        ctx.restore();
        ps.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = p.green;
          ctx.fill();
        });
        concepts.forEach((cn, i) => {
          const ph = ((t * 0.4) + i * 0.42) % 1;
          ctx.beginPath();
          ctx.arc(cn.x, cn.y, 10 + ph * 34, 0, Math.PI * 2);
          ctx.strokeStyle = ha(p.violet, (1 - ph) * 0.5);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cn.x, cn.y, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = p.violet;
          ctx.shadowColor = p.violet;
          ctx.shadowBlur = p.glow ? 16 : 10;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.save();
          ctx.font = "700 13px Assistant, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.direction = "rtl";
          ctx.fillStyle = ha(p.violet, 0.85);
          ctx.fillText(cn.label, cn.x, cn.y + 9);
          ctx.restore();
        });
      };
    }

    // ── Flowing current on PCB traces, pulsing field rings, cursor ripples ──
    case "circuit": {
      type Pt = { x: number; y: number };
      const wires: { pts: Pt[]; off: number; speed: number }[] = [];
      [0.2, 0.4, 0.6, 0.8].forEach((ry, i) => {
        let x = w * 0.04, y = ry * h;
        const pts: Pt[] = [{ x, y }];
        const segs = 4 + (i % 3);
        for (let s = 0; s < segs; s++) {
          x += w * rnd(0.12, 0.2);
          pts.push({ x, y });
          const ny = Math.max(h * 0.08, Math.min(h * 0.92, y + rnd(-1, 1) * h * 0.13));
          pts.push({ x, y: ny });
          y = ny;
        }
        pts.push({ x: w * 0.96, y });
        wires.push({ pts, off: rnd(0, 40), speed: rnd(0.5, 1.1) });
      });
      const nodes = wires.map((wi) => {
        const pt = wi.pts[Math.floor(wi.pts.length / 2)];
        return { x: pt.x, y: pt.y, ph: Math.random() };
      });
      const ripples: { x: number; y: number; t: number }[] = [];
      let lastRx = -999, lastRy = -999;
      const drawPath = (pts: Pt[]) => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
      };
      return () => {
        const p = getP();
        const t = performance.now();
        if (mouse.active && Math.hypot(mouse.x - lastRx, mouse.y - lastRy) > 42) {
          ripples.push({ x: mouse.x, y: mouse.y, t });
          lastRx = mouse.x;
          lastRy = mouse.y;
          if (ripples.length > 14) ripples.shift();
        }
        ctx.clearRect(0, 0, w, h);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([]);
        wires.forEach((wi) => {
          drawPath(wi.pts);
          ctx.strokeStyle = ha(p.green, p.glow ? 0.16 : 0.13);
          ctx.lineWidth = 2;
          ctx.stroke();
        });
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        wires.forEach((wi) => {
          drawPath(wi.pts);
          ctx.setLineDash([10, 20]);
          ctx.lineDashOffset = -(t * 0.04 * wi.speed + wi.off);
          ctx.strokeStyle = p.spark;
          ctx.lineWidth = 2.4;
          ctx.shadowColor = p.spark;
          ctx.shadowBlur = p.glow ? 10 : 6;
          ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        nodes.forEach((n) => {
          const ph = ((t * 0.0005) + n.ph) % 1;
          const rr = 10 + ph * 52;
          ctx.beginPath();
          ctx.arc(n.x, n.y, rr, 0, Math.PI * 2);
          ctx.strokeStyle = ha(p.green, (1 - ph) * 0.45);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = p.green;
          ctx.shadowColor = p.green;
          ctx.shadowBlur = 14;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
        for (let k = ripples.length - 1; k >= 0; k--) {
          const rp = ripples[k];
          const age = t - rp.t;
          const a = 1 - age / 1000;
          if (a <= 0) {
            ripples.splice(k, 1);
            continue;
          }
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, age * 0.22, 0, Math.PI * 2);
          ctx.strokeStyle = ha(p.spark, a * 0.6);
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      };
    }

    // ── Electromagnetic induction — flux lines + induced current pulses ──
    case "induction": {
      const N = 10;
      const lines = Array.from({ length: N }, (_, i) => ({
        y: ((i + 0.5) / N) * h,
        amp: 14 + (i % 4) * 4,
        k: 0.0095 + (i % 3) * 0.0015,
        ph: i * 0.55,
        pulses: [Math.random(), Math.random() + 0.5],
        spd: 0.0012 + (i % 3) * 0.0003,
      }));
      return () => {
        const p = getP();
        const t = performance.now() * 0.001;
        ctx.clearRect(0, 0, w, h);
        ctx.lineCap = "round";
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        lines.forEach((ln) => {
          const pts: { x: number; y: number }[] = [];
          for (let x = 0; x <= w; x += 10) {
            let amp = ln.amp;
            if (mouse.active) {
              const dx = x - mouse.x, dy = ln.y - mouse.y, d = Math.hypot(dx, dy);
              if (d < 220) amp += (1 - d / 220) * 55 * Math.sign(dy || 1);
            }
            pts.push({ x, y: ln.y + Math.sin(x * ln.k + ln.ph + t * 0.55) * amp });
          }
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
          ctx.strokeStyle = ha(p.green, p.glow ? 0.18 : 0.12);
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ln.pulses.forEach((pp, idx) => {
            pp += ln.spd + idx * 0.0003;
            if (pp > 1) pp -= 1;
            ln.pulses[idx] = pp;
            const gi = Math.min(pts.length - 1, Math.round((pp * w) / 10));
            const gp = pts[gi] || pts[pts.length - 1];
            ctx.beginPath();
            ctx.arc(gp.x, gp.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = p.spark;
            ctx.shadowColor = p.spark;
            ctx.shadowBlur = p.glow ? 12 : 6;
            ctx.fill();
            ctx.shadowBlur = 0;
          });
        });
        if (mouse.active) {
          const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 80);
          g.addColorStop(0, ha(p.spark, 0.45));
          g.addColorStop(1, ha(p.spark, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 80, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      };
    }

    // ── Magnetic lines of force — dipole iron filings + flowing test charges ──
    case "linesOfForce": {
      const poles = [
        { x: w * 0.26, y: h * 0.3, s: 1 },
        { x: w * 0.74, y: h * 0.68, s: -1 },
      ];
      const fieldAt = (x: number, y: number): [number, number] => {
        let fx = 0, fy = 0;
        const all = [...poles];
        if (mouse.active) all.push({ x: mouse.x, y: mouse.y, s: 1.6 });
        all.forEach((c) => {
          const dx = x - c.x, dy = y - c.y;
          let r2 = dx * dx + dy * dy;
          if (r2 < 100) r2 = 100;
          const inv = c.s / (r2 * Math.sqrt(r2));
          fx += dx * inv * 1400;
          fy += dy * inv * 1400;
        });
        return [fx, fy];
      };
      const sp = 40;
      const grid: { x: number; y: number }[] = [];
      for (let x = sp * 0.5; x < w; x += sp) for (let y = sp * 0.5; y < h; y += sp) grid.push({ x, y });
      const flow = Array.from({ length: 70 }, () => ({ x: rnd(0, w), y: rnd(0, h), life: rnd(0, 70) }));
      return () => {
        const p = getP();
        ctx.clearRect(0, 0, w, h);
        ctx.lineCap = "round";
        grid.forEach((g) => {
          const [fx, fy] = fieldAt(g.x, g.y);
          const mag = Math.hypot(fx, fy);
          if (mag < 5e-5) return;
          const a = Math.atan2(fy, fx);
          const len = Math.min(sp * 0.44, 4 + mag * 6);
          const al = Math.min(0.48, 0.08 + mag * 0.4);
          ctx.beginPath();
          ctx.moveTo(g.x - Math.cos(a) * len, g.y - Math.sin(a) * len);
          ctx.lineTo(g.x + Math.cos(a) * len, g.y + Math.sin(a) * len);
          ctx.strokeStyle = ha(p.green, al);
          ctx.lineWidth = 1.3;
          ctx.stroke();
        });
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        flow.forEach((f) => {
          const [fx, fy] = fieldAt(f.x, f.y);
          const m = Math.hypot(fx, fy) || 1;
          f.x += (fx / m) * 1.5;
          f.y += (fy / m) * 1.5;
          f.life -= 1;
          if (f.life <= 0 || f.x < -8 || f.x > w + 8 || f.y < -8 || f.y > h + 8) {
            f.x = rnd(0, w);
            f.y = rnd(0, h);
            f.life = rnd(50, 100);
          }
          ctx.beginPath();
          ctx.arc(f.x, f.y, 1.9, 0, Math.PI * 2);
          ctx.fillStyle = p.spark;
          ctx.shadowColor = p.spark;
          ctx.shadowBlur = p.glow ? 8 : 4;
          ctx.fill();
        });
        ctx.shadowBlur = 0;
        ctx.restore();
        poles.forEach((c, i) => {
          ctx.beginPath();
          ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
          ctx.fillStyle = i === 0 ? p.green : p.violet;
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = p.glow ? 20 : 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
        if (mouse.active) {
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI * 2);
          ctx.fillStyle = p.spark;
          ctx.shadowColor = p.spark;
          ctx.shadowBlur = 16;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      };
    }

    // ── Faraday cage — field excluded from a shielded interior ──
    case "cage": {
      // Phones get a wider cage pushed toward the top (the hero area — the role
      // panel covers the lower half of the screen) and a smaller particle/bar
      // budget; desktop keeps the original centered composition.
      const isMobile = w < 768;
      const cage = isMobile
        ? { x0: w * 0.16, y0: h * 0.05, x1: w * 0.84, y1: h * 0.4 }
        : { x0: w * 0.36, y0: h * 0.3, x1: w * 0.64, y1: h * 0.72 };
      const inside = (x: number, y: number) =>
        x > cage.x0 && x < cage.x1 && y > cage.y0 && y < cage.y1;
      const N = isMobile ? 36 : 64;
      const ps = Array.from({ length: N }, () => {
        let x = 0, y = 0, tries = 0;
        do {
          x = rnd(0, w);
          y = rnd(0, h);
          tries++;
        } while (inside(x, y) && tries < 20);
        return { x, y, vx: rnd(-0.3, 0.3), vy: rnd(-0.3, 0.3) };
      });
      const calm = Array.from({ length: isMobile ? 6 : 10 }, () => ({
        x: rnd(cage.x0 + 20, cage.x1 - 20),
        y: rnd(cage.y0 + 20, cage.y1 - 20),
        ph: Math.random() * 6.28,
      }));

      // ── 3D cage — perspective-projected wireframe box, GSAP-driven ──
      // The 2D exclusion rect above keeps doing the physics; the box is sized
      // so its rotating projection stays (roughly) inside that rect.
      const ccx = (cage.x0 + cage.x1) / 2;
      const ccy = (cage.y0 + cage.y1) / 2;
      const hx = (cage.x1 - cage.x0) * 0.5 * 0.58;
      const hy = (cage.y1 - cage.y0) * 0.5 * 0.72;
      const hz = hx;
      const diagXZ = Math.hypot(hx, hz);
      // shorter camera distance on phones = stronger perspective on a small box
      const PERSP = isMobile ? 620 : 950;
      const rot = { yaw: 0.55, pitch: -0.18, mouseYaw: 0, mousePitch: 0, scale: 1 };
      const reduced = prefersReducedMotion();
      let yawTo: ((v: number) => void) | null = null;
      let pitchTo: ((v: number) => void) | null = null;
      if (!reduced) {
        rot.scale = 0;
        // endless slow spin, elastic scale-in, and a gentle idle pitch bob
        gsap.to(rot, { yaw: 0.55 + Math.PI * 2, duration: isMobile ? 22 : 30, ease: "none", repeat: -1 });
        gsap.to(rot, { scale: 1, duration: 1.4, ease: "elastic.out(1, 0.6)", delay: 0.1 });
        gsap.to(rot, { pitch: -0.1, duration: 3.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
        // smoothed pointer chase — the cage leans toward the cursor / touch
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
      // vertical-bar anchors around the top/bottom perimeter (XZ plane)
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
      // horizontal rings tying the bars together
      const ringYs = isMobile ? [-hy, 0, hy] : [-hy, -hy / 2, 0, hy / 2, hy];
      const ringCorners = [
        { x: -hx, z: -hz }, { x: hx, z: -hz }, { x: hx, z: hz }, { x: -hx, z: hz },
      ];
      // 0 (back) → 1 (front) depth cue from a projected z
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
      const D = isMobile ? 100 : 120;
      const draw: DrawFn = () => {
        const p = getP();
        const t = performance.now() * 0.001;
        ctx.clearRect(0, 0, w, h);
        ps.forEach((pt) => {
          pt.x += pt.vx;
          pt.y += pt.vy;
          if (pt.x < 0 || pt.x > w) pt.vx *= -1;
          if (pt.y < 0 || pt.y > h) pt.vy *= -1;
          if (mouse.active && !inside(mouse.x, mouse.y)) {
            const dx = pt.x - mouse.x, dy = pt.y - mouse.y, d = Math.hypot(dx, dy);
            if (d < 120 && d > 0.1) {
              const f = ((120 - d) / 120) * 1.8;
              pt.x += (dx / d) * f;
              pt.y += (dy / d) * f;
            }
          }
          if (inside(pt.x, pt.y)) {
            const toL = pt.x - cage.x0, toR = cage.x1 - pt.x, toT = pt.y - cage.y0, toB = cage.y1 - pt.y;
            const m = Math.min(toL, toR, toT, toB);
            if (m === toL) {
              pt.x = cage.x0;
              pt.vx = -Math.abs(pt.vx);
            } else if (m === toR) {
              pt.x = cage.x1;
              pt.vx = Math.abs(pt.vx);
            } else if (m === toT) {
              pt.y = cage.y0;
              pt.vy = -Math.abs(pt.vy);
            } else {
              pt.y = cage.y1;
              pt.vy = Math.abs(pt.vy);
            }
          }
        });
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            const a = ps[i], b = ps[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < D && clipEntry(a.x, a.y, b.x, b.y) >= 1) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = ha(p.green, (1 - d / D) * (p.glow ? 0.34 : 0.2));
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
        if (mouse.active && !inside(mouse.x, mouse.y)) {
          ps.forEach((pt) => {
            const d = Math.hypot(pt.x - mouse.x, pt.y - mouse.y);
            if (d < 220) {
              const te = clipEntry(mouse.x, mouse.y, pt.x, pt.y);
              const ex = mouse.x + (pt.x - mouse.x) * te, ey = mouse.y + (pt.y - mouse.y) * te;
              ctx.beginPath();
              ctx.moveTo(mouse.x, mouse.y);
              ctx.lineTo(ex, ey);
              ctx.strokeStyle = ha(p.spark, (1 - d / 220) * 0.5);
              ctx.lineWidth = 1.1;
              ctx.stroke();
            }
          });
          ctx.beginPath();
          ctx.arc(mouse.x, mouse.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = p.spark;
          ctx.shadowColor = p.spark;
          ctx.shadowBlur = 14;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        ps.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.1, 0, Math.PI * 2);
          ctx.fillStyle = p.green;
          ctx.fill();
        });
        ctx.restore();

        // the cage — rotating 3D wireframe box (bars + rings + corner charges)
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
        // vertical bars — nearer bars render brighter and thicker
        barAnchors.forEach((b) => {
          const top = project(b.x, -hy, b.z);
          const bot = project(b.x, hy, b.z);
          const k = depthCue((top.z + bot.z) / 2);
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(bot.x, bot.y);
          ctx.strokeStyle = ha(p.green, (p.glow ? 0.3 : 0.2) + 0.42 * k);
          ctx.lineWidth = 0.8 + 1.3 * k;
          ctx.stroke();
        });
        // horizontal rings — per-segment depth cue
        ringYs.forEach((ry) => {
          for (let i = 0; i < 4; i++) {
            const a = ringCorners[i], b = ringCorners[(i + 1) % 4];
            const pa = project(a.x, ry, a.z);
            const pb = project(b.x, ry, b.z);
            const k = depthCue((pa.z + pb.z) / 2);
            const isFrame = Math.abs(ry) === hy; // top/bottom frame reads heavier
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.strokeStyle = ha(p.green, ((p.glow ? 0.3 : 0.2) + 0.44 * k) * (isFrame ? 1 : 0.68));
            ctx.lineWidth = (isFrame ? 1.4 : 0.7) + 1.2 * k;
            ctx.stroke();
          }
        });
        // corner charges — glowing nodes pinned to the 8 box corners
        [-hy, hy].forEach((ry) => {
          ringCorners.forEach((c) => {
            const pc = project(c.x, ry, c.z);
            const k = depthCue(pc.z);
            ctx.beginPath();
            ctx.arc(pc.x, pc.y, 1.8 + 1.8 * k, 0, Math.PI * 2);
            ctx.fillStyle = ha(p.spark, 0.35 + 0.55 * k);
            ctx.shadowColor = p.spark;
            ctx.shadowBlur = (p.glow ? 12 : 6) * k;
            ctx.fill();
            ctx.shadowBlur = 0;
          });
        });
        ctx.restore();
        calm.forEach((c) => {
          const jx = Math.sin(t * 1.3 + c.ph) * 1.5, jy = Math.cos(t * 1.1 + c.ph) * 1.5;
          ctx.beginPath();
          ctx.arc(c.x + jx, c.y + jy, 2.4, 0, Math.PI * 2);
          ctx.fillStyle = ha(p.spark, 0.8);
          ctx.fill();
        });
      };
      draw.dispose = () => {
        gsap.killTweensOf(rot);
      };
      return draw;
    }

    // ── Faraday magneto-optic effect — twin polarization ribbons ──
    case "effect": {
      const beams = 6;
      return () => {
        const p = getP();
        const t = performance.now() * 0.001;
        ctx.clearRect(0, 0, w, h);
        ctx.lineCap = "round";
        ctx.save();
        if (p.glow) ctx.globalCompositeOperation = "lighter";
        for (let b = 0; b < beams; b++) {
          const by = ((b + 0.5) / beams) * h;
          let rate = 0.009;
          if (mouse.active) {
            rate = 0.003 + (mouse.x / w) * 0.028;
            const dy = Math.abs(by - mouse.y);
            rate *= 1 + Math.max(0, 1 - dy / 170) * 1.6;
          }
          const amp = 28 + (b % 2) * 10;
          let prevTop: { x: number; y: number } | null = null;
          let prevBot: { x: number; y: number } | null = null;
          for (let x = 0; x <= w; x += 9) {
            const ang = x * rate + t * 1.3 + b * 0.7;
            const off = Math.sin(ang) * amp;
            const tp = { x, y: by + off };
            const bp = { x, y: by - off };
            if (prevTop && prevBot) {
              ctx.beginPath();
              ctx.moveTo(prevTop.x, prevTop.y);
              ctx.lineTo(tp.x, tp.y);
              ctx.strokeStyle = ha(p.green, p.glow ? 0.48 : 0.32);
              ctx.lineWidth = 1.6;
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(prevBot.x, prevBot.y);
              ctx.lineTo(bp.x, bp.y);
              ctx.strokeStyle = ha(p.violet, p.glow ? 0.4 : 0.24);
              ctx.lineWidth = 1.6;
              ctx.stroke();
            }
            if (x % 48 < 9) {
              ctx.beginPath();
              ctx.moveTo(tp.x, tp.y);
              ctx.lineTo(bp.x, bp.y);
              ctx.strokeStyle = ha(p.spark, 0.45);
              ctx.lineWidth = 1;
              ctx.stroke();
            }
            prevTop = tp;
            prevBot = bp;
          }
          ctx.beginPath();
          ctx.arc(5, by, 3, 0, Math.PI * 2);
          ctx.fillStyle = p.green;
          ctx.shadowColor = p.green;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        if (mouse.active) {
          ctx.beginPath();
          ctx.moveTo(mouse.x, 0);
          ctx.lineTo(mouse.x, h);
          ctx.strokeStyle = ha(p.spark, 0.14);
          ctx.lineWidth = 1.2;
          ctx.setLineDash([5, 8]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      };
    }
  }
}
