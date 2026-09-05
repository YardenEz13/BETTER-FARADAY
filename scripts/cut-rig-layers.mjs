#!/usr/bin/env node
/**
 * Cut the idle Faraday into rig layers — the throwaway that proves the rig.
 *
 *   node scripts/cut-rig-layers.mjs
 *
 * Writes assets-src/faraday-rig.psd — one layered file, because that is what
 * Rive imports as a unit — plus a flattened PNG to eyeball the result.
 *
 * See docs/mascot-plan.md §5 and §14 step 1: this exists to find out whether eye
 * tracking and a blended idle↔thinking are worth the real art, NOT to ship. The
 * source is a 197x211 character upscaled 5x, so the outlines are soft and the
 * hair is one mass instead of three. Both are fine for a rig test and neither is
 * fixable here — they need the redraw in §5.3.
 *
 * ## How the cutting works
 *
 * Same idiom as `slice-mascot.mjs`: flood fill from a seed, stopping where the
 * colour stops matching. The art is flat cartoon fills inside thick dark
 * outlines, so a fill started in the middle of a region walks to that region's
 * outline and halts. Three things make it reliable:
 *
 *   snap      the seed slides to the nearest pixel of the class it wants, so a
 *             coordinate picked by eye off a zoomed render does not have to be
 *             pixel-exact
 *   maxR      a hard radius cap. The pupil touches the upper-lid arc, and
 *             without a cap the fill escapes along it and takes the whole face.
 *   holeFill  anything fully enclosed by the mask joins it. This is what pulls
 *             the white specular crescent into the pupil, and what gives the
 *             head layer a clean face — the eyes, brows, nose and wrinkles are
 *             all holes in the skin region, so they vanish into it.
 *
 * `holeFill` is also the inpainting, and it is exact rather than guessed: the
 * sclera is a closed white shape, so painting its holes with its own white
 * gives a real full disc for the pupil to slide over. Nothing is invented.
 *
 * ## What is NOT solved here
 *
 * The face outline is drawn where the hair overlaps it, so the head layer has a
 * bite out of it under each hair wing. Move the hair more than ~15px at 1024
 * and the bite shows. Fine for secondary motion, not for a real head turn.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, encodePng, resample } from "./png.mjs";
import { encodePsd, decodePsdLayers } from "./psd.mjs";

const SHEET = "assets-src/faraday-sheet.png";
/** One PSD, because Rive imports it as a unit: drag it onto an artboard and
 *  every layer arrives positioned, ordered and named. Loose PNGs would be
 *  twelve manual placements with nothing holding them in register. */
const OUT_PSD = "assets-src/faraday-rig.psd";
const OUT_STACK = "assets-src/faraday-rig-stack.png";
const WORK = 1024;

/** Idle cell bounds, from slice-mascot.mjs. */
const CELL = { x: [35, 264], y: [35, 278], inset: 4 };

/* ── pixel classes ───────────────────────────────────────────────────── */

const at = (px, w, x, y) => (y * w + x) * 4;

function classOf(px, i) {
  if (px[i + 3] < 32) return "none";
  const r = px[i], g = px[i + 1], b = px[i + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx < 70) return "dark";
  if (mx - mn <= 22 && mn > 140) return "white";
  if (r > g && g > b && r - b > 30) return "skin";
  return "other";
}

/** Perceptual-enough distance for flat cartoon fills. */
const dist = (px, i, c) =>
  Math.abs(px[i] - c[0]) + Math.abs(px[i + 1] - c[1]) + Math.abs(px[i + 2] - c[2]);

/* ── mask ops ────────────────────────────────────────────────────────── */

/** Slide a seed to the nearest pixel of `want`, searching outward in rings. */
function snap(px, w, h, [sx, sy], want) {
  for (let r = 0; r <= 40; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = sx + dx, y = sy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (classOf(px, at(px, w, x, y)) === want) return [x, y];
      }
    }
  }
  throw new Error(`no "${want}" pixel within 40px of ${sx},${sy}`);
}

/** Flood fill from seeds, bounded by colour tolerance and radius. */
function fill(px, w, h, seeds, { want, tol, maxR }) {
  const mask = new Uint8Array(w * h);
  for (const raw of seeds) {
    const [sx, sy] = snap(px, w, h, raw, want);
    const c = [px[at(px, w, sx, sy)], px[at(px, w, sx, sy) + 1], px[at(px, w, sx, sy) + 2]];
    const stack = [sy * w + sx];
    while (stack.length) {
      const p = stack.pop();
      if (mask[p]) continue;
      const x = p % w, y = (p - x) / w;
      if (maxR && (x - sx) ** 2 + (y - sy) ** 2 > maxR * maxR) continue;
      const i = p * 4;
      if (px[i + 3] < 32 || dist(px, i, c) > tol) continue;
      mask[p] = 1;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (y > 0) stack.push(p - w);
      if (y < h - 1) stack.push(p + w);
    }
  }
  return mask;
}

