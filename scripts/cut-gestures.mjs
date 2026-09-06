#!/usr/bin/env node
/**
 * Lift the hands out of the gesture poses so the rig can use them.
 *
 *   node scripts/cut-gestures.mjs
 *
 * The rig is cut from the idle portrait, which has no arms — so it could emote
 * but never gesture, and the four generated poses were carrying perfectly good
 * hands nobody was using. This takes each pose's hands as one layer, on the same
 * canvas the rig layers use, so the rig can show them when that mood is active.
 *
 * Writes public/faraday-rig/gesture-<mood>.png.
 *
 * ## Why this works at all
 *
 * The poses are all generated from the same seed and framed through one shared
 * box (see slice-poses.mjs), so his head lands in the same place at the same
 * size in every one — measured within ±3% on the distance between his pupils.
 * That is what lets a hand cut from `happy` sit correctly against a head cut
 * from `idle`. Before the framing was unified this was not true, and `happy` was
 * 8.3% small.
 *
 * ## Two ways to find a hand, because they are not the same problem
 *
 * For `happy`, `wrong` and `streak` the arms reach outside idle's silhouette, so
 * the gesture is exactly "opaque here, transparent in idle" — no colour
 * comparison, nothing from the face can leak in.
 *
 * `thinking` rests its hand against his chin, entirely *inside* the silhouette,
 * so that difference returns nothing at all. It needs a colour comparison
 * instead — which also flags his changed eyes and mouth, so the result is
 * split into blobs and only the largest one below the midline is kept. That
 * heuristic holds because his one hand is far bigger than any facial change and
 * sits well below the eyes.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { decodePng, encodePng, resample } from "./png.mjs";

const WORK = 1024;
const WEB = 512;
const OUT_DIR = "public/faraday-rig";
const IDLE = "assets-src/faraday-hires.png";

/** Arms outside idle's silhouette. */
const OUTSIDE = ["happy", "wrong", "streak"];
/** Hand overlapping the face — needs the colour path. */
const OVERLAPPING = ["thinking"];

const isBg = (r, g, b) => Math.min(r, b) - g > 30;

