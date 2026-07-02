/**
 * Celebrations — lightweight confetti / particle burst system.
 * Pure Canvas2D + SVG, no external library. Every effect is a no-op under
 * prefers-reduced-motion and cleans its own DOM up when it finishes.
 */

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* Brand palette resolved from the live CSS variables (theme-aware). */
function brandColors(): { voltGreen: string; arcViolet: string; filamentAmber: string } {
  const css = getComputedStyle(document.documentElement);
  return {
    voltGreen: css.getPropertyValue("--color-primary").trim() || "#17C964",
    arcViolet: css.getPropertyValue("--color-secondary").trim() || "#7B61FF",
    filamentAmber: css.getPropertyValue("--color-tertiary").trim() || "#FFB02E",
  };
}

/* ───────────────────────── Canvas particle engine ───────────────────────── */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vr: number;
  color: string;
  life: number; // 1 → 0
  decay: number;
  shape: "rect" | "circle";
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let rafId = 0;

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (canvas && ctx) return ctx;
  canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
  return ctx;
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function teardown() {
  cancelAnimationFrame(rafId);
  rafId = 0;
  window.removeEventListener("resize", resize);
  canvas?.remove();
  canvas = null;
  ctx = null;
  particles = [];
}

function tick() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.14; // gravity
    p.vx *= 0.985; // drag
    p.rotation += p.vr;
    p.life -= p.decay;
    if (p.life <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    if (p.shape === "rect") {
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
  if (particles.length === 0) {
    teardown();
    return;
  }
  rafId = requestAnimationFrame(tick);
}

function spawn(x: number, y: number, count: number, colors: string[], speed = 1) {
  if (!ensureCanvas()) return;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = (2.5 + Math.random() * 5.5) * speed;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - 3.2 * speed, // bias upward
      size: 5 + Math.random() * 6,
      rotation: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: 0.011 + Math.random() * 0.012,
      shape: Math.random() < 0.35 ? "circle" : "rect",
    });
  }
  if (!rafId) rafId = requestAnimationFrame(tick);
}

/* ───────────────────────── Public API ───────────────────────── */

/** Burst of 20–30 particles at a viewport point. */
export function fireConfetti(x: number, y: number, color?: string) {
  if (reducedMotion()) return;
  const { voltGreen, arcViolet, filamentAmber } = brandColors();
  const colors = color ? [color, voltGreen] : [voltGreen, arcViolet, filamentAmber];
  spawn(x, y, 20 + Math.round(Math.random() * 10), colors);
}

/** Streak celebration — intensity (particle count, spread) grows with the streak. */
export function fireStreak(count: number) {
  if (reducedMotion()) return;
  const { voltGreen, arcViolet, filamentAmber } = brandColors();
  const level = Math.max(1, Math.min(count, 8));
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.35;
  spawn(cx, cy, 18 + level * 8, [voltGreen, filamentAmber, arcViolet], 1 + level * 0.15);
  // side bursts kick in on longer streaks
  if (level >= 3) {
    spawn(cx - 140, cy + 40, level * 5, [voltGreen, filamentAmber], 0.9);
    spawn(cx + 140, cy + 40, level * 5, [voltGreen, arcViolet], 0.9);
  }
}

/** SVG lightning arc between two viewport points — flashes and fades. */
export function fireElectricArc(from: { x: number; y: number }, to: { x: number; y: number }) {
  if (reducedMotion()) return;
  const { voltGreen } = brandColors();

  // jagged polyline between the endpoints, offset perpendicular to the line
  const segments = 8;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  let d = `M ${from.x} ${from.y}`;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const jag = (Math.random() - 0.5) * Math.min(dist * 0.22, 34);
    d += ` L ${from.x + dx * t + nx * jag} ${from.y + dy * t + ny * jag}`;
  }
  d += ` L ${to.x} ${to.y}`;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;overflow:visible;";

  const glow = document.createElementNS(svgNS, "path");
  glow.setAttribute("d", d);
  glow.setAttribute("fill", "none");
  glow.setAttribute("stroke", voltGreen);
  glow.setAttribute("stroke-width", "6");
  glow.setAttribute("stroke-linejoin", "round");
  glow.style.filter = "blur(4px)";
  glow.style.opacity = "0.7";

  const core = document.createElementNS(svgNS, "path");
  core.setAttribute("d", d);
  core.setAttribute("fill", "none");
  core.setAttribute("stroke", "#fff");
  core.setAttribute("stroke-width", "2");
  core.setAttribute("stroke-linejoin", "round");

  svg.append(glow, core);
  document.body.appendChild(svg);

  const anim = svg.animate(
    [{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }],
    { duration: 340, easing: "ease-out" },
  );
  anim.onfinish = () => svg.remove();
  // safety net in case the animation is cancelled
  setTimeout(() => svg.remove(), 600);
}