/**
 * Add every region fully enclosed by the mask. Flood the *outside* inward from
 * the canvas border through non-mask pixels; whatever the flood never reaches
 * is enclosed. This is what pulls the pupil's white highlight into the pupil,
 * and what turns the head's skin region into a clean face.
 */
function holeFill(mask, w, h) {
  const outside = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (outside[p] || mask[p]) continue;
    outside[p] = 1;
    const x = p % w, y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  const holes = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (!mask[p] && !outside[p]) holes[p] = 1;
  return holes;
}

/**
 * Hand every still-unclaimed pixel to whichever layer is nearest, by one
 * breadth-first sweep out of every claimed pixel at once.
 *
 * What is unclaimed after the fills is the dark outlines and their anti-aliased
 * shoulders — flood fills stop *at* an outline, so no fill ever contains one.
 * Growing each region into `dark` separately does not work: at this upscale an
 * outline shades from the fill colour to black over several pixels, and the
 * mid-tone shoulder is neither dark nor the fill, so every region's growth
 * stalls on the first step and the outlines come out as dots.
 *
 * Sweeping from all layers simultaneously instead splits each outline down its
 * middle, which is what a rig wants: the face keeps the half against the face,
 * the hair keeps the half against the hair, and neither is left edgeless when
 * they move apart.
 */
function nearestOwner(owner, px, w, h) {
  let queue = [];
  for (let p = 0; p < w * h; p++) if (owner[p] >= 0) queue.push(p);
  while (queue.length) {
    const next = [];
    for (const p of queue) {
      const x = p % w, y = (p - x) / w;
      const push = (q) => {
        if (owner[q] >= 0 || px[q * 4 + 3] < 32) return;
        owner[q] = owner[p];
        next.push(q);
      };
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (y > 0) push(p - w);
      if (y < h - 1) push(p + w);
    }
    queue = next;
  }
}

/* ── layer table ─────────────────────────────────────────────────────── */

/**
 * Back to front. Seeds are coordinates in the WORK canvas, read off a zoomed
 * render; `snap` absorbs the imprecision. `paintHoles` fills enclosed regions
 * with the seed colour instead of the original pixels — the inpaint.
 *
 * Later layers win the pixels earlier ones claimed, so the small parts are
 * listed after the big ones they sit on.
 */
const LAYERS = [
  { name: "jacket",      seeds: [[740, 925], [285, 925]], want: "dark",  tol: 90 },
  { name: "bowtie",      seeds: [[505, 910]],             want: "dark",  tol: 80, maxR: 110, holeFill: true },

  // One mass, not three: the swoop and both wings are a single white region in
  // this drawing. Splitting them is hand work on the redraw (plan §5.3).
  { name: "hair",        seeds: [[450, 180], [170, 430], [860, 430]],
                         want: "white", tol: 75, holeFill: true },

  // After the hair, and capped, because his collar and his sideburns are one
  // connected white region — an uncapped fill from either seed takes both, and
  // whichever is listed last wins the lot. The cap keeps each fill local; being
  // listed second is what lets the collar take its half back off the hair.
  { name: "collar",      seeds: [[640, 852], [356, 858]], want: "white", tol: 70, maxR: 120 },

  // The face. holeFill swallows the eyes, brows, nose and wrinkles and
  // paintHoles replaces them with flat skin, which is the inpaint the parts
  // above need to move over.
  { name: "head",        seeds: [[510, 440], [350, 690], [660, 690], [215, 620], [810, 620]],
                         want: "skin", tol: 95, holeFill: true, paintHoles: true },

  // `sitsOn` puts the whole of these — outline, anti-aliased shoulder and all —
  // onto the part rather than the face. Without it the nearest-owner sweep
  // splits each outline down its middle, which is right between the face and
  // the hair but wrong here: it leaves dark ghost sockets painted on the head.
  { name: "eye-white-a", seeds: [[338, 579]], want: "white", tol: 60, maxR: 95, holeFill: true, paintHoles: true, sitsOn: "head" },
  { name: "eye-white-b", seeds: [[682, 579]], want: "white", tol: 60, maxR: 95, holeFill: true, paintHoles: true, sitsOn: "head" },
  { name: "brow-a",      seeds: [[371, 479]], want: "white", tol: 75, maxR: 95, sitsOn: "head" },
  { name: "brow-b",      seeds: [[643, 479]], want: "white", tol: 75, maxR: 95, sitsOn: "head" },
  { name: "mouth",       seeds: [[499, 731]], want: "dark",  tol: 95, maxR: 130, sitsOn: "head" },

  // maxR is doing real work: the pupil touches the upper-lid arc, and without
  // the cap the fill escapes along it and takes the whole face.
  { name: "pupil-a",     seeds: [[391, 582]], want: "dark",  tol: 95, maxR: 52, holeFill: true, sitsOn: "eye-white-a" },
  { name: "pupil-b",     seeds: [[627, 579]], want: "dark",  tol: 95, maxR: 52, holeFill: true, sitsOn: "eye-white-b" },
];

