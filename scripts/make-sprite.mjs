/**
 * Build a sprite strip from video frames grabbed at even intervals.
 *
 * Usage:  node scripts/make-sprite.mjs <frames-dir> <out-name> [cell-px] [head]
 *   reads <frames-dir>/f-01.png, f-02.png, … in filename order
 *   writes public/faraday-<out-name>.png as a 1-row strip
 *   `head` crops to his head instead of the whole character — the generated
 *   clips frame the full torso, which is unreadable at avatar sizes
 *
 * Grab the frames at a constant interval — the CSS runs them at a fixed rate,
 * so uneven spacing shows up as stuttering:
 *
 *   ffmpeg -ss 4.9 -i assets-src/video/celebration.mp4 -frames:v 1 f-01.png
 *   ffmpeg -ss 5.0 -i assets-src/video/celebration.mp4 -frames:v 1 f-02.png   …
 *
 * Pair with the .faraday-sprite class in index.css, which assumes a 12-cell
 * strip. Change the cell count in both or neither.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { decodePng, encodePng, resample } from "./png.mjs";

const [dir, name, cellArg, mode] = process.argv.slice(2);
const CELL = +(cellArg || 96);
const HEAD_CROP = mode === "head";
if (!dir || !name) {
  console.error("usage: node scripts/make-sprite.mjs <frames-dir> <out-name> [cell-px]");
  process.exit(1);
}

/** Magenta backdrop — see extract-poses.mjs. */
const isBackdrop = (r, g, b) => Math.min(r, b) - g > 30;

function keyOut(w, h, px) {
  const seen = new Uint8Array(w * h), stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!isBackdrop(px[i], px[i + 1], px[i + 2])) continue;
    px[i + 3] = 0;
    const x = p % w, y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
}

function despill(px) {
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const e = Math.min(px[i], px[i + 2]) - px[i + 1];
    if (e > 0) { px[i] -= e; px[i + 2] -= e; }
  }
}

const frames = readdirSync(dir)
  .filter((f) => f.endsWith(".png"))
  .sort()
  .map((f) => {
    const img = decodePng(readFileSync(`${dir}/${f}`));
    keyOut(img.w, img.h, img.px);
    despill(img.px);
    return img;
  });

// ONE crop box across every frame. Cropping each to its own bounds would
// re-centre the character every frame, and the sprite would jitter in place
// instead of animating.
let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
for (const { w, h, px } of frames) {
  for (let p = 0; p < w * h; p++) {
    if (px[p * 4 + 3] <= 24) continue;
    const x = p % w, y = (p - x) / w;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
}
const bw = maxX - minX + 1, bh = maxY - minY + 1;
// Head crop anchors a square to the top of the character instead of centring on
// the whole body: at 36px an indicator needs a face, and his shoulders are not
// the part that moves.
const side = HEAD_CROP ? bw * 0.86 : Math.max(bw, bh) * 1.06;
const sx = minX + bw / 2 - side / 2;
const sy = HEAD_CROP ? minY - side * 0.04 : minY + bh / 2 - side / 2;

const sheetW = CELL * frames.length;
const sheet = new Uint8ClampedArray(sheetW * CELL * 4);
frames.forEach((f, n) => {
  const cell = resample(f.px, f.w, f.h, sx, sy, side, CELL);
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const s = (y * CELL + x) * 4, d = (y * sheetW + n * CELL + x) * 4;
      for (let k = 0; k < 4; k++) sheet[d + k] = cell[s + k];
    }
  }
});

const file = `public/faraday-${name}.png`;
const out = encodePng(sheetW, CELL, sheet);
writeFileSync(file, out);
console.log(`${file}  ${frames.length} frames  ${sheetW}x${CELL}  ${(out.length / 1024).toFixed(1)}KB`);
