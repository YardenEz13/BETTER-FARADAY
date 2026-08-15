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
 *
 * No image dependency — PNG in/out is zlib plus about eighty lines, and a
 * native module for a one-time asset step is not worth the install.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

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

/* ── PNG ─────────────────────────────────────────────────────────────── */

const CRC = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = ~0;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
};

/** Decode a non-interlaced 8-bit RGB/RGBA PNG to {w,h,px:RGBA}. */
function decodePng(buf) {
  let p = 8, w = 0, h = 0, colorType = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} unsupported`);
      if (colorType !== 2 && colorType !== 6) throw new Error(`colour type ${colorType} unsupported`);
      if (data[12] !== 0) throw new Error("interlaced PNG unsupported");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }

  const src = inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = w * bpp;
  const raw = Buffer.alloc(h * stride);

  // Undo the per-row filters (PNG spec §9).
  for (let y = 0; y < h; y++) {
    const filter = src[y * (stride + 1)];
    const inRow = src.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = raw.subarray(y * stride, (y + 1) * stride);
    const prev = y ? raw.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v = inRow[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[i] = v & 0xff;
    }
  }

  // Normalise to RGBA so the rest of the script has one layout to think about.
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += bpp) {
    px[i * 4] = raw[j];
    px[i * 4 + 1] = raw[j + 1];
    px[i * 4 + 2] = raw[j + 2];
    px[i * 4 + 3] = bpp === 4 ? raw[j + 3] : 255;
  }
  return { w, h, px };
}

function encodePng(w, h, px) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none — these are tiny, deflate copes
    Buffer.from(px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

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

/**
 * Box-filter resample of a square source region into `size`. Averaging in
 * premultiplied alpha keeps the transparent side from bleeding grey into the
 * outline — the fringe you would otherwise see on a dark background.
 */
function resample(src, sw, sh, sx, sy, side, size) {
  const out = new Uint8ClampedArray(size * size * 4);
  const step = side / size;
  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      const x0 = Math.floor(sx + ox * step), x1 = Math.max(x0 + 1, Math.floor(sx + (ox + 1) * step));
      const y0 = Math.floor(sy + oy * step), y1 = Math.max(y0 + 1, Math.floor(sy + (oy + 1) * step));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          n++;
          if (x < 0 || y < 0 || x >= sw || y >= sh) continue;
          const i = (y * sw + x) * 4, al = src[i + 3] / 255;
          r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += src[i + 3];
        }
      }
      const o = (oy * size + ox) * 4;
      const am = a / n;
      out[o + 3] = Math.round(am);
      if (am > 0) {
        const un = n * (am / 255);
        out[o] = Math.round(r / un); out[o + 1] = Math.round(g / un); out[o + 2] = Math.round(b / un);
      }
    }
  }
  return out;
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
