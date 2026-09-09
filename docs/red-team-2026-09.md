# Red-team audit — September 2026

Adversarial sweep of the whole app by parallel agents, one per attack surface, plus
hand verification of every finding quoted below. Scope: Convex backend, the Gemini
proxy, the student-facing React flow, the packet/PDF ingest pipeline, the adaptive
and grading engines, and the design/RTL guardrails.

> **Status update — PR #6 landed after this audit was written.** It fixes two of the
> four criticals: `homework.submitAnswer` now derives `isCorrect` server-side, and
> `exams.ts`'s string comparison is replaced by `convex/answerMatch.ts`, which compares
> by evaluating at sample points. Both are struck through below. Everything else was
> re-verified against `green-torch` at `48d34ec` and still stands. Line numbers below
> are as of that commit.

**The suite does not catch any of this.** Baseline at the time of the audit (pre-#6):
`npm test` 297/297 green, `tsc -b` 0 errors, `npm run lint` 0 errors (107 warnings),
`design-lint` gate green. The only build failure is environmental — `VITE_CONVEX_URL`
unset, no `.env.local`.

## Summary

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| 1 | CRITICAL | Gemini proxy forwards the client's prompt verbatim — open relay, `CORS: *` | `convex/http.ts:129,195` |
| 2 | CRITICAL | `submitAttempt` trusts client-supplied `isCorrect` | `convex/attempts.ts:13` |
| 3 | ~~CRITICAL~~ | ~~`homework.submitAnswer` trusts client-supplied `isCorrect`~~ — **fixed in #6** | `convex/homework.ts:504` |
| 4 | ~~CRITICAL~~ | ~~Exam auto-grader marks correct answers wrong (4 paths)~~ — **fixed in #6** | `convex/exams.ts:19` |
| 5 | HIGH | Public unauthenticated file-upload URL, no size cap, blobs never deleted | `convex/packetImport.ts:20`, `pdfAssignments.ts:109` |
| 6 | HIGH | Only access gate is a hardcoded credential in the JS bundle | `src/components/PrototypeGate.tsx:23` |
| 7 | HIGH | Unauthenticated full-classroom student PII export | `convex/classroom.ts` |
| 8 | HIGH | Per-student AI rate limit keyed on client-supplied `studentId` | `convex/http.ts:117,177` |
| 9 | HIGH | Chat history round-trips into live prompts unvalidated (persistent jailbreak) | `convex/aiChat.ts:28-68` |
| 10 | HIGH | `startExam` with `NaN` count serves the entire bank as one exam | `convex/exams.ts:60` |
| 11 | HIGH | Duplicate section labels collide answers and cross-grade sections | `CompoundQuestionRenderer.tsx:92-109` |
| 12 | HIGH | `dependsOn` on a nonexistent label locks a section permanently | `CompoundQuestionRenderer.tsx:118` |
| 13 | HIGH | `packetValidators` is shape-only — garbage publishes to students | `convex/packetValidators.ts`, `packetPublish.ts:11` |
| 14 | HIGH | Canvas size taken from untrusted PDF MediaBox, never capped | `PacketCropBuilder.tsx:96`, `PdfAssignmentBuilder.tsx:85` |
| 15 | HIGH | `design-lint` walks `.tsx` only — 106 raw hex in `.ts` invisible | `scripts/design-lint.mjs:53` |
| 16 | HIGH | Cross-classroom hint-request starvation in the Command Center | `convex/commandCenter.ts:197` |

Plus MEDIUM/LOW items in §Lower severity.

---

## 1. CRITICAL — the Gemini proxy is an open relay

`convex/http.ts:125-131` and `:189-196`:

```js
body: JSON.stringify(body.payload ?? {}),
```

The client's `payload` reaches Google verbatim. `systemInstruction`, `safetySettings`,
`generationConfig` and `contents` are all caller-controlled. `Access-Control-Allow-Origin: "*"`
(`http.ts:20`), no auth, no origin check.

Any web page can POST to `/gemini-stream` or `/gemini-generate` and receive free,
fully-jailbroken Gemini billed to the project's key. The persona, the Hebrew-only
constraint and every safety setting are client-side conventions, not server policy.

The only backstop is `globalDaily: 6000` (`aiGate.ts:32`) and `globalBurst: 60/min`.
Burning that budget is the second attack: it takes minutes, costs the attacker nothing,
and every real student then gets the "resting" message for the rest of the day.

**Fix:** build the payload server-side. Accept only `{ studentId, task, userText, imageId }`
from the client, and let the proxy own `systemInstruction`, `safetySettings` and
`generationConfig`. Restrict CORS to the deployed origins.

## 2-3. CRITICAL — the client grades itself

`convex/attempts.ts:13` takes `isCorrect: v.boolean()` and never re-derives it, even
though `choiceIndex` is passed in and `questions.correctIndex` sits in the same
transaction. `convex/homework.ts` has the same shape for `submitAnswer` /
`finalizeSubmission`.

The codebase already knows the right pattern — `convex/live.ts:57`:

```ts
const isCorrect = choiceIndex === question.correctIndex;
```

`attempts.ts` just skips it. A loop of `{"isCorrect":true,"difficulty":5}` mints 30 XP
per call (60 with an active boost), ratchets difficulty, touches the streak, and fires
the daily-goal bonus — enough to buy out the shop, own the leaderboard, and poison
`studentPowerMap`, which `levels.ts` and `homework.ts` then use to target real content.
No rate limit on the mutation either.

**Fix:** `const q = await ctx.db.get(args.questionId); const isCorrect = args.choiceIndex === q?.correctIndex;`
and use that everywhere below. Drop `isCorrect` from the args entirely.

## 4. ~~CRITICAL~~ — the exam grader marks correct answers wrong — **fixed in #6**

Kept for the record; `exams.ts:19` now delegates to `convex/answerMatch.ts`, which
canonicalises LaTeX/Unicode/ASCII and compares by evaluating at sample points. The
original defect was in `normalizeAnswer`:

```js
.replace(/[,;]/g, ",")
```

That replaces a comma **with a comma**. The intent was decimal-comma → period, so a
student typing `0,5` on a Hebrew keyboard never matches a stored `0.5` — and the numeric
fallback also rejects it, because its guard (`a.replace(/[0-9.-]/g,"") === ""`) still sees
the comma. Four false-negative paths, all verified by execution:

- Hebrew decimal comma: `0,5` vs `0.5`
- Unicode minus U+2212 (`−5`) vs ASCII `-5` — also fails the numeric guard
- `\frac{1}{2}` vs `1/2` — brace-stripping leaves `\frac12`
- Invisible RTL/LRM marks pasted from a mobile keyboard

Line 46's "loose containment" comment sits above `return c.length > 0 && (c === a);`,
which line 39 already returned on. Dead code — the fallback the comment promises does
not exist. `convex/exams.ts` has **zero test coverage**.

**Fix:** normalize decimal comma to `.`, map U+2212/U+2013 to `-`, strip
`‎‏‪-‮`, expand `\frac{a}{b}` → `a/b`, then compare.

## 5. HIGH — anyone can fill the file storage, and nothing ever empties it

`convex/packetImport.ts:20` is a public mutation with `args: {}`:

```ts
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});
```

No auth, no owner, no size argument. The 20MB limit is client-side only. `pdfAssignments.ts:109`
is identical. `grep -rn "storage.delete" convex/` returns two hits, both for assignments —
nothing ever deletes a packet blob, and `packetImportQuestions` rows have no delete path on
cancel, fail, discard or approve. Free file hosting on the project's bill, growing forever.

**Fix:** require a teacher identity, enforce a server-side byte cap, and delete the blob
plus its rows on every terminal path.

## 6. HIGH — the login screen protects nothing

`src/components/PrototypeGate.tsx:23`:

```js
if (username === "BDIKA" && password === "123456") {
  localStorage.setItem("faraday_prototype_auth", "true");
```

`src/main.tsx:52` wraps the whole tree in it. Three problems: the credentials are string
literals in the published bundle (`grep BDIKA` on the deployed JS); the check is client-side,
so `localStorage.setItem("faraday_prototype_auth","true")` skips it; and it gates rendering
only — the Convex client is built regardless and every backend function takes a
client-supplied `studentId` with no auth. The preview URL is public.

**Fix:** this is not fixable in the client. Use Vercel Deployment Protection, or accept the
deploy is public — but stop counting the gate as security, and get the credential out of the
bundle.

## 7-10, 11-16

Backend authorization (7), AI quota bypass (8), chat-history injection (9), exam sizing (10),
compound-question rendering (11-12), packet publishing (13-14), design guardrails (15) and
Command Center scoping (16) are detailed in the per-area sections below.

### 7. Unauthenticated classroom PII export
`getFirstClassroom` + `getByClassroom` return the full student roster to any caller. Given
no auth this is by design for students, but it exports the whole roster in one call rather
than one student's own record.

### 8. AI rate limits reset by rotating an id
`http.ts:117,177` key `studentChat` / `studentVision` on `body.studentId || "anonymous"`.
Rotate the string, get a fresh 20/hr bucket. Only the global caps survive.

### 9. Forged conversation history primes every later call
`convex/aiChat.ts:28,49` — `addMessage` and `syncMessages` take `role: v.string()` with no
enum and, more importantly, no ownership check on `chatId`. Any client can write into any
chat. History is replayed into later prompts, so one forged `"model"` turn is a persistent
self-jailbreak; forged `"מורה"` turns also corrupt teacher-facing sentiment analytics.
`syncMessages` takes an unbounded array.

*(Not a bug: `messageCount` read-modify-write is safe — Convex mutations are single
transactions with OCC retry. The same false race was checked and ruled out in
`aiUsage.record` and `live.ts`.)*

### 10. `NaN` exam size
`convex/exams.ts:60`: `Math.max(2, Math.min(3, Math.round(questionCount)))` is `NaN` when
`questionCount` is `NaN` (a valid float64 over Convex's wire format). Every
`picked.length >= count` break is then false, so the loop pushes the whole pool — up to 200
compound questions in one exam.

### 11-12. Compound-question rendering
`CompoundQuestionRenderer.tsx:92-109` keys `answers`, `submitted`, `results` and
`attemptCounts` by `sectionLabel`. Two sections sharing a label share one slot — one
student's answer is graded against the other section. `:118` gates on
`dependsOn.every(dep => submitted[dep])`, so a `dependsOn` naming a label that does not
exist (or itself) is `undefined` forever and locks the section with no escape. Nothing
validates label uniqueness or `dependsOn` targets at publish time.

### 13. Publish validates shape, not content
`convex/packetPublish.ts:11` checks only that a draft, a topicId and a non-discarded status
exist. Verified to publish cleanly: an empty answer, a zero-section compound question, and a
multiple-choice question with `choices: []` (unanswerable on screen). Worse, `:31` does
`correctIndex: d.correctIndex ?? 0` — a draft with no `correctIndex` publishes with **the
first option silently declared correct**, and nothing checks `correctIndex < choices.length`.

### 14. Untrusted PDF geometry drives canvas allocation
`PacketCropBuilder.tsx:96` / `PdfAssignmentBuilder.tsx:85` floor the scale with
`Math.max(1, …)` but never bound it above, and the viewport comes from the PDF's own
MediaBox. A declared-huge page allocates a huge canvas in the student's phone browser. No
page-count cap either (`:134` / `:124`), so a 500-page PDF renders every page.

### 15. The design guardrail is half-blind
`scripts/design-lint.mjs:53` walks `.tsx` only. The baseline tracks 2 hex occurrences; the
`.ts` files it never opens hold 106 — `faraday/avatarVariants.ts` (72), `lib/rewardTier.ts`
(16, whose `TIER_STYLE` is imported and rendered by `StudentHome.tsx:31`), `lib/logger.ts` (8),
and four more. Moving a hardcoded color from a `.tsx` into a sibling `.ts` makes the linter
*report an improvement*. The regex also misses `rgba()`/`hsl()` (25 more inside `.tsx`), and
the inline-style metric covers `src/pages/` only, leaving 155 `style={{` in `src/components/`
unmeasured. The baseline still banks 39 credits for four deleted files.

**Fix:** `filter(f => f.endsWith(".tsx") || f.endsWith(".ts"))`, widen the regex to
`rgba?\(|hsla?\(`, extend the inline-style walk to `src/components/`, then `--update`.

### 16. Command Center starvation
`convex/commandCenter.ts:197` reads a global top-40 of `hintRequests` with no classroom
scope. Once more than one classroom shares the deployment, a busy class buries every other
teacher's "asked for help" alerts.

---

## Lower severity

- **MEDIUM** `getQuestionFailureRates` can exceed Convex's per-query document-read limit as
  the question bank grows (`convex/questions.ts`).
- **MEDIUM** Fixed `take(300)` / `take(200)` recent-attempt windows truncate the
  previous-week comparison for active students, biasing the trend toward zero
  (`digest.ts`, `commandCenter.ts`).
- **MEDIUM** No server-side cap on payload or image size for `/gemini-generate` vision calls.
- **MEDIUM** Prompt injection into `gradeProofSection` — raw `studentClaim` / `studentReason`
  are concatenated into the grading prompt with no delimiter, and can force `stepScore: 1`
  (`convex/proofGrading.ts:131-153`).
- **MEDIUM** Proof-step `expectedClaim` / `expectedReason` content is never validated at
  publish, only its presence.
- **MEDIUM** A single top-level `AppErrorBoundary` (`App.tsx:40`) white-screens the whole app
  on any render crash, and its soft retry re-crashes on persistent bad data.
- **LOW-MEDIUM** `liveSessions` status is filtered post-index, so the common "no active
  session" check scans a classroom's full history (`convex/live.ts`).
- **LOW** `questionReports.report` does an unbounded `.collect()` over `by_question`.
- **LOW** `notifications.markRead` takes an unbounded `keys` array.
- **LOW** 47 physical direction classes (`text-right`, `left-N`, `mr-auto`) against the
  logical-properties rule. Verified mostly correct-by-accident in RTL; the real inconsistency
  is `NotificationCenter.tsx:214` pinning its badge `-right-1` where sibling overlays use
  `left-*`.
- **npm audit** 2 HIGH in prod deps: `nanoid` <3.3.18 (zero-size DoS loop) and `vite` <=6.4.2
  (path traversal / `fs.deny` bypass).

## Checked and clean

- **No CDN assets.** Zero external font/script/style references in `src/`, `index.html` or CSS.
  The pdf.js worker is bundled locally, so PDFs still load on a filtered school network.
- **QR bridge.** `crypto.randomUUID` token, TTL, expiry checks on every path, sweep cron
  (`convex/bridge.ts`).
- **Timezone handling.** `goals.ts` and `leaderboard.ts` use `Intl`-based Israel-time helpers
  correctly; no UTC streak-boundary bug.
- **Level thresholds, `homework.ts` scoring, `achievements.ts`, `rewardTier.ts`, `dates.ts`** —
  boundary math checked by execution, no off-by-one found.
- **Convex transaction races.** Read-modify-write inside a single mutation is safe; the naive
  lost-update findings were ruled out rather than reported.
- **Crop rectangles.** Already clamped and normalized client-side, never sent raw.
- **Suppression debt.** Zero `@ts-ignore`, `TODO`, `FIXME`, `.only(` or `.skip(` in the tree.

---

## Fuzzing the pure logic

Every item here was reproduced by executing the real module, not by reading it —
vitest run from the repo root against a scratch config, so imports resolved normally.
No repo file was modified.

### HIGH — `moveAcross` silently produces a false equation

`src/services/exprBricks.ts:247-260`. Drag the leading constant of `10 − x = 4` across the
equals sign and the board renders `x = 4 − 10`, asserting **x = −6**. The correct step is
`−x = 4 − 10`, so x = 6. Opposite sign, no error, no warning.

Root cause at `:251`:

```ts
const staying = parent.a.id === id ? parent.b : parent.a;
// `a − b` moving b: it arrives as `+ b`. Everything else flips to minus.
```

The comment only reasons about moving `b`. When `a` is the one moved out of a subtraction,
the operand left behind was a *subtrahend* and must be negated — it never is. Reproduced with
plain numbers too: `10 − 3 = 7`, move the `10`, get `3 = 7 − 10` (asserting 3 = −3).

`canMoveAcross` places no restriction on which operand is dragged, and `ExprBoard.tsx:147`
wires it directly to the drag gesture. `exprBricks` backs the step-by-step solving surface
reached from `CompoundQuestionRenderer` and the Faraday chat components. All four existing
tests for this function move `side.b` only; moving `side.a` of a subtraction is untested.

Any equation of the form `constant − x = constant` — an ordinary linear equation — lets the
student, or the tutor's own board, land on a wrong-signed state. This is worse than a crash: a
maths tutor teaching a false step, confidently.

**Fix:** when `parent.op === "−"` and the moved node is `parent.a`, negate `staying`.

### MEDIUM — the rest

- **`formatDateHe` / `formatDateLongHe` throw** `RangeError: Invalid time value` on NaN,
  ±Infinity, out-of-range or non-numeric input (`src/lib/dates.ts`). No guard, unlike
  `errors.ts` in the same directory, which deliberately falls back. Called on
  `hw.deadline ?? hw.createdAt` in `HomeworkManagementView`.
- **`countOf` / `dayCount` / `hourCount` render garbage** — literal `"NaN ימים"`,
  `"Infinity ימים"`, `"-1 ימים"`, `"2.0000001 שעות"` (`src/lib/hebrew.ts`). Zero validation in
  the one documented chokepoint for every counted-noun string in the UI.
- **`hebrewGuard.arabicSample` returns the entire input** instead of the offending word when
  the surrounding whitespace is `\t` or `\n` rather than a space — which defeats its documented
  purpose exactly on the multi-line generated content (steps, explanations) it exists to guard.
- **`errors.errorMessage` has no length cap** — a 100,000-character single-line `Error` message
  reaches the toast (`ErrorToaster`) unmodified, on a phone.
- **`exprBricks.holes()` stack-overflows** at a tree depth where `value()` and `text()` on the
  identical tree do not.

### LOW

- `algebraBricks.rat()` accepts NaN/Infinity silently, though it already rejects zero
  denominators.
- `termBody()` uses the wrong minus glyph for negative exponents.
