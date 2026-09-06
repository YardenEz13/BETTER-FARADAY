/**
 * Minimal PNG codec: decode, encode, and a box-filter resample.
 *
 * Shared by slice-poses.mjs, cut-rig-layers.mjs and make-favicon.mjs. Only what they need —
 * non-interlaced 8-bit RGB/RGBA in, RGBA out. A native image dependency for a
 * pair of one-time asset scripts is not worth the install.
 */
import { inflateSync, deflateSync } from "node:zlib";

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
export function decodePng(buf) {
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

export function encodePng(w, h, px) {
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

/**
 * Box-filter resample of a square source region into `size`. Averaging in
 * premultiplied alpha keeps the transparent side from bleeding grey into the
 * outline — the fringe you would otherwise see on a dark background.
 */
export function resample(src, sw, sh, sx, sy, side, size) {
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
