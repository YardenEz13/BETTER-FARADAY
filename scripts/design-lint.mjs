#!/usr/bin/env node
/**
 * Design-system guardrail. Ratchets three debt metrics against a baseline:
 *   1. Raw hex colors in src .tsx files      → ERROR on growth (use CSS vars)
 *   2. `style={{` inline styles in src/pages → WARN on growth (use ui/ primitives)
 *   3. Physical l/r utilities in src .tsx    → ERROR on growth (use logical ones)
 *
 * Counts BELOW baseline auto-tighten the baseline with --update; counts above
 * it are NOT absorbed unless you also pass --relax.
 * Run: node scripts/design-lint.mjs [--update] [--relax]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASELINE_PATH = join(ROOT, "scripts", "design-lint-baseline.json");
const UPDATE = process.argv.includes("--update");
// --update is a RATCHET: it writes the lower of (baseline, current) for every
// file, so re-baselining one metric can never quietly raise the ceiling on
// another. Adding the `physical` metric is what surfaced this — a plain
// --update would have banked five pages of inline-style drift that the tool
// had been warning about. Deliberately accepting a higher count (a legitimately
// physical `left-1/2` centre, say) needs --relax, so it shows up as an
// explicit flag in the diff rather than as a silent side effect.
const RELAX = process.argv.includes("--relax");

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

/* RTL is rule 1 of the design system and was, until this ratchet, the only rule
 * nothing measured — which is how four notification badges came to be pinned
 * with `-right-*` and sat on the wrong corner in an app that is entirely RTL.
 *
 * Matches ml/mr, pl/pr, left/right, border-l/r and rounded-l/r as whole class
 * tokens, with an optional negative prefix and any variant in front
 * (`md:`, `hover:`). `rounded-lg` is safe: the [lr] must be followed by a dash.
 * Some physical values are legitimate — a full-bleed `left-0 right-0`, a
 * `left-1/2` centre — so this is a growth ratchet, not a ban: everything
 * present today is baselined, and only NEW ones fail. If you add a legitimate
 * one, re-baseline with --update and let the diff show the deliberate choice. */
const PHYSICAL_RE =
  /(?<![\w-])-?(?:m[lr]|p[lr]|left|right|border-[lr]|rounded-[lr])-(?![\s"'`])|(?<![\w-])text-(?:left|right)(?![\w-])/g;

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
const physical = countMatches(tsx, PHYSICAL_RE);

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
} catch {
  baseline = null;
}

// Keep each file at the lower of its old and new count. Files absent from the
// current scan are dropped (deleted or renamed); files new to the scan enter at
// their current count, which is how a newly added metric gets its first
// baseline. --relax takes the current count as-is.
function ratchet(current, base = {}) {
  const out = {};
  for (const [file, now] of Object.entries(current)) {
    const was = base[file];
    out[file] = RELAX || was === undefined ? now : Math.min(was, now);
  }
  return out;
}

if (UPDATE || !baseline) {
  const next = baseline
    ? {
        hex: ratchet(hex, baseline.hex),
        inlineStyles: ratchet(inlineStyles, baseline.inlineStyles),
        physical: ratchet(physical, baseline.physical),
      }
    : { hex, inlineStyles, physical };
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
  console.log(
    `design-lint: baseline ${baseline ? "updated" : "created"} at ${norm(BASELINE_PATH)}` +
      (RELAX ? " (--relax: current counts taken as-is)" : ""),
  );
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
// A baseline written before this metric existed has no `physical` key; treat it
// as empty so the first run reports every existing use rather than crashing.
const physicalDiff = diff(physical, baseline.physical ?? {});
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
if (physicalDiff.grew.length) {
  failed = true;
  console.error("\n✖ New physical l/r properties (rule 1: use ms-/me-, ps-/pe-, start-/end-):");
  for (const { file, was, now } of physicalDiff.grew) console.error(`   ${file}: ${was} → ${now}`);
  console.error("   Genuinely physical (full-bleed, centred)? Re-baseline with --update.");
}
const improved = [...hexDiff.shrank, ...styleDiff.shrank, ...physicalDiff.shrank];
if (improved.length) {
  console.log("\n✔ Debt reduced — run `node scripts/design-lint.mjs --update` to ratchet the baseline:");
  for (const { file, was, now } of improved) console.log(`   ${file}: ${was} → ${now}`);
}

if (failed) process.exit(1);
console.log("design-lint: OK");
