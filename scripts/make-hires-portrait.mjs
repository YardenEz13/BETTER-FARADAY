#!/usr/bin/env node
/**
 * Redraw the idle Faraday at high resolution, on-model, with Nano Banana.
 *
 *   node scripts/make-turntable-seed.mjs assets-src/seed-idle.png
 *   node --env-file=.env.local scripts/make-hires-portrait.mjs \
 *        assets-src/seed-idle.png assets-src/faraday-hires.png
 *
 * Needs GEMINI_API_KEY in .env.local, which is gitignored (`*.local`). Prefer
 * that over `GEMINI_API_KEY=... node …` on one line: the inline form puts the
 * key in your shell history, and Node reads the file natively since 20.6.
 *
 * Dev-machine tool. Costs a paid image generation per run — do not put this in
 * CI, and look at the output before spending again.
 *
 * ## Why this exists
 *
 * The rig in `scripts/cut-rig-layers.mjs` is cut from a 197x211 head upscaled
 * 5x, so its outlines are soft. This asks for the *same drawing* back at 2K
 * instead of a new one: same proportions, same line weight, same palette, just
 * enough resolution that the cut layers hold up at 200px.
 *
 * ## Why image-to-image and never text-to-image
 *
 * Text reinvents the character every call — two "same character" images are two
 * different people. The seed is the whole mechanism, and it has to be big:
 * `make-turntable-seed.mjs` upscales the canonical idle cell to 1024 on the flat
 * magenta the rest of this pipeline keys against (his palette has no magenta).
 * Naming him in the prompt is the documented way to hold identity on top of that.
 *
 * ## The prompt is a list of failures this project already hit
 *
 * Every clause maps to something in the "Prompt notes" section of
 * assets-src/README.md, or to a known Nano Banana failure:
 *
 *   - framing said twice, positively and negatively, because positive-only was
 *     ignored twice here already
 *   - no `sheet`/`row`/`cell`/`grid`/`panel` anywhere — those nouns are what
 *     make it return a contact sheet instead of one portrait
 *   - "middle 80%" because a circular crop clips whatever reaches the edge
 *   - the unbroken outline, because the transparency key is an edge-in flood
 *     fill and it leaks through any gap in the silhouette
 *   - no shadows, glows or sparkles: they survive the key as floating debris
 *   - "match the line weight exactly" because the model's default is to render
 *     heavier and more detailed than the reference and quietly restyle him
 */
import { readFileSync, writeFileSync } from "node:fs";

const [seedPath, outPath] = process.argv.slice(2);
const KEY = process.env.GEMINI_API_KEY;
if (!seedPath || !outPath) {
  console.error("usage: make-hires-portrait.mjs <seed.png> <out.png>");
  process.exit(1);
}
if (!KEY) { console.error("GEMINI_API_KEY not set"); process.exit(1); }

const API = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-3.1-flash-image";

const prompt = `The attached picture shows FARADAY, a cartoon professor. Redraw
FARADAY exactly as he appears in the attached picture, at high resolution with
crisp clean vector-like edges.

Keep everything about his design identical to the reference: the same head and
face proportions, the same hair shape and volume, the same eyebrow shape, the
same eyes, the same nose, the same closed friendly smile, the same skin tone,
the same white hair, the same black collar and black bow tie. Match the
reference's line weight and level of detail exactly — no added wrinkles, no
extra shading, no glossy highlights, no texture, no change of art style. This is
the same character in the same pose, drawn more cleanly, not a new drawing.

Flat 2D cartoon illustration with flat colour fills and a continuous unbroken
dark outline around the whole silhouette, with no gaps anywhere in that outline.

One single picture containing exactly one character, facing straight forward,
looking at the viewer, eyes open, holding one neutral friendly expression.

A flat solid magenta backdrop, completely uniform, with nothing else in the
picture: no shadows, no drop shadow, no glow, no vignette, no sparkles, no
particles, no text, no watermark, no background scenery.

His head fills roughly half the picture height with clear space above it. Keep
everything inside the middle 80% of the picture, nothing in the outer 10%. Show
his head and upper chest only — do NOT show his waist, belt, hips or legs.`;

const body = {
  contents: [{
    role: "user",
    parts: [
      { text: prompt },
      { inline_data: { mime_type: "image/png", data: readFileSync(seedPath).toString("base64") } },
    ],
  }],
  generationConfig: {
    responseModalities: ["IMAGE"],
    imageConfig: { aspectRatio: "1:1", imageSize: "2K" },
  },
};

const res = await fetch(`${API}/models/${MODEL}:generateContent`, {
  method: "POST",
  headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
if (!res.ok) {
  const text = await res.text();
  console.error("request failed", res.status, text.slice(0, 900));
  // A well-formed key that Google still rejects is a project/enablement
  // problem, not a typo, and the raw 400 says none of that. This has already
  // cost one debugging round here.
  if (text.includes("API_KEY_INVALID")) {
    console.error(`
The key parsed fine — this is Google refusing it, not a formatting problem.
Check, in order:
  1. Brand new key? Give it a minute to propagate, then retry.
  2. https://aistudio.google.com/apikey — is this key listed and active, under
     the project you expect? Keys are per-project and per-account.
  3. Does the key carry API restrictions that exclude "Generative Language API"?
  4. Is the Generative Language API enabled on that project at all? A key made
     in Cloud Console does not enable it for you; an AI Studio key does.
Quickest fix is usually a fresh key from AI Studio, which enables the API with it.

Test any key without running a generation:
  node --env-file=.env.local -e 'fetch("https://generativelanguage.googleapis.com/v1beta/models",{headers:{"x-goog-api-key":process.env.GEMINI_API_KEY}}).then(r=>console.log(r.status===200?"key works":"rejected: "+r.status))'
`);
  }
  process.exit(1);
}
const json = await res.json();
const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData ?? p.inline_data);
const data = part?.inlineData?.data ?? part?.inline_data?.data;
if (!data) {
  console.error("no image in response", JSON.stringify(json).slice(0, 900));
  process.exit(1);
}
writeFileSync(outPath, Buffer.from(data, "base64"));
console.log("wrote", outPath, `${(readFileSync(outPath).length / 1024).toFixed(0)}KB`);
