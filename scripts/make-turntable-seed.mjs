#!/usr/bin/env node
/**
 * Build the Veo seed frame for the turntable: cut the canonical idle cell out
 * of assets-src/faraday-sheet.png, key the painted checkerboard off it, flatten
 * onto flat magenta and upscale to 1024.
 *
 *   node scripts/make-turntable-seed.mjs <out.png>
 *
 * Why not just seed from public/faraday-idle.png: at 192px it is far too small
 * to hold a character through image-to-video. The sheet is the highest-res copy
 * of him we have.
 *
 * Magenta because the rest of the sprite pipeline keys against it and his
 * palette has none — see extract-poses.mjs and assets-src/README.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, encodePng, resample } from "./png.mjs";

const { w, h, px } = decodePng(readFileSync("assets-src/faraday-sheet.png"));
const [x0, x1] = [35, 264], [y0, y1] = [35, 278], INSET = 4;

const isBg = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) <= 14 && Math.min(r, g, b) > 196;

// Flood-fill inward from the cell edges; the character's thick outline stops it.
const cw = x1 - x0 - INSET * 2, ch = y1 - y0 - INSET * 2;
const cell = new Uint8Array(cw * ch * 4);
for (let y = 0; y < ch; y++)
  for (let x = 0; x < cw; x++)
    cell.set(px.subarray(((y0 + INSET + y) * w + x0 + INSET + x) * 4, ((y0 + INSET + y) * w + x0 + INSET + x) * 4 + 4), (y * cw + x) * 4);

const seen = new Uint8Array(cw * ch), stack = [];
for (let x = 0; x < cw; x++) stack.push(x, (ch - 1) * cw + x);
for (let y = 0; y < ch; y++) stack.push(y * cw, y * cw + cw - 1);
while (stack.length) {
  const p = stack.pop();
  if (seen[p]) continue;
  seen[p] = 1;
  const i = p * 4;
  if (!isBg(cell[i], cell[i + 1], cell[i + 2])) continue;
  cell[i + 3] = 0;
  const x = p % cw, y = (p - x) / cw;
  if (x > 0) stack.push(p - 1);
  if (x < cw - 1) stack.push(p + 1);
  if (y > 0) stack.push(p - cw);
  if (y < ch - 1) stack.push(p + cw);
}

// Flatten onto flat magenta. Key on min(r,b)-g, so exact #FF00FF is not needed —
// but his palette has no magenta, which is the point.
for (let i = 0; i < cell.length; i += 4) {
  if (cell[i + 3] < 128) { cell[i] = 0xE0; cell[i + 1] = 0x1B; cell[i + 2] = 0xC8; cell[i + 3] = 255; }
}

// Square it with magenta margin, then upscale: a 220px seed is too small for Veo.
const side = Math.max(cw, ch), pad = 1024;
const sq = new Uint8Array(side * side * 4);
for (let i = 0; i < sq.length; i += 4) { sq[i] = 0xE0; sq[i + 1] = 0x1B; sq[i + 2] = 0xC8; sq[i + 3] = 255; }
const ox = ((side - cw) / 2) | 0, oy = ((side - ch) / 2) | 0;
for (let y = 0; y < ch; y++)
  for (let x = 0; x < cw; x++)
    sq.set(cell.subarray((y * cw + x) * 4, (y * cw + x) * 4 + 4), ((y + oy) * side + x + ox) * 4);

writeFileSync(process.argv[2], encodePng(pad, pad, resample(sq, side, side, 0, 0, side, pad)));
console.log(`seed ${pad}x${pad} from cell ${cw}x${ch}`);
