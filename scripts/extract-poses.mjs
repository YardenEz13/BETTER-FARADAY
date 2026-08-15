/**
 * Turn hold-frames grabbed from a generated mascot video into poses matching
 * the sliced set: key the magenta backdrop, despill the fringe, square-crop to
 * the character, resample to 192.
 *
 * Usage:  node scripts/extract-poses.mjs <frames-dir> <name1> [name2 ...]
 *   reads <frames-dir>/hold-1.png, hold-2.png, … in order
 *   writes public/faraday-<name>.png for each
 *
 * Grab the frames first (ffmpeg, installed via `winget install Gyan.FFmpeg`):
 *
 *   ffmpeg -ss <seconds> -i assets-src/video/<clip>.mp4 -frames:v 1 hold-1.png
 *
 * Pick the timestamps by looking for the *holds*: a clip prompted for "hold
 * each pose 2 seconds" goes nearly static there, and a static stretch is a
 * free, fully-drawn pose.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, encodePng, resample } from "./png.mjs";

const OUT_SIZE = 192;
const [dir, ...names] = process.argv.slice(2);
if (!dir || !names.length) {
  console.error("usage: node scripts/extract-poses.mjs <frames-dir> <name1> [name2 ...]");
  process.exit(1);
}

/** The backdrop is magenta: red and blue both clearly above green. His palette
 *  never is — hair is neutral, skin runs r>g>b, the coat is near-black. */
const isBackdrop = (r, g, b) => Math.min(r, b) - g > 30;

function keyOut(w, h, px) {
  const seen = new Uint8Array(w * h);
  const stack = [];
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

/** Video compression bleeds magenta onto the outline; pull it back to neutral. */
function despill(px) {
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const excess = Math.min(px[i], px[i + 2]) - px[i + 1];
    if (excess > 0) { px[i] -= excess; px[i + 2] -= excess; }
  }
}

names.forEach((name, idx) => {
  const { w, h, px } = decodePng(readFileSync(`${dir}/hold-${idx + 1}.png`));
  keyOut(w, h, px);
  despill(px);

  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let p = 0; p < w * h; p++) {
    if (px[p * 4 + 3] <= 24) continue;
    const x = p % w, y = (p - x) / w;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const side = Math.max(bw, bh) * 1.1;
  const out = resample(px, w, h, minX + bw / 2 - side / 2, minY + bh / 2 - side / 2, side, OUT_SIZE);
  const file = `public/faraday-${name}.png`;
  writeFileSync(file, encodePng(OUT_SIZE, OUT_SIZE, out));
  console.log(`${file.padEnd(32)} bbox ${bw}x${bh}`);
});
