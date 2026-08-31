#!/usr/bin/env node
/**
 * Screenshot the real Faraday25D on the running dev server, at several tilt
 * angles, beside the flat art. Depth you cannot see is depth you cannot tune.
 *
 *   node scripts/preview-parallax.mjs <outDir> [port]
 *
 * Writes parallax.png (tilt strip), poses.png (every pose) and parallax.gif —
 * the moving one. Stills cannot show parallax; the GIF is the only honest look
 * at it, and it is captured by orbiting a REAL cursor over the element so the
 * component's own pointer handler is what moves him.
 *
 * Drives the actual component rather than a copy of it, so what is measured is
 * what ships. Dev-machine tool; needs `npm run dev` up.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2];
const PORT = process.argv[3] || "5176";
if (!OUT) { console.error("usage: preview-parallax.mjs <outDir> [port]"); process.exit(1); }

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`http://localhost:${PORT}/`);
await page.evaluate(() => localStorage.setItem("faraday_prototype_auth", "true"));
await page.goto(`http://localhost:${PORT}/mascot`);
await page.waitForSelector(".faraday-25d", { timeout: 15000 });
await page.waitForTimeout(700);

// Freeze the idle sway so the only variable is the tilt being measured.
await page.addStyleTag({ content: ".faraday-25d-sway{animation:none !important}.faraday-25d-stage{transition:none !important}" });

const box = page.locator(".faraday-25d").first();
const shots = [];
for (const [rx, ry] of [[0, 0], [0, -14], [0, 14], [10, 10]]) {
  await page.evaluate(([rx, ry]) => {
    const s = document.querySelector(".faraday-25d-stage");
    s.style.setProperty("--f25-rx", rx + "deg");
    s.style.setProperty("--f25-ry", ry + "deg");
  }, [rx, ry]);
  await page.waitForTimeout(120);
  shots.push("data:image/png;base64," + (await box.screenshot()).toString("base64"));
}

const strip = await page.evaluate(async ({ imgs, ref }) => {
  const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  const ims = await Promise.all(imgs.map(load));
  const r = await load(ref);
  const S = 230, cv = document.createElement("canvas");
  cv.width = S * (ims.length + 1); cv.height = S + 26;
  const cx = cv.getContext("2d");
  cx.fillStyle = "#F3F6F2"; cx.fillRect(0, 0, cv.width, cv.height);
  cx.drawImage(r, 0, 0, S, S);
  ims.forEach((im, i) => cx.drawImage(im, S * (i + 1), 0, S, S));
  cx.fillStyle = "#14201A"; cx.font = "bold 14px system-ui";
  ["FLAT ART", "at rest", "tilt −14°", "tilt +14°", "tilt x+y"].forEach((t, i) => cx.fillText(t, S * i + 10, S + 18));
  return cv.toDataURL("image/png").split(",")[1];
}, { imgs: shots, ref: "data:image/png;base64," + readFileSync("public/faraday-idle.png").toString("base64") });

writeFileSync(join(OUT, "parallax.png"), Buffer.from(strip, "base64"));

// Second strip: every supported pose at rest, to confirm one set of masks fits
// them all — they are separately tight-cropped out of the sheet, so they can
// drift apart.
await page.evaluate(() => {
  const s = document.querySelector(".faraday-25d-stage");
  s.style.setProperty("--f25-rx", "6deg");
  s.style.setProperty("--f25-ry", "-12deg");
});
const poses = [];
const labels = [];
for (const name of ["idle", "thinking", "happy", "wrong", "streak"]) {
  // Scope to the 2.5D section: the reactions row further down the page also
  // has buttons called "wrong" and "streak", and .last() picks those.
  const btn = page.locator(`section:has(.faraday-25d) button:text-is("${name}")`).first();
  await btn.click();
  await page.waitForTimeout(260);
  poses.push("data:image/png;base64," + (await box.screenshot()).toString("base64"));
  labels.push(name);
}
const strip2 = await page.evaluate(async ({ imgs, labels }) => {
  const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  const ims = await Promise.all(imgs.map(load));
  const S = 230, cv = document.createElement("canvas");
  cv.width = S * ims.length; cv.height = S + 26;
  const cx = cv.getContext("2d");
  cx.fillStyle = "#F3F6F2"; cx.fillRect(0, 0, cv.width, cv.height);
  ims.forEach((im, i) => cx.drawImage(im, S * i, 0, S, S));
  cx.fillStyle = "#14201A"; cx.font = "bold 14px system-ui";
  labels.forEach((t, i) => cx.fillText(t, S * i + 10, S + 18));
  return cv.toDataURL("image/png").split(",")[1];
}, { imgs: poses, labels });
writeFileSync(join(OUT, "poses.png"), Buffer.from(strip2, "base64"));

// ---- the moving one --------------------------------------------------------
// Phase 1: orbit a real cursor over him. Phase 2: leave, and let the idle sway
// take over — both halves of what a student actually sees.
const { mkdirSync, rmSync } = await import("node:fs");
const frames = join(OUT, "frames");
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

// Back to idle: the pose loop above left him on whatever it ended with.
await page.locator('section:has(.faraday-25d) button:text-is("idle")').first().click();
await page.waitForTimeout(300);
await page.evaluate(() => {
  const s = document.querySelector(".faraday-25d-stage");
  s.style.removeProperty("--f25-rx");
  s.style.removeProperty("--f25-ry");
});
const b = await box.boundingBox();
const cx0 = b.x + b.width / 2, cy0 = b.y + b.height / 2;
const rx = b.width * 0.42, ry = b.height * 0.42;

let n = 0;
const shot = async () => {
  await box.screenshot({ path: join(frames, `f-${String(n++).padStart(3, "0")}.png`) });
};

const ORBIT = 44;
for (let i = 0; i < ORBIT; i++) {
  const a = (i / ORBIT) * Math.PI * 2;
  await page.mouse.move(cx0 + Math.cos(a) * rx, cy0 + Math.sin(a) * ry);
  await shot();
}
// Leave the element: the tilt springs back, then the sway runs on its own.
await page.mouse.move(b.x - 80, b.y - 80);
await page.evaluate(() => {
  document.querySelectorAll("style").forEach((s) => {
    if (s.textContent.includes("faraday-25d-sway{animation:none")) s.remove();
  });
});
for (let i = 0; i < 40; i++) { await page.waitForTimeout(70); await shot(); }

await browser.close();

const { execFileSync } = await import("node:child_process");
execFileSync("ffmpeg", [
  "-y", "-v", "error", "-framerate", "20", "-i", join(frames, "f-%03d.png"),
  "-vf", "scale=220:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
  "-loop", "0", join(OUT, "parallax.gif"),
]);
rmSync(frames, { recursive: true, force: true });
console.log(errors.length ? "PAGE ERRORS: " + errors.join(" | ") : `ok — parallax.png + poses.png + parallax.gif (${n} frames)`);
