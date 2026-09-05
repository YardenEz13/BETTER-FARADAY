#!/usr/bin/env node
/**
 * Regenerate the five non-idle head poses, on-model, from the high-res idle.
 *
 *   node scripts/make-poses.mjs --print            # write prompts for manual runs
 *   node --env-file=.env.local scripts/make-poses.mjs   # generate them all
 *
 * `idle` is not in here: assets-src/faraday-hires.png already *is* the idle
 * pose, and slice-poses.mjs cuts it straight out.
 *
 * ## Why these cannot be composed from the rig
 *
 * The rig has twelve layers and none of them is an arm. The current poses are
 * real drawings — a hand at the chin, both arms raised, an open palm, an open
 * laughing mouth — and rendering them off the rig would give five near-identical
 * heads with slightly different eyebrows. Expression is not the same thing as
 * gesture.
 *
 * ## Seeded from the hires idle, not the sheet
 *
 * Every pose attaches assets-src/faraday-hires.png, so all six end up the same
 * vintage as the rig. Seeding from the old 197px sheet instead would reintroduce
 * exactly the mismatch this is fixing. Text-only would reinvent his face.
 *
 * ## No baked sparks
 *
 * The old `happy` carried green sparks and `streak` amber bolts, drawn into the
 * art. They are left out here: `SparkBurst` in src/components/electric already
 * draws them at runtime — FaradayReaction uses it — so baking them in duplicates
 * the effect, freezes its colour, and hands the transparency key a field of
 * detached islands to trip over.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const PRINT = process.argv.includes("--print");
const KEY = process.env.GEMINI_API_KEY;
const API = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
const SEED = "assets-src/faraday-hires.png";
const OUT_DIR = "assets-src/poses";
const PROMPT_DIR = "assets-src/poses/prompts";

/** Shared clauses. Every one of these is a failure already recorded in this
 *  repo — see the "Prompt notes" section of assets-src/README.md. */
const RULES = `
Keep everything about his design identical to the attached picture: the same
head and face proportions, the same hair shape and volume, the same eyebrow
shape, the same skin tone, the same white hair, the same black collar and black
bow tie. Match the attached picture's line weight and level of detail exactly —
no added wrinkles, no extra shading, no glossy highlights, no change of art
style. This is the same character, drawn in a different pose.

Flat 2D cartoon illustration with flat colour fills and a continuous unbroken
dark outline around the whole silhouette, with no gaps anywhere in that outline.

One single picture containing exactly one character. A flat solid magenta
backdrop, completely uniform, with nothing else in the picture: no shadows, no
drop shadow, no glow, no vignette, no sparkles, no lightning, no particles, no
text, no watermark, no background scenery.

His head fills roughly half the picture height with clear space above it. Keep
everything inside the middle 80% of the picture, nothing in the outer 10%. Show
his head, shoulders and hands only — do NOT show his waist, belt, hips or legs.`;

const POSES = [
  { name: "thinking", action:
    `He is thinking: one hand raised to his chin with the index finger resting
against his cheek, eyes glancing up and to one side, one eyebrow raised higher
than the other, mouth a small closed thoughtful line.` },
  { name: "happy", action:
    `He is delighted: both arms raised up and out in celebration with open hands,
eyes closed in a happy upward curve, mouth open in a wide joyful laugh.` },
  { name: "wrong", action:
    `He is gently encouraging: one open palm raised toward the viewer in a soft
"not quite, try again" gesture, eyebrows tilted up in the middle in sympathy,
mouth a small warm closed smile. He is kind here, never disappointed or stern.` },
  { name: "streak", action:
    `He is excited: eyes wide and bright, both eyebrows raised high, mouth open in
a broad enthusiastic grin, shoulders lifted.` },
  { name: "blink", action:
    `Exactly the same pose as the attached picture, unchanged in every way, except
that both eyes are fully closed — each eye a simple downward-curving closed
eyelid line. Everything else is identical: same head angle, same mouth, same
eyebrows, same shoulders.` },
];

const promptFor = (p) =>
  `The attached picture shows FARADAY, a cartoon professor. Draw FARADAY again, ` +
  `keeping his design exactly as in the attached picture, in this pose:\n\n${p.action.trim()}\n${RULES}`;

if (PRINT) {
  mkdirSync(PROMPT_DIR, { recursive: true });
  for (const p of POSES) {
    const file = `${PROMPT_DIR}/${p.name}.txt`;
    writeFileSync(file, promptFor(p) + "\n");
    console.log("wrote", file);
  }
  console.log(`\nAttach ${SEED} to each, 1:1, largest size offered.`);
  console.log(`Save results as ${OUT_DIR}/<pose>.png, then: node scripts/slice-poses.mjs`);
  process.exit(0);
}

if (!KEY) {
  console.error("GEMINI_API_KEY not set. Use --print to emit prompts for manual runs instead.");
  process.exit(1);
}
console.log(`using GEMINI_API_KEY ${KEY.slice(0, 6)}…${KEY.slice(-4)}  model ${MODEL}`);
mkdirSync(OUT_DIR, { recursive: true });

const seed = readFileSync(SEED).toString("base64");
for (const p of POSES) {
  const res = await fetch(`${API}/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [
        { text: promptFor(p) },
        { inline_data: { mime_type: "image/png", data: seed } },
      ] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1", imageSize: "2K" } },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`${p.name}: failed ${res.status}`, t.replace(KEY, "<KEY>").slice(0, 300));
    if (t.includes("limit: 0")) console.error("  Image generation is not on the free tier — use --print and run in AI Studio.");
    process.exit(1);
  }
  const json = await res.json();
  const part = json.candidates?.[0]?.content?.parts?.find((x) => x.inlineData ?? x.inline_data);
  const data = part?.inlineData?.data ?? part?.inline_data?.data;
  if (!data) { console.error(`${p.name}: no image in response`); process.exit(1); }
  writeFileSync(`${OUT_DIR}/${p.name}.png`, Buffer.from(data, "base64"));
  console.log(`${p.name.padEnd(10)} wrote ${OUT_DIR}/${p.name}.png`);
}
console.log("\nNow: node scripts/slice-poses.mjs");
