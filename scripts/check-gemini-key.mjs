#!/usr/bin/env node
/**
 * Is GEMINI_API_KEY usable? Answers without spending a generation.
 *
 *   node --env-file=.env.local scripts/check-gemini-key.mjs
 *
 * A file rather than a `node -e` one-liner on purpose: the inline form has to
 * survive the shell's quoting, and PowerShell strips the inner double quotes,
 * so the same command that works in bash is a syntax error there.
 *
 * Prints the key masked the way AI Studio masks it. `node --env-file` does NOT
 * override a variable that is already set, so a stale machine-level
 * GEMINI_API_KEY silently shadows the one in .env.local — compare these four
 * characters against the dashboard before believing any other diagnosis.
 */
const KEY = process.env.GEMINI_API_KEY;

if (!KEY) {
  console.error("GEMINI_API_KEY is not set.");
  console.error("Add it to .env.local and run with --env-file=.env.local");
  process.exit(1);
}

console.log(`key      ${KEY.slice(0, 6)}…${KEY.slice(-4)}  (${KEY.length} chars)`);

// No format assertion: Google issues at least two key shapes, the long-standing
// "AIza…" and a newer "AQ.…", and a regex written against one silently rejects
// the other. Only the API knows what it accepts.

const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
  headers: { "x-goog-api-key": KEY },
});

if (res.ok) {
  const { models = [] } = await res.json();
  const image = models.filter((m) => /image/.test(m.name)).map((m) => m.name.replace("models/", ""));
  console.log(`status   key works — ${models.length} models visible`);
  if (image.length) console.log(`image    ${image.join(", ")}`);
  process.exit(0);
}

const text = await res.text();
console.error(`status   rejected (${res.status})`);
console.error(text.replace(KEY, "<KEY>").slice(0, 400));
if (text.includes("API_KEY_INVALID")) {
  console.error(`
Google is refusing this key. In order:
  1. Does the masked key above match your AI Studio dashboard? If not, a stale
     GEMINI_API_KEY in your machine environment is shadowing .env.local:
       [Environment]::SetEnvironmentVariable('GEMINI_API_KEY', $null, 'User')
       Remove-Item Env:GEMINI_API_KEY
  2. Brand new key? Wait a minute for it to propagate.
  3. Key restrictions excluding "Generative Language API"?
  4. Is that API enabled on the project? An AI Studio key enables it; a key made
     in Cloud Console does not.`);
}
process.exit(1);
