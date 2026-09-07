#!/usr/bin/env node
/**
 * Triage the machine-authored question bank: have a model solve each question
 * blind and flag the ones where it disagrees with the stored answer.
 *
 *   node --env-file=.env.local scripts/check-questions.mjs --limit 20   # 20 more
 *   node --env-file=.env.local scripts/check-questions.mjs              # until quota runs out
 *   node scripts/check-questions.mjs --refresh                          # re-pull from Convex
 *
 * Writes docs/question-review.md. Touches no Convex writes at all.
 *
 * ## It resumes
 *
 * Every verdict is checkpointed to assets-src/question-verdicts.json after each
 * batch, keyed by question id. The free tier runs out of quota long before the
 * bank runs out of questions, so a run ends in a 429 by design — the next run
 * picks up at the first unchecked question instead of re-spending the quota on
 * the same first thirty. The report is rebuilt from the whole checkpoint, not
 * just this run. Delete that file to re-check everything from scratch.
 *
 * ## This flags suspects. It does not clear questions.
 *
 * 1,295 of these were written by a model. Asking another model whether they are
 * right produces a *shortlist for a human*, not a verdict — the same blind spot
 * can sit on both sides. `docs/pilot-plan.md` §2 is explicit that correctness
 * review is a human job; this exists to point that human at the fifty questions
 * worth their afternoon instead of all 1,295.
 *
 * ## The letter goes last, and that is not cosmetic
 *
 * The first version of this format was `<n>|<letter>|<confidence>|<why>`, which
 * makes the model commit to an answer before it has done any arithmetic. The
 * first full run flagged 82 questions; five sampled by hand were all false
 * positives, and in three of them the model's own `why` field worked the problem
 * correctly, concluded the stored answer was right, and the letter field beside
 * it said something else. It had answered from pattern-match and then reasoned
 * its way to the truth with nowhere to put it.
 *
 * So the reasoning field comes first and the letter is last, with the prompt
 * saying so explicitly. Same tokens, same cost — the ordering is the whole fix.
 *
 * ## It is not shown the answer
 *
 * The obvious version hands the model the question and its stored `correctIndex`
 * and asks "is this right?". That invites agreement — models are strongly
 * disposed to ratify an answer presented as already decided. So the prompt gets
 * the stem and the choices only, the model commits to a letter, and the
 * comparison happens here in the script where it cannot be talked out of it.
 *
 * ## Why this does not repeat the August incident
 *
 * docs/convex-budget.md: Database I/O is bytes read and written by function
 * executions, and the multiplier that caused the 4.38 GB month was *reactive
 * subscriptions* re-running on every write. A script is neither. This is one
 * execution per topic, five topics, once — and the result is cached on disk, so
 * re-running the checks after a prompt change costs Convex nothing at all.
 * Nothing is written back: the report is a local file.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? null : process.argv[i + 1] ?? true;
};
const LIMIT = arg("--limit") ? Number(arg("--limit")) : Infinity;
const RECHECK = typeof arg("--recheck") === "string" ? arg("--recheck") : null;

/**
 * .env.local beats the ambient environment on purpose. This machine exports a
 * stale GEMINI_API_KEY, and `node --env-file` will not override a variable that
 * is already set — so the dead key won and every batch came back 400 with an
 * error that reads as if the file were at fault. Reading the file here makes the
 * invocation work from any shell, with or without --env-file.
 */
