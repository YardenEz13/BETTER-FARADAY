/**
 * Build public/favicon.svg from the mascot: a clay-green badge with Faraday's
 * head embedded as a base64 PNG.
 *
 * Embedding beats shipping a set of PNG icon sizes — one file covers favicon,
 * apple-touch and the PWA manifest (`sizes: 'any'`), and index.html and the
 * manifest need no edits at all.
 *
 * The head is scaled past the badge and clipped, because at 16px a favicon has
 * room for a face or for shoulders, not both.
 *
 * Re-run after re-slicing the sheet:  node scripts/make-favicon.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, encodePng, resample } from "./png.mjs";

const SOURCE = "public/faraday-idle.png";
const OUT = "public/favicon.svg";
const OUT_PNG = "public/apple-touch-icon.png";
const PNG_SIZE = 180;

/** Badge framing in the 64-unit viewBox, shared by both outputs. */
const FRAME = { x: -6, y: -1, size: 76 };

const b64 = readFileSync(SOURCE).toString("base64");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22D86B"/>
      <stop offset="100%" stop-color="#0E9E4D"/>
    </linearGradient>
    <clipPath id="squircle">
      <rect x="1" y="1" width="62" height="62" rx="15"/>
    </clipPath>
  </defs>

  <g clip-path="url(#squircle)">
    <rect x="1" y="1" width="62" height="62" fill="url(#badge)"/>
    <!-- top sheen, so the badge reads as clay rather than flat fill -->
    <ellipse cx="24" cy="6" rx="30" ry="14" fill="#ffffff" opacity="0.16"/>
    <!-- Framing tuned by eye at 16/32/64px: the largest the head goes before
         the chin starts clipping. Tighter loses the face, looser loses 16px. -->
    <image href="data:image/png;base64,${b64}"
           x="${FRAME.x}" y="${FRAME.y}" width="${FRAME.size}" height="${FRAME.size}"
           preserveAspectRatio="xMidYMid meet"/>
  </g>

  <rect x="1" y="1" width="62" height="62" rx="15" fill="none"
        stroke="#0B7A3B" stroke-opacity="0.55" stroke-width="1.5"/>
</svg>
`;

writeFileSync(OUT, svg);
console.log(`${OUT}  ${(svg.length / 1024).toFixed(1)}KB  (from ${SOURCE})`);

/* ── apple-touch-icon ────────────────────────────────────────────────────
   iOS ignores SVG for apple-touch-icon, so the home-screen icon has to be a
   real PNG or the install shows no mark at all. Square and unrounded: iOS
   applies its own squircle mask, and baking one in double-rounds it. */

const src = decodePng(readFileSync(SOURCE));
const k = PNG_SIZE / 64; // viewBox units → icon pixels
const headSize = Math.round(FRAME.size * k);
const head = resample(src.px, src.w, src.h, 0, 0, src.w, headSize);
const offX = Math.round(FRAME.x * k);
const offY = Math.round(FRAME.y * k);

const icon = new Uint8ClampedArray(PNG_SIZE * PNG_SIZE * 4);
for (let y = 0; y < PNG_SIZE; y++) {
  // same top-to-bottom badge gradient as the SVG
  const t = y / (PNG_SIZE - 1);
  const bg = [
    Math.round(0x22 + (0x0e - 0x22) * t),
    Math.round(0xd8 + (0x9e - 0xd8) * t),
    Math.round(0x6b + (0x4d - 0x6b) * t),
  ];
  for (let x = 0; x < PNG_SIZE; x++) {
    const o = (y * PNG_SIZE + x) * 4;
    const sxi = x - offX, syi = y - offY;
    let a = 0, rgb = [0, 0, 0];
    if (sxi >= 0 && syi >= 0 && sxi < headSize && syi < headSize) {
      const i = (syi * headSize + sxi) * 4;
      a = head[i + 3] / 255;
      rgb = [head[i], head[i + 1], head[i + 2]];
    }
    icon[o] = Math.round(rgb[0] * a + bg[0] * (1 - a));
    icon[o + 1] = Math.round(rgb[1] * a + bg[1] * (1 - a));
    icon[o + 2] = Math.round(rgb[2] * a + bg[2] * (1 - a));
    icon[o + 3] = 255;
  }
}

writeFileSync(OUT_PNG, encodePng(PNG_SIZE, PNG_SIZE, icon));
console.log(`${OUT_PNG}  ${PNG_SIZE}x${PNG_SIZE}`);
