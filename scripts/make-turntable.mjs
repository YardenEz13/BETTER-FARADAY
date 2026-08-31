#!/usr/bin/env node
/**
 * Generate the mascot turntable clip with Veo, from a seed frame.
 *
 *   node scripts/make-turntable.mjs <seed.png> <out.mp4>
 *
 * Dev-machine tool. Costs a paid Veo generation per run (8s is the max clip and
 * the minimum you get, whatever you ask for) — do not put this in CI, and read
 * the clip before spending again.
 *
 * Why image-to-video and not text-to-video: text reinvents the character every
 * call. Seeding with a real, on-model, high-res frame is what holds his face.
 * The seed must be big — a 192px sprite is far too small — so it is cut from
 * assets-src/faraday-sheet.png and upscaled, on the same flat magenta backdrop
 * the rest of the sprite pipeline keys against (his palette has no magenta).
 *
 * Everything the prompt insists on is a failure this project has already hit:
 * see the "Prompt notes" section of assets-src/README.md.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [seedPath, outPath] = process.argv.slice(2);
const KEY = process.env.GEMINI_API_KEY;
if (!seedPath || !outPath) { console.error("usage: make-turntable.mjs <seed.png> <out.mp4>"); process.exit(1); }
if (!KEY) { console.error("GEMINI_API_KEY not set"); process.exit(1); }

const API = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "veo-3.1-generate-preview";

const prompt = `Locked-off camera, no camera movement whatsoever, no zoom, no pan.
FARADAY, the cartoon professor in the attached image: keep his design, line weight,
hair shape and volume, skin tone, eyebrows and clothing exactly as in the reference —
no added wrinkles, no glossy highlights, no extra shading, no change of art style.
He rotates slowly and smoothly in place around his own vertical axis, one single
complete turn at perfectly constant speed, showing his left side, the back of his
head, his right side, and coming back to face forward. He holds one neutral friendly
expression the whole time and does not nod, tilt, blink or talk.
A flat solid magenta backdrop, completely uniform and identical in every frame.
Flat 2D cartoon illustration with a continuous unbroken dark outline around the whole
silhouette, no gaps anywhere in that outline. His head fills roughly half the frame
height with clear space above it; keep everything inside the middle 80% of frame,
nothing in the outer 10%. Show his head and upper chest only — do NOT show his waist,
belt, hips or legs. The rotation returns to the exact starting position, and the final
frame is pixel-identical to the first frame.`;

const body = {
  instances: [{
    prompt,
    image: { bytesBase64Encoded: readFileSync(seedPath).toString("base64"), mimeType: "image/png" },
  }],
  parameters: {
    aspectRatio: "16:9",
    resolution: "720p",
    // 8s is both the cap and what you get when passing a reference image. The
    // REST API wants a NUMBER here; the SDK's own docs say string, and it 400s.
    durationSeconds: 8,
    negativePrompt: "motion blur, shadows, drop shadow, glow, vignette, sparkles, particles, text, captions, watermark, camera shake, background scenery, gradient background",
  },
};

const post = await fetch(`${API}/models/${MODEL}:predictLongRunning`, {
  method: "POST",
  headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
if (!post.ok) { console.error("start failed", post.status, (await post.text()).slice(0, 600)); process.exit(1); }
let op = await post.json();
console.log("started", op.name);

// Long-running op: poll until done. Veo takes a couple of minutes.
for (let i = 0; i < 60 && !op.done; i++) {
  await new Promise((r) => setTimeout(r, 10_000));
  const res = await fetch(`${API}/${op.name}`, { headers: { "x-goog-api-key": KEY } });
  op = await res.json();
  process.stdout.write(op.done ? "\n" : ".");
}
if (!op.done) { console.error("timed out"); process.exit(1); }
if (op.error) { console.error("failed", JSON.stringify(op.error).slice(0, 600)); process.exit(1); }

const vid = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video
  ?? op.response?.generatedVideos?.[0]?.video;
if (!vid) { console.error("no video in response", JSON.stringify(op.response).slice(0, 800)); process.exit(1); }

// Videos are deleted server-side after two days — download immediately.
const file = await fetch(vid.uri.includes("key=") ? vid.uri : `${vid.uri}&key=${KEY}`, {
  headers: { "x-goog-api-key": KEY },
});
if (!file.ok) { console.error("download failed", file.status); process.exit(1); }
writeFileSync(outPath, Buffer.from(await file.arrayBuffer()));
console.log("wrote", outPath);
