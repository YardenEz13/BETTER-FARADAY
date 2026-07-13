#!/usr/bin/env node
/**
 * Design-system guardrail. Ratchets two debt metrics against a baseline:
 *   1. Raw hex colors in src .tsx files      → ERROR on growth (use CSS vars)
 *   2. `style={{` inline styles in src/pages → WARN on growth (use ui/ primitives)
 *
 * Counts BELOW baseline auto-tighten the baseline with --update.
 * Run: node scripts/design-lint.mjs [--update]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1");
const BASELINE_PATH = join(ROOT, "scripts", "design-lint-baseline.json");
const UPDATE = process.argv.includes("--update");

// Files where raw hex is legitimate (canvas painting, icon gradient palettes).
const HEX_ALLOWLIST = [
  "src/components/FaradayCanvas.tsx",          // canvas particle colors
  "src/components/PacketCropBuilder.tsx",      // canvas white fill for PDF crops
  "src/components/PdfAssignmentBuilder.tsx",   // canvas white fill for PDF crops
  "src/components/electric/icons.tsx",         // icon gradient palette
  "src/components/electric/ElectricIcons.stories.tsx",
  "src/pages/Onboarding.tsx",                  // avatar color palette
];

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const INLINE_STYLE_RE = /style=\{\{/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const norm = (p) => relative(ROOT, p).split(sep).join("/");

function countMatches(files, re, filter) {
  const counts = {};
  for (const f of files) {
    const rel = norm(f);
    if (filter && !filter(rel)) continue;
    const n = (readFileSync(f, "utf8").match(re) ?? []).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

const tsx = walk(join(ROOT, "src")).filter((f) => f.endsWith(".tsx"));
const hex = countMatches(tsx, HEX_RE, (rel) => !HEX_ALLOWLIST.includes(rel));
const inlineStyles = countMatches(
  tsx.filter((f) => norm(f).startsWith("src/pages/")),
  INLINE_STYLE_RE,
);

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
} catch {
  baseline = null;
}

if (UPDATE || !baseline) {
  writeFileSync(BASELINE_PATH, JSON.stringify({ hex, inlineStyles }, null, 2) + "\n");
  console.log(`design-lint: baseline ${baseline ? "updated" : "created"} at ${norm(BASELINE_PATH)}`);
  process.exit(0);
}

function diff(current, base) {
  const grew = [];
  const shrank = [];
  for (const file of new Set([...Object.keys(current), ...Object.keys(base)])) {
    const now = current[file] ?? 0;
    const was = base[file] ?? 0;
    if (now > was) grew.push({ file, was, now });
    else if (now < was) shrank.push({ file, was, now });
  }
  return { grew, shrank };
}

const hexDiff = diff(hex, baseline.hex);
const styleDiff = diff(inlineStyles, baseline.inlineStyles);
let failed = false;

if (hexDiff.grew.length) {
  failed = true;
  console.error("\n✖ New raw hex colors (use CSS variables from index.css @theme):");
  for (const { file, was, now } of hexDiff.grew) console.error(`   ${file}: ${was} → ${now}`);
}
if (styleDiff.grew.length) {
  console.warn("\n⚠ New inline style={{}} in pages (prefer src/components/ui primitives + tokens):");
  for (const { file, was, now } of styleDiff.grew) console.warn(`   ${file}: ${was} → ${now}`);
}
const improved = [...hexDiff.shrank, ...styleDiff.shrank];
if (improved.length) {
  console.log("\n✔ Debt reduced — run `node scripts/design-lint.mjs --update` to ratchet the baseline:");
  for (const { file, was, now } of improved) console.log(`   ${file}: ${was} → ${now}`);
}

if (failed) process.exit(1);
console.log("design-lint: OK");
