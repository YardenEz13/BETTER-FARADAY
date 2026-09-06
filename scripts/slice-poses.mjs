#!/usr/bin/env node
/**
 * Cut the shipped pose PNGs from the high-res portraits.
 *
 *   node scripts/slice-poses.mjs
 *
 * Replaces slice-mascot.mjs for the six head poses. That one cuts cells out of
 * assets-src/faraday-sheet.png, whose cells are 197x211 — the resolution the rig
 * was moved off. This reads the 1024px portraits instead, so every pose is the
 * same vintage as the rig and as each other.
 *
 * Inputs:
 *   assets-src/faraday-hires.png   → faraday-idle.png   (it *is* the idle pose)
 *   assets-src/poses/<name>.png    → faraday-<name>.png (from make-poses.mjs)
 *
 * Missing poses are skipped with a warning rather than failing: the generations
 * arrive one at a time when they are run by hand in AI Studio, and re-running
 * this after each one should work.
 *
 * ## One frame for every pose, sized to the widest
 *
 * Normalising each pose to its own bounding box is what makes a mascot jitter
 * when it swaps: every drawing gets scaled differently, so his head changes size.
 *
 * An earlier version framed on idle's box and let a pose *grow* it when the arms
 * needed room. That fixes position and quietly breaks scale — a bigger box
 * scaled into the same 192px square means a smaller head. `happy` came out 8.3%
 * smaller than `idle`, measured on the distance between his pupils, which is
 * visible when the two swap.
 *
 * So the side is computed once across every pose and every pose uses it. His
 * head is then identical everywhere, and the cost is that the poses without
 * raised arms carry some empty space — cheap, and it compresses to nothing.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { decodePng, encodePng } from "./png.mjs";
import { keyed, sharedFrame, through } from "./mascot-frame.mjs";

const OUT_SIZE = 192;
const SOURCES = [
  { name: "idle",     file: "assets-src/faraday-hires.png" },
  { name: "blink",    file: "assets-src/poses/blink.png" },
  { name: "thinking", file: "assets-src/poses/thinking.png" },
  { name: "happy",    file: "assets-src/poses/happy.png" },
  { name: "wrong",    file: "assets-src/poses/wrong.png" },
  { name: "streak",   file: "assets-src/poses/streak.png" },
];

/* Every pose through the one shared box — see scripts/mascot-frame.mjs. */
const FRAME = sharedFrame();
console.log(`frame ${Math.round(FRAME.side)}px about (${Math.round(FRAME.cx)}, ${Math.round(FRAME.cy)})
`);

for (const { name, file } of SOURCES) {
  if (!existsSync(file)) {
    console.warn(`${name.padEnd(10)} SKIPPED — ${file} not generated yet`);
    continue;
  }
  const k = keyed(file);
  const out = through(FRAME, k, OUT_SIZE);
  const dest = `public/faraday-${name}.png`;
  writeFileSync(dest, encodePng(OUT_SIZE, OUT_SIZE, out));
  console.log(`${name.padEnd(10)} ${dest.padEnd(28)} bbox ${k.b.w}x${k.b.h}`);
}

/* Distinctness check.
 *
 * A generation can come back on-model, correctly framed, and still be the wrong
 * pose: the first `happy` kept its "eyes closed" clause, quietly dropped the
 * raised arms and the open laugh, and landed 0.9% away from `blink`. Every
 * individual layer looked fine. Only comparing the finished poses to each other
 * caught it — and FaradayReaction shows `happy` on every correct answer, so it
 * would have shipped him looking asleep.
 *
 * `blink` is exempt against `idle` on purpose: it is *supposed* to be idle with
 * the eyes shut, and registering tightly against it is what makes the blink
 * animation work. */
const shipped = SOURCES.map((s) => s.name).filter((n) => existsSync(`public/faraday-${n}.png`));
const px = Object.fromEntries(shipped.map((n) => [n, decodePng(readFileSync(`public/faraday-${n}.png`)).px]));
const pctDiff = (a, b) => {
  let d = 0;
  const n = OUT_SIZE * OUT_SIZE;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (Math.abs(px[a][i] - px[b][i]) > 24 || Math.abs(px[a][i + 3] - px[b][i + 3]) > 24) d++;
  }
  return (100 * d) / n;
};
const TOO_ALIKE = 2.0;
const clashes = [];
for (let i = 0; i < shipped.length; i++) {
  for (let j = i + 1; j < shipped.length; j++) {
    const [a, b] = [shipped[i], shipped[j]];
    if (a === "idle" && b === "blink") continue;
    if (b === "idle" && a === "blink") continue;
    const d = pctDiff(a, b);
    if (d < TOO_ALIKE) clashes.push(`${a} vs ${b}: ${d.toFixed(1)}% different`);
  }
}
if (clashes.length) {
  console.error(`\nFAIL: poses that should be distinct are near-identical (< ${TOO_ALIKE}%):`);
  for (const c of clashes) console.error("  " + c);
  console.error("Regenerate the offender — the model likely dropped the gesture and kept only the expression.");
  process.exit(1);
}
console.log(`\nall ${shipped.length} poses mutually distinct`);