/* ── build ───────────────────────────────────────────────────────────── */

const sheet = decodePng(readFileSync(SHEET));

// Crop the idle cell and key the painted checkerboard, exactly as
// slice-mascot.mjs does — same flood fill, same background test.
const cw = CELL.x[1] - CELL.x[0] - CELL.inset * 2;
const ch = CELL.y[1] - CELL.y[0] - CELL.inset * 2;
const cell = new Uint8ClampedArray(cw * ch * 4);
for (let y = 0; y < ch; y++) {
  const from = ((CELL.y[0] + CELL.inset + y) * sheet.w + CELL.x[0] + CELL.inset) * 4;
  cell.set(sheet.px.subarray(from, from + cw * 4), y * cw * 4);
}
{
  const isBg = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) <= 14 && Math.min(r, g, b) > 196;
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
}

// Square crop on the character's own bounds, then up to WORK. Segmenting the
// upscaled image rather than the 197px original costs nothing and gives the
// masks a smoothed edge to follow instead of a staircase.
let mnX = cw, mxX = 0, mnY = ch, mxY = 0;
for (let p = 0; p < cw * ch; p++) {
  if (cell[p * 4 + 3] <= 24) continue;
  const x = p % cw, y = (p - x) / cw;
  if (x < mnX) mnX = x;
  if (x > mxX) mxX = x;
  if (y < mnY) mnY = y;
  if (y > mxY) mxY = y;
}
const side = Math.max(mxX - mnX + 1, mxY - mnY + 1) * 1.08;
const work = resample(cell, cw, ch,
  mnX + (mxX - mnX + 1) / 2 - side / 2,
  mnY + (mxY - mnY + 1) / 2 - side / 2, side, WORK);


// Pass 1 — fill each region from its seeds.
//
// `owner` tracks who holds each *original* pixel, and drives the sweep below.
// Painted holes are deliberately left out of it: they are colour this script
// invented, and the parts that really live there (a pupil over its sclera, a
// brow over the forehead) must stay free to claim them.
const owner = new Int16Array(WORK * WORK).fill(-1);
const built = LAYERS.map((L, idx) => {
  const mask = fill(work, WORK, WORK, L.seeds, { want: L.want, tol: L.tol, maxR: L.maxR });
  let holes = null;
  if (L.holeFill) {
    holes = holeFill(mask, WORK, WORK);
    for (let p = 0; p < WORK * WORK; p++) if (holes[p]) mask[p] = 1;
  }
  for (let p = 0; p < WORK * WORK; p++) {
    if (!mask[p]) continue;
    if (L.paintHoles && holes[p]) continue;
    owner[p] = idx;
  }
  const [sx, sy] = snap(work, WORK, WORK, L.seeds[0], L.want);
  const si = at(work, WORK, sx, sy);
  return { L, mask, holes, seedRGB: [work[si], work[si + 1], work[si + 2]] };
});

// Pass 2 — the outlines, to whichever layer is nearest.
nearestOwner(owner, work, WORK, WORK);

// Which layer each part sits on, by index, for the paint-over below.
const sitsOn = LAYERS.map((L) => (L.sitsOn ? LAYERS.findIndex((o) => o.name === L.sitsOn) : -1));
sitsOn.forEach((v, i) => {
  if (LAYERS[i].sitsOn && v < 0) throw new Error(`${LAYERS[i].name}: no layer named "${LAYERS[i].sitsOn}"`);
});