function keyed(file) {
  const img = decodePng(readFileSync(file));
  const px = new Uint8ClampedArray(img.px), w = img.w, h = img.h;
  const seen = new Uint8Array(w * h), stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!isBg(px[i], px[i + 1], px[i + 2])) continue;
    px[i + 3] = 0;
    const x = p % w, y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (px[i + 3] < 32) continue;
    const lo = Math.min(px[i], px[i + 2]);
    if (lo - px[i + 1] > 20) px[i + 1] = lo;
  }
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let p = 0; p < w * h; p++) {
    if (px[p * 4 + 3] <= 24) continue;
    const x = p % w, y = (p - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { px, w, h, b: { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
}

/** Connected components of a boolean mask. */
function blobs(mask, w, h) {
  const id = new Int32Array(w * h).fill(-1);
  const found = [];
  for (let seed = 0; seed < w * h; seed++) {
    if (!mask[seed] || id[seed] >= 0) continue;
    const stack = [seed];
    id[seed] = found.length;
    let count = 0, sumY = 0;
    while (stack.length) {
      const p = stack.pop();
      count++;
      sumY += (p - (p % w)) / w;
      const x = p % w, y = (p - x) / w;
      const push = (q) => { if (mask[q] && id[q] < 0) { id[q] = found.length; stack.push(q); } };
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (y > 0) push(p - w);
      if (y < h - 1) push(p + w);
    }
    found.push({ index: found.length, count, cy: sumY / count });
  }
  return { id, found };
}

/* ── frame everything through one box, exactly as slice-poses.mjs does ─────── */

const names = [...OUTSIDE, ...OVERLAPPING];
const idle = keyed(IDLE);
const sources = Object.fromEntries(names.map((n) => [n, keyed(`assets-src/poses/${n}.png`)]));
const cx = idle.b.x0 + idle.b.w / 2, cy = idle.b.y0 + idle.b.h / 2;
const side = Math.max(
  Math.max(idle.b.w, idle.b.h) * 1.1,
  ...[idle, ...Object.values(sources)].map((k) => Math.max(
    2 * Math.abs(k.b.x0 + k.b.w / 2 - cx) + k.b.w,
    2 * Math.abs(k.b.y0 + k.b.h / 2 - cy) + k.b.h,
  ) * 1.06),
);
const frame = (k) => resample(k.px, k.w, k.h, cx - side / 2, cy - side / 2, side, WORK);
const A = frame(idle);

/* Idle's alpha, dilated. Without the dilation every anti-aliased pixel along his
   own outline reads as "new" and each gesture ships with a ghost of his
   silhouette attached. */
const idleAlpha = new Uint8Array(WORK * WORK);
for (let p = 0; p < WORK * WORK; p++) idleAlpha[p] = A[p * 4 + 3] > 40 ? 1 : 0;
for (let pass = 0; pass < 3; pass++) {
  const next = idleAlpha.slice();
  for (let p = 0; p < WORK * WORK; p++) {
    if (idleAlpha[p]) continue;
    const x = p % WORK, y = (p - x) / WORK;
    if ((x > 0 && idleAlpha[p - 1]) || (x < WORK - 1 && idleAlpha[p + 1]) ||
        (y > 0 && idleAlpha[p - WORK]) || (y < WORK - 1 && idleAlpha[p + WORK])) next[p] = 1;
  }
  idleAlpha.set(next);
}

mkdirSync(OUT_DIR, { recursive: true });
let total = 0;

function write(name, mask, B) {
  const full = new Uint8ClampedArray(WORK * WORK * 4);
  let n = 0;
  for (let p = 0; p < WORK * WORK; p++) {
    if (!mask[p]) continue;
    full.set(B.subarray(p * 4, p * 4 + 4), p * 4);
    n++;
  }
  if (n < 2000) throw new Error(`gesture "${name}" came out at ${n}px — too small to be a hand`);
  const small = resample(full, WORK, WORK, 0, 0, WORK, WEB);
  const file = `${OUT_DIR}/gesture-${name}.png`;
  writeFileSync(file, encodePng(WEB, WEB, small));
  const bytes = readFileSync(file).length;
  total += bytes;
  console.log(`${name.padEnd(9)} ${String(n).padStart(7)} px   ${(bytes / 1024).toFixed(0)}KB`);
}

for (const name of OUTSIDE) {
  const B = frame(sources[name]);
  const mask = new Uint8Array(WORK * WORK);
  for (let p = 0; p < WORK * WORK; p++) {
    if (B[p * 4 + 3] > 40 && !idleAlpha[p]) mask[p] = 1;
  }
  write(name, mask, B);
}

for (const name of OVERLAPPING) {
  const B = frame(sources[name]);
  const changed = new Uint8Array(WORK * WORK);
  for (let p = 0; p < WORK * WORK; p++) {
    const i = p * 4;
    if (B[i + 3] < 40) continue;
    const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    if (d > 90 || A[i + 3] < 40) changed[p] = 1;
  }
  const { id, found } = blobs(changed, WORK, WORK);
  // Biggest blob below the midline: his hand dwarfs any change to his face, and
  // his face is above it.
  const hand = found.filter((f) => f.cy > WORK * 0.55).sort((a, b) => b.count - a.count)[0];
  if (!hand) throw new Error(`gesture "${name}": no hand-sized region below the midline`);
  const mask = new Uint8Array(WORK * WORK);
  for (let p = 0; p < WORK * WORK; p++) if (id[p] === hand.index) mask[p] = 1;
  write(name, mask, B);
}

console.log(`\n${names.length} gestures, ${(total / 1024).toFixed(0)}KB total`);
