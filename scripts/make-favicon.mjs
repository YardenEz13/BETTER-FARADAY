/**
 * Build the app mark from the dedicated icon artwork.
 *
 * Outputs:
 *   public/favicon.svg          the 256px render, base64-embedded, squircle-clipped
 *   public/apple-touch-icon.png 180px opaque — iOS ignores SVG for apple-touch,
 *                               and an installed app then shows no mark at all
 *
 * The source ships with its own muted green backdrop (#20855b), which is not
 * the brand primary. Rather than re-generate the art, the backdrop is flood-
 * filled from the edges and repainted in the brand gradient: the fill stops at
 * the character's outlines, so only the background changes. Selecting by hue
 * (green-dominant) rather than exact colour absorbs the JPEG noise the source
 * arrived with.
 *
 * Re-run after replacing the artwork:  node scripts/make-favicon.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, encodePng, resample } from "./png.mjs";

const SOURCE = "assets-src/faraday-icon.png";
const OUT_SVG = "public/favicon.svg";
const OUT_PNG = "public/apple-touch-icon.png";
const SVG_SIZE = 192; // embedded at 256: 1024 would make a ~700KB favicon
const PNG_SIZE = 180;

/** Brand gradient, top to bottom — matches the badge the rest of the app uses. */
const TOP = [0x22, 0xd8, 0x6b];
const BOTTOM = [0x0e, 0x9e, 0x4d];

/** The artwork's backdrop: clearly green-dominant. His hair, skin and coat are not. */
const isBackdrop = (r, g, b) => g - Math.max(r, b) > 14 && g > 60;

const src = decodePng(readFileSync(SOURCE));
const { w, h, px } = src;

// Flood-fill inward from the edges so only the *outer* backdrop is repainted.
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
  const t = ((p - (p % w)) / w) / (h - 1);
  px[i] = Math.round(TOP[0] + (BOTTOM[0] - TOP[0]) * t);
  px[i + 1] = Math.round(TOP[1] + (BOTTOM[1] - TOP[1]) * t);
  px[i + 2] = Math.round(TOP[2] + (BOTTOM[2] - TOP[2]) * t);
  px[i + 3] = 255;
  const x = p % w, y = (p - x) / w;
  if (x > 0) stack.push(p - 1);
  if (x < w - 1) stack.push(p + 1);
  if (y > 0) stack.push(p - w);
  if (y < h - 1) stack.push(p + w);
}

const render = (size) => encodePng(size, size, resample(px, w, h, 0, 0, w, size));

const b64 = render(SVG_SIZE).toString("base64");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <clipPath id="squircle">
      <rect x="1" y="1" width="62" height="62" rx="15"/>
    </clipPath>
  </defs>

  <image href="data:image/png;base64,${b64}"
         x="1" y="1" width="62" height="62"
         clip-path="url(#squircle)" preserveAspectRatio="xMidYMid slice"/>

  <rect x="1" y="1" width="62" height="62" rx="15" fill="none"
        stroke="#0B7A3B" stroke-opacity="0.55" stroke-width="1.5"/>
</svg>
`;
writeFileSync(OUT_SVG, svg);
console.log(`${OUT_SVG}  ${(svg.length / 1024).toFixed(1)}KB  (${SVG_SIZE}px, from ${SOURCE})`);

// Square, unrounded and fully opaque: iOS applies its own squircle mask (baking
// one in double-rounds it) and composites any transparency against black, which
// would fleck the edges — resampling can leave a few soft pixels there.
const icon = resample(px, w, h, 0, 0, w, PNG_SIZE);
for (let i = 3; i < icon.length; i += 4) icon[i] = 255;
writeFileSync(OUT_PNG, encodePng(PNG_SIZE, PNG_SIZE, icon));
console.log(`${OUT_PNG}  ${PNG_SIZE}x${PNG_SIZE}`);