// Pass 3 — build each layer: the pixels it owns, plus everything it paints over
// (its own enclosed holes, and whatever sits on top of it).
const cut = [];
for (const [idx, { L, mask, holes, seedRGB }] of built.entries()) {
  const out = new Uint8ClampedArray(WORK * WORK * 4);
  let n = 0, bx0 = WORK, bx1 = 0, by0 = WORK, by1 = 0;
  for (let p = 0; p < WORK * WORK; p++) {
    // `paint` means "synthesise here", and it wins over ownership. The sweep
    // above hands each outline's outer half to whoever is nearest, so the face
    // ends up *owning* the rim around its own eye sockets — checking ownership
    // first would copy those dark pixels straight back onto the clean face.
    const paint = L.paintHoles && ((holes[p] && mask[p]) || sitsOn[owner[p]] === idx);
    if (owner[p] !== idx && !paint) continue;
    const i = p * 4;
    if (paint) {
      out[i] = seedRGB[0]; out[i + 1] = seedRGB[1]; out[i + 2] = seedRGB[2]; out[i + 3] = 255;
    } else {
      out[i] = work[i]; out[i + 1] = work[i + 1]; out[i + 2] = work[i + 2]; out[i + 3] = work[i + 3];
    }
    n++;
    const x = p % WORK, y = (p - x) / WORK;
    if (x < bx0) bx0 = x;
    if (x > bx1) bx1 = x;
    if (y < by0) by0 = y;
    if (y > by1) by1 = y;
  }
  if (!n) throw new Error(`layer "${L.name}" came out empty — seed or tolerance is wrong`);

  // Crop to the layer's own bounds. PSD stores each layer at its bounding box,
  // and the parts are mostly transparent, so this is what keeps the file small.
  const w = bx1 - bx0 + 1, h = by1 - by0 + 1;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((by0 + y) * WORK + bx0 + x) * 4;
      rgba.set(out.subarray(s, s + 4), (y * w + x) * 4);
    }
  }
  cut.push({ name: L.name, x: bx0, y: by0, w, h, rgba, px: n });
  console.log(`${L.name.padEnd(12)} ${String(n).padStart(7)} px   bbox ${bx0},${by0} ${w}x${h}`);
}

// A flattened stack, so a glance says whether the layers still cover him — and
// the composite the PSD carries for readers that ignore layers.
const flat = new Uint8ClampedArray(WORK * WORK * 4);
for (const { x, y, w, h, rgba } of cut) {
  for (let ly = 0; ly < h; ly++) {
    for (let lx = 0; lx < w; lx++) {
      const s = (ly * w + lx) * 4;
      if (rgba[s + 3] < 8) continue;
      const d = ((y + ly) * WORK + x + lx) * 4;
      flat[d] = rgba[s]; flat[d + 1] = rgba[s + 1]; flat[d + 2] = rgba[s + 2]; flat[d + 3] = 255;
    }
  }
}
writeFileSync(OUT_STACK, encodePng(WORK, WORK, flat));

writeFileSync(OUT_PSD, encodePsd({ width: WORK, height: WORK, layers: cut, composite: flat }));

// Round-trip the PSD. Nobody can eyeball a binary, and a layer that comes back
// misplaced or short is exactly the kind of thing that only surfaces once it is
// already open in Rive.
const back = decodePsdLayers(readFileSync(OUT_PSD));
if (back.length !== cut.length) throw new Error(`PSD: wrote ${cut.length} layers, read ${back.length}`);
for (const [i, r] of back.entries()) {
  const w = cut[i];
  if (r.name !== w.name) throw new Error(`PSD layer ${i}: name "${r.name}" != "${w.name}"`);
  if (r.x !== w.x || r.y !== w.y || r.w !== w.w || r.h !== w.h) {
    throw new Error(`PSD layer "${w.name}": bounds ${r.x},${r.y} ${r.w}x${r.h} != ${w.x},${w.y} ${w.w}x${w.h}`);
  }
  if (!r.rgba.equals(w.rgba)) throw new Error(`PSD layer "${w.name}": pixels differ after round-trip`);
}
console.log(`\n${OUT_PSD}  ${(readFileSync(OUT_PSD).length / 1024).toFixed(0)}KB, ` +
  `${back.length} layers, round-trips exactly`);

// Coverage check: the flattened stack must put back essentially all of him. A
// silent drop here is the failure mode this whole script has — a mistuned
// tolerance loses a region and every layer still looks individually fine.
let src = 0, got = 0;
for (let p = 0; p < WORK * WORK; p++) {
  if (work[p * 4 + 3] > 128) src++;
  if (flat[p * 4 + 3] > 128) got++;
}
const cover = got / src;
console.log(`\nstack covers ${(cover * 100).toFixed(1)}% of the source character`);
if (cover < 0.9) {
  console.error("FAIL: layers do not reconstruct him — a region is unassigned.");
  process.exit(1);
}