const fileKey = () => {
  try {
    const m = readFileSync(".env.local", "utf8").match(/^GEMINI_API_KEY\s*=\s*(.*)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") || null : null;
  } catch { return null; }
};
const KEY = fileKey() ?? process.env.GEMINI_API_KEY;
// A pinned model, not a `-latest` alias: the alias routes to a shared pool that
// returned 503 "high demand" on most calls, and a batch lost to that is
// questions that silently never got checked.
const MODEL = RECHECK ?? process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";
const API = "https://generativelanguage.googleapis.com/v1beta";
const CACHE = "assets-src/question-cache.json";
const BASE_VERDICTS = "assets-src/question-verdicts.json";
// --recheck <model>: a second, blind opinion from a stronger model on the
// questions the main pass flagged. Its own checkpoint and its own report, so
// neither pass can overwrite the other and the two stay comparable.
const VERDICTS = RECHECK ? "assets-src/question-verdicts." + RECHECK + ".json" : BASE_VERDICTS;
const REPORT = RECHECK ? "docs/question-review-recheck.md" : "docs/question-review.md";
const LETTERS = "ABCDEFGH";
/** §2: review what students actually meet first — the bands the engine starts in. */
const BANDS = [1, 2, 3];
/** Questions per model call. Bigger batches cost fewer calls; too big and it loses track. */
const BATCH = 8;

/* ── pull once, then live off the cache ──────────────────────────────── */

/**
 * Call the Convex CLI directly rather than through `npx`. On Windows `npx`
 * needs `shell: true`, and cmd then strips the quotes out of the JSON argument
 * before Convex ever sees it — `{"topicId":"x"}` arrives as `{topicId:x}` and
 * fails to parse. Running the CLI's own entry point with node takes no shell.
 */
const CONVEX_CLI = "node_modules/convex/bin/main.js";
const runConvex = (fn, args = {}) => {
  const out = execFileSync(process.execPath, [CONVEX_CLI, "run", fn, JSON.stringify(args)], {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  const start = out.search(/[[{]/);
  if (start < 0) throw new Error(`no JSON from ${fn}: ${out.slice(0, 200)}`);
  return JSON.parse(out.slice(start));
};

function pull() {
  const topics = runConvex("topics:list");
  const rows = [];
  for (const t of topics) {
    // getByTopic already exists and returns the topic's questions — no new
    // Convex function to write, review and deploy just to read.
    const qs = runConvex("questions:getByTopic", { topicId: t._id });
    for (const q of qs) {
      // Hand-seeded rows have no `generatedAt`; those were written by a person
      // and are not what this is for.
      if (q.generatedAt === undefined) continue;
      if (!BANDS.includes(q.difficulty)) continue;
      rows.push({
        _id: q._id, topic: t.nameHe, difficulty: q.difficulty,
        stem: q.stem, choices: q.choices, correctIndex: q.correctIndex,
      });
    }
    console.log(`  ${t.nameHe.padEnd(24)} ${qs.length} total, ${rows.filter((r) => r.topic === t.nameHe).length} in band ${BANDS.join("/")}`);
  }
  mkdirSync("assets-src", { recursive: true });
  writeFileSync(CACHE, JSON.stringify(rows, null, 2));
  console.log(`\ncached ${rows.length} questions to ${CACHE} (${(readFileSync(CACHE).length / 1024).toFixed(0)}KB read once)\n`);
  return rows;
}

const cached = existsSync(CACHE) && !arg("--refresh");
if (!cached) console.log("pulling from Convex (once):");
const all = cached ? JSON.parse(readFileSync(CACHE, "utf8")) : pull();
if (cached) console.log(`using ${CACHE} — ${all.length} questions, zero Convex reads. --refresh to re-pull.\n`);

/** Verdicts from previous runs, by question id. Missing = not checked yet. */
const done = existsSync(VERDICTS) ? JSON.parse(readFileSync(VERDICTS, "utf8")) : {};
/** A recheck only sees what the main pass flagged; the agreed ones it never looks at. */
const base = RECHECK && existsSync(BASE_VERDICTS) ? JSON.parse(readFileSync(BASE_VERDICTS, "utf8")) : null;
const wasFlagged = (q) => {
  const v = base[q._id];
  return v && !(v.letter === LETTERS[q.correctIndex] && v.confidence === "high");
};
const pending = all.filter((q) => !done[q._id] && (!base || wasFlagged(q)));
// --limit applies to what is *left*, not to the front of the bank: after a
// quota-capped run, `--limit 20` has to mean twenty more, not the same twenty.
const questions = pending.slice(0, LIMIT === Infinity ? pending.length : LIMIT);
if (Object.keys(done).length) {
  console.log(`resuming: ${Object.keys(done).length} already checked, ${pending.length} left — this run takes ${questions.length}.\n`);
}
if (!KEY && questions.length) {
  console.error("GEMINI_API_KEY not set — run with --env-file=.env.local");
  console.error(`(the cache is built either way: ${questions.length} questions ready)`);
  process.exit(1);
}

/* ── ask, blind ──────────────────────────────────────────────────────── */

async function solve(batch) {
  const body = batch.map((q, i) =>
    `### שאלה ${i + 1}\n${q.stem}\n` +
    q.choices.map((c, k) => `${LETTERS[k]}. ${c}`).join("\n"),
  ).join("\n\n");

  const prompt =
`אתה בודק מאגר שאלות במתמטיקה לבגרות 5 יחידות. פתור כל שאלה בעצמך.

לכל שאלה החזר שורה אחת בפורמט:
<מספר שאלה>|<החישוב המלא, כולל התוצאה המספרית>|<ביטחון: high או low>|<אות התשובה>

האות היא השדה האחרון — כתוב אותה רק אחרי שסיימת את החישוב, ורק אם היא תואמת לתוצאה שקיבלת.

אם השאלה שגויה, דו-משמעית, חסרת נתונים, או שאף אפשרות אינה נכונה — החזר X כאות והסבר מה בדיוק לא תקין.
אל תחזיר שום דבר מלבד השורות האלה.

${body}`;

  // 503 "high demand" and 429 are both transient and both common on the free
  // tier. Backing off beats losing a batch — a dropped batch is questions that
  // silently never got checked, which is the failure this script exists to stop.
  let res, wait = 4000;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(`${API}/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      }),
    });
    if (res.ok || (res.status !== 503 && res.status !== 429)) break;
    await new Promise((r) => setTimeout(r, wait));
    wait *= 2;
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status} ${t.replace(KEY, "<KEY>").slice(0, 300)}`);
  }
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
  const verdicts = new Map();
  for (const line of text.split("\n")) {
    // It labels its lines "שאלה 3|…" rather than starting with the number, so
    // the prefix is optional here. Anchored at both ends: the reasoning field is
    // non-greedy and full of `|` from absolute values, so only the anchored tail
    // tells us where it stops.
    const m = line.match(/^\s*(?:שאלה\s*)?(\d+)\s*\|\s*(.*?)\s*\|\s*(high|low)\s*\|\s*([A-HX])\s*$/i);
    if (m) verdicts.set(Number(m[1]), { why: m[2].trim(), confidence: m[3].toLowerCase(), letter: m[4].toUpperCase() });
  }
  // A batch that parses to nothing means the model changed shape on us, and
  // silently counting eight questions as "unparsed" hides that.
  if (verdicts.size === 0 && text.trim()) {
    console.error(`
  unparseable reply: ${JSON.stringify(text.slice(0, 160))}`);
  }
  return verdicts;
}

/* ── run ─────────────────────────────────────────────────────────────── */

let unparsed = 0;

for (let i = 0; i < questions.length; i += BATCH) {
  const batch = questions.slice(i, i + BATCH);
  let verdicts;
  try {
    verdicts = await solve(batch);
  } catch (e) {
    console.error(`batch ${i / BATCH + 1} failed: ${e.message}`);
    if (String(e.message).startsWith("429")) {
      console.error("rate limited — stopping here; the next run resumes from this point.");
      break;
    }
    continue;
  }
  batch.forEach((q, k) => {
    const v = verdicts.get(k + 1);
    // Deliberately not checkpointed: an unparsed question stays pending so the
    // next run retries it, rather than being recorded as permanently unreadable.
    if (!v) { unparsed++; return; }
    // Which model said so: the bank gets checked across several models as each
    // one's daily quota runs out, and a flag is only as good as its solver.
    done[q._id] = { ...v, by: MODEL };
  });
  // After every batch, not at the end — the run ends in a 429 by design.
  writeFileSync(VERDICTS, JSON.stringify(done, null, 2));
  process.stdout.write(`\rchecked ${Math.min(i + BATCH, questions.length)}/${questions.length} this run · ${Object.keys(done).length}/${all.length} of the bank`);
}
console.log();

/* ── report ──────────────────────────────────────────────────────────── */

// Rebuilt from the whole checkpoint, so the report is every question ever
// checked — not just the handful this run's quota allowed.
const flagged = [];
const solvers = new Set();
let agreed = 0;
for (const q of all) {
  const v = done[q._id];
  if (!v) continue;
  solvers.add(v.by ?? "unrecorded");
  const stored = LETTERS[q.correctIndex];
  if (v.letter === stored && v.confidence === "high") { agreed++; continue; }
  flagged.push({ ...q, stored, model: v.letter, confidence: v.confidence, why: v.why });
}
const checked = agreed + flagged.length;
// Counted against whatever this run was scoped to: the whole band, or just the
// questions a --recheck was handed.
const remaining = all.filter((q) => !done[q._id] && (!base || wasFlagged(q))).length;
const scopeTotal = checked + remaining;
const solverList = [...solvers].map((m) => "`" + m + "`").join(" + ");

const pct = (n) => ((100 * n) / Math.max(checked, 1)).toFixed(1);
const lines = [
  `# Question review — model triage`,
  ``,
  `${new Date().toISOString().slice(0, 10)} · ${solverList} · difficulty ${BANDS.join("/")} · machine-authored only`,
  ``,
  `| | |`,
  `|---|---|`,
  `| checked | ${checked} of ${scopeTotal}${RECHECK ? " flagged by the main pass" : " in band"} |`,
  `| model agreed, high confidence | ${agreed} (${pct(agreed)}%) |`,
  `| **flagged for a human** | **${flagged.length} (${pct(flagged.length)}%)** |`,
  `| no parseable verdict this run (retried next run) | ${unparsed} |`,
  ``,
  `A flag is a *suspect*, not a verdict. The bank was machine-authored and this is`,
  `another model reading it, so the same blind spot can sit on both sides. Read the`,
  `question before changing anything.`,
  ``,
];
const byKind = [
  ["Model says no option is correct", flagged.filter((f) => f.model === "X")],
  ["Model picked a different answer", flagged.filter((f) => f.model !== "X" && f.model !== f.stored)],
  ["Model agreed but was unsure", flagged.filter((f) => f.model === f.stored)],
];
for (const [title, group] of byKind) {
  if (!group.length) continue;
  lines.push(`## ${title} — ${group.length}`, ``);
  for (const f of group) {
    lines.push(
      `### \`${f._id}\` · ${f.topic} · difficulty ${f.difficulty}`, ``,
      f.stem, ``,
      ...f.choices.map((c, k) => `- ${LETTERS[k]}. ${c}${LETTERS[k] === f.stored ? "  ← stored answer" : ""}${LETTERS[k] === f.model ? "  ← model" : ""}`),
      ``, `> ${f.why}`, ``,
    );
  }
}
mkdirSync("docs", { recursive: true });
writeFileSync(REPORT, lines.join("\n") + "\n");
console.log(`\n${agreed}/${checked} agreed · ${flagged.length} flagged · ${unparsed} unparsed this run`);
console.log(`report: ${REPORT}`);
console.log(remaining
  ? `${remaining} left — re-run to continue (checkpoint: ${VERDICTS})`
  : RECHECK ? `every flagged question re-checked.` : `whole band checked.`);
