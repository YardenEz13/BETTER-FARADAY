/**
 * Slice public/faraday-sheet.png (the Gemini mascot sheet) into per-pose PNGs.
 *
 * The sheet arrives with a *painted* checkerboard instead of a real alpha
 * channel, plus drawn cell borders. Both come off here: flood-fill the
 * background inward from each cell's edges, which stops dead at the character's
 * thick outlines — so the white hair and collar survive while the grey/white
 * checker behind them does not. A colour key would punch holes in the hair.
 *
 * Re-run after regenerating the sheet:  node scripts/slice-mascot.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, encodePng, resample } from "./png.mjs";

// Source sheet lives outside public/ on purpose: Vite copies public/ into the
// build and the PWA precaches it, and shipping a 750KB source sheet to students
// on filtered school networks to serve six 40KB crops is backwards.
const SHEET = "assets-src/faraday-sheet.png";
const OUT_SIZE = 192;

/** Cell bounds measured off the drawn borders, inset to clear the line itself. */
const COLS = [[35, 264], [279, 505], [520, 757], [776, 990]];
const ROWS = [[35, 278], [280, 524]];
const INSET = 4;

/** Which grid cell becomes which pose. Cells 3 and 7 are near-duplicates — skipped. */
const POSES = [
  { cell: 0, name: "idle" },
  { cell: 1, name: "thinking" },
  { cell: 2, name: "happy" },
  { cell: 4, name: "wrong" },
  { cell: 5, name: "streak" },
  { cell: 6, name: "blink" },
];

/* ── slice ───────────────────────────────────────────────────────────── */

/** The painted checkerboard: unsaturated and light. Character ink is neither. */
const isBackground = (r, g, b) =>
  Math.max(r, g, b) - Math.min(r, g, b) <= 14 && Math.min(r, g, b) > 196;

/** Flood-fill transparency inward from the edges; outlines stop the fill. */
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
    if (!isBackground(px[i], px[i + 1], px[i + 2])) continue;
    px[i + 3] = 0;
    const x = p % w, y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
}

/** Tight bounds of what is left after keying. */
function bounds(w, h, px) {
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let p = 0; p < w * h; p++) {
    if (px[p * 4 + 3] <= 24) continue;
    const x = p % w, y = (p - x) / w;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

const sheet = decodePng(readFileSync(SHEET));

for (const { cell, name } of POSES) {
  const row = cell > 3 ? 1 : 0, col = cell % 4;
  const x0 = COLS[col][0] + INSET, y0 = ROWS[row][0] + INSET;
  const w = COLS[col][1] - COLS[col][0] - INSET * 2;
  const h = ROWS[row][1] - ROWS[row][0] - INSET * 2;

  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const from = ((y0 + y) * sheet.w + x0) * 4;
    px.set(sheet.px.subarray(from, from + w * 4), y * w * 4);
  }

  keyOut(w, h, px);
  const b = bounds(w, h, px);
  const bw = b.maxX - b.minX + 1, bh = b.maxY - b.minY + 1;
  // Square crop around the character, 10% breathing room. Normalising every
  // pose to its own bounds also cancels the head-size drift between cells,
  // which is what keeps the blink frame registered against idle.
  const side = Math.max(bw, bh) * 1.1;
  const cx = b.minX + bw / 2, cy = b.minY + bh / 2;

  const out = resample(px, w, h, cx - side / 2, cy - side / 2, side, OUT_SIZE);
  const file = `public/faraday-${name}.png`;
  writeFileSync(file, encodePng(OUT_SIZE, OUT_SIZE, out));
  console.log(`${file.padEnd(30)} cell ${cell}  bbox ${bw}x${bh}`);
}
