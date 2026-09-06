/**
 * Minimal layered-PSD writer and reader. Sibling to png.mjs — no dependency,
 * only the parts this project needs.
 *
 * It exists because Rive imports a PSD as a unit: drag one in and every layer
 * lands on the artboard already positioned, ordered and named. Twelve loose
 * PNGs mean twelve manual placements and no guarantee they register.
 *
 * Writes 8-bit RGB + alpha, one flat (ungrouped) layer per entry, RLE
 * compressed. Format per Adobe's Photoshop File Formats spec: a 26-byte header,
 * an empty colour-mode block, an empty image-resources block, the layer
 * section, then the flattened composite that non-layered readers show.
 *
 * Each layer stores only its own bounding box rather than the full canvas,
 * which is what keeps the file small — the parts are mostly transparent.
 */

const u8 = (v) => { const b = Buffer.alloc(1); b.writeUInt8(v); return b; };
const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16BE(v); return b; };
const i16 = (v) => { const b = Buffer.alloc(2); b.writeInt16BE(v); return b; };
const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b; };
const ascii = (s) => Buffer.from(s, "latin1");

/* ── PackBits ────────────────────────────────────────────────────────── */

/**
 * PackBits, the run-length coding PSD uses. A negative header byte means
 * "repeat the next byte 1-n times", a non-negative one means "copy the next
 * n+1 bytes literally".
 *
 * Runs are only taken at three or more repeats: at two they break even, and
 * mixing the thresholds between here and the literal scan below makes the coder
 * alternate between the two branches on the same byte and stall.
 */
export function packBits(src) {
  const out = [];
  for (let i = 0; i < src.length;) {
    let run = 1;
    while (i + run < src.length && src[i + run] === src[i] && run < 128) run++;
    if (run >= 3) {
      out.push(257 - run, src[i]);
      i += run;
      continue;
    }
    const start = i;
    let lit = 0;
    while (i < src.length && lit < 128) {
      if (i + 2 < src.length && src[i] === src[i + 1] && src[i] === src[i + 2]) break;
      i++; lit++;
    }
    out.push(lit - 1);
    for (let k = 0; k < lit; k++) out.push(src[start + k]);
  }
  return Buffer.from(out);
}

export function unpackBits(src, expected) {
  const out = Buffer.alloc(expected);
  let o = 0;
  for (let i = 0; i < src.length && o < expected;) {
    const n = src.readInt8(i++);
    if (n >= 0) {
      for (let k = 0; k <= n; k++) out[o++] = src[i++];
    } else if (n !== -128) {
      const b = src[i++];
      for (let k = 0; k < 1 - n; k++) out[o++] = b;
    }
  }
  return out;
}

/* ── write ───────────────────────────────────────────────────────────── */

/** One channel of one layer: its own compression flag, row lengths, then rows. */
function rleChannel(plane, w, h) {
  const counts = Buffer.alloc(h * 2), rows = [];
  for (let y = 0; y < h; y++) {
    const enc = packBits(plane.subarray(y * w, (y + 1) * w));
    counts.writeUInt16BE(enc.length, y * 2);
    rows.push(enc);
  }
  return Buffer.concat([u16(1), counts, ...rows]);
}

/** A Pascal string padded so the whole thing is a multiple of four bytes. */
function pascal4(s) {
  const b = ascii(s.slice(0, 255));
  const pad = (4 - ((1 + b.length) % 4)) % 4;
  return Buffer.concat([u8(b.length), b, Buffer.alloc(pad)]);
}

/**
 * @param width,height  canvas size
 * @param layers        bottom-to-top: { name, x, y, w, h, rgba }
 * @param composite     RGBA for the whole canvas, for readers that ignore layers
 */
