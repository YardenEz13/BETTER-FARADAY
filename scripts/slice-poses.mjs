#!/usr/bin/env node
/**
 * Cut the shipped pose PNGs from the high-res portraits.
 *
 *   node scripts/slice-poses.mjs
 *
 * Replaces slice-mascot.mjs for the six head poses. That one cuts cells out of
 * assets-src/faraday-sheet.png, whose cells are 197x211 — the resolution the rig
 * was moved off. This reads the 1024px portraits instead, so every pose is the
 * same vintage as the rig and as each other.
 *
 * Inputs:
 *   assets-src/faraday-hires.png   → faraday-idle.png   (it *is* the idle pose)
 *   assets-src/poses/<name>.png    → faraday-<name>.png (from make-poses.mjs)
 *
 * Missing poses are skipped with a warning rather than failing: the generations
 * arrive one at a time when they are run by hand in AI Studio, and re-running
 * this after each one should work.
 *
 * ## Why the crop is not per-pose
 *
 * Normalising every pose to its own bounding box is what makes a mascot jitter
 * when it swaps: each drawing gets scaled differently, so his head changes size
 * between poses. The head-and-shoulders poses are therefore framed on a *shared*
 * box derived from idle, and only the ones that genuinely need more room — arms
 * raised — are allowed to grow, symmetrically, so his head stays put.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { decodePng, encodePng, resample } from "./png.mjs";

const OUT_SIZE = 192;
const SOURCES = [
  { name: "idle",     file: "assets-src/faraday-hires.png" },
  { name: "blink",    file: "assets-src/poses/blink.png" },
  { name: "thinking", file: "assets-src/poses/thinking.png" },
  { name: "happy",    file: "assets-src/poses/happy.png" },
  { name: "wrong",    file: "assets-src/poses/wrong.png" },
  { name: "streak",   file: "assets-src/poses/streak.png" },
];

/** Magenta by channel relationship — the model never returns exactly #FF00FF. */
const isBg = (r, g, b) => Math.min(r, b) - g > 30;

/** Key the backdrop by flooding in from the border, so magenta-ish pixels
 *  *inside* the drawing survive. Then despill the anti-aliased rim. */
function key(px, w, h) {
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
}

function bounds(px, w, h) {
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let p = 0; p < w * h; p++) {
    if (px[p * 4 + 3] <= 24) continue;
    const x = p % w, y = (p - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* Frame everything on idle's box so his head does not change size pose to pose;
   a pose that overflows it (arms up) widens the box symmetrically about idle's
   own centre, which keeps his head on the same spot in the crop. */
let base = null;

for (const { name, file } of SOURCES) {
  if (!existsSync(file)) {
    console.warn(`${name.padEnd(10)} SKIPPED — ${file} not generated yet`);
    continue;
  }
  const img = decodePng(readFileSync(file));
  const px = new Uint8ClampedArray(img.px);
  key(px, img.w, img.h);
  const b = bounds(px, img.w, img.h);

  if (!base) {
    base = { cx: b.x0 + b.w / 2, cy: b.y0 + b.h / 2, side: Math.max(b.w, b.h) * 1.1 };
  }
  // Grow only if this pose reaches outside the shared box.
  const need = Math.max(
    2 * Math.abs(b.x0 + b.w / 2 - base.cx) + b.w,
    2 * Math.abs(b.y0 + b.h / 2 - base.cy) + b.h,
  ) * 1.06;
  const side = Math.max(base.side, need);

  const out = resample(px, img.w, img.h, base.cx - side / 2, base.cy - side / 2, side, OUT_SIZE);
  const dest = `public/faraday-${name}.png`;
  writeFileSync(dest, encodePng(OUT_SIZE, OUT_SIZE, out));
  console.log(
    `${name.padEnd(10)} ${dest.padEnd(28)} bbox ${b.w}x${b.h}` +
    `${side > base.side ? `  (widened to ${Math.round(side)})` : ""}`,
  );
}

if (!base) {
  console.error("nothing to do — generate the portraits first (scripts/make-poses.mjs --print)");
  process.exit(1);
}