export function encodePsd({ width, height, layers, composite }) {
  const records = [], channels = [];

  for (const { name, x, y, w, h, rgba } of layers) {
    // Alpha first, then RGB. The ids are explicit, so the order only has to
    // match the order the data is written in below.
    const ids = [-1, 0, 1, 2], offsets = [3, 0, 1, 2];
    const blocks = offsets.map((off) => {
      const plane = Buffer.alloc(w * h);
      for (let p = 0; p < w * h; p++) plane[p] = rgba[p * 4 + off];
      return rleChannel(plane, w, h);
    });

    const info = Buffer.concat(
      ids.map((id, k) => Buffer.concat([i16(id), u32(blocks[k].length)])),
    );
    const nameBuf = pascal4(name);
    const extra = Buffer.concat([u32(0), u32(0), nameBuf]);

    records.push(Buffer.concat([
      u32(y), u32(x), u32(y + h), u32(x + w),   // top, left, bottom, right
      u16(ids.length), info,
      ascii("8BIM"), ascii("norm"),
      u8(255),   // opacity
      u8(0),     // clipping
      // Flags. Bit 1 set means HIDDEN, and Rive silently drops hidden layers on
      // import — so this byte must stay zero.
      u8(0),
      u8(0),     // filler
      u32(extra.length), extra,
    ]));
    channels.push(...blocks);
  }

  let layerInfo = Buffer.concat([i16(layers.length), ...records, ...channels]);
  if (layerInfo.length % 2) layerInfo = Buffer.concat([layerInfo, Buffer.alloc(1)]);
  const layerSection = Buffer.concat([u32(layerInfo.length), layerInfo, u32(0)]);

  // Composite: one compression flag, then every row length for every channel,
  // then the rows. Laid out differently from the per-layer channels above.
  const counts = Buffer.alloc(height * 4 * 2), rows = [];
  for (let c = 0; c < 4; c++) {
    const off = [0, 1, 2, 3][c];
    for (let y = 0; y < height; y++) {
      const row = Buffer.alloc(width);
      for (let x = 0; x < width; x++) row[x] = composite[(y * width + x) * 4 + off];
      const enc = packBits(row);
      counts.writeUInt16BE(enc.length, (c * height + y) * 2);
      rows.push(enc);
    }
  }

  return Buffer.concat([
    ascii("8BPS"), u16(1), Buffer.alloc(6), u16(4), u32(height), u32(width), u16(8), u16(3),
    u32(0),                                   // colour mode data
    u32(0),                                   // image resources
    u32(layerSection.length), layerSection,
    u16(1), counts, ...rows,
  ]);
}

/* ── read ────────────────────────────────────────────────────────────── */

/**
 * Read back the layer section. Only enough to check what was written — the
 * layer geometry, names and pixels. Ignores the composite.
 */
export function decodePsdLayers(buf) {
  if (buf.subarray(0, 4).toString("latin1") !== "8BPS") throw new Error("not a PSD");
  let p = 26;
  p += 4 + buf.readUInt32BE(p);              // colour mode data
  p += 4 + buf.readUInt32BE(p);              // image resources
  p += 4;                                    // layer+mask section length
  p += 4;                                    // layer info length
  const count = buf.readInt16BE(p); p += 2;

  const metas = [];
  for (let i = 0; i < Math.abs(count); i++) {
    const top = buf.readUInt32BE(p), left = buf.readUInt32BE(p + 4);
    const bottom = buf.readUInt32BE(p + 8), right = buf.readUInt32BE(p + 12);
    p += 16;
    const nch = buf.readUInt16BE(p); p += 2;
    const chans = [];
    for (let c = 0; c < nch; c++) {
      chans.push({ id: buf.readInt16BE(p), len: buf.readUInt32BE(p + 2) });
      p += 6;
    }
    p += 12;                                 // 8BIM + blend key + opacity/clip/flags/filler
    const extraLen = buf.readUInt32BE(p); p += 4;
    const extraEnd = p + extraLen;
    p += 4 + buf.readUInt32BE(p);            // mask
    p += 4 + buf.readUInt32BE(p);            // blending ranges
    const name = buf.subarray(p + 1, p + 1 + buf.readUInt8(p)).toString("latin1");
    p = extraEnd;
    metas.push({ name, x: left, y: top, w: right - left, h: bottom - top, chans });
  }

  return metas.map((m) => {
    const rgba = Buffer.alloc(m.w * m.h * 4);
    for (const ch of m.chans) {
      const end = p + ch.len;
      const comp = buf.readUInt16BE(p);
      let plane;
      if (comp === 1) {
        const counts = [];
        let q = p + 2;
        for (let y = 0; y < m.h; y++) { counts.push(buf.readUInt16BE(q)); q += 2; }
        plane = Buffer.alloc(m.w * m.h);
        for (let y = 0; y < m.h; y++) {
          unpackBits(buf.subarray(q, q + counts[y]), m.w).copy(plane, y * m.w);
          q += counts[y];
        }
      } else {
        plane = buf.subarray(p + 2, p + 2 + m.w * m.h);
      }
      const off = ch.id === -1 ? 3 : ch.id;
      for (let i = 0; i < m.w * m.h; i++) rgba[i * 4 + off] = plane[i];
      p = end;
    }
    return { name: m.name, x: m.x, y: m.y, w: m.w, h: m.h, rgba };
  });
}
