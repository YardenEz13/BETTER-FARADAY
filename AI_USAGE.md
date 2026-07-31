# AI Usage in Faraday Project

All AI functionality in this app is powered by **Google Gemini**, called server-side via REST
(`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` /
`:streamGenerateContent`). The API key (`GEMINI_API_KEY`) lives only in Convex server env — it is
never shipped to the browser.

There is **no local/in-browser model** despite the "MediaPipe Web LLM" mention in `CLAUDE.md` —
that was aspirational documentation. `src/services/localAI.ts` is misleadingly named; it's a thin
client that proxies every call through Convex to Gemini.

## Models (fallback order)

Every model has its own free-tier quota bucket (Google AI Studio), so on a 429 a caller moves to
the next model in its task's chain instead of failing — more models in a chain means more total
free requests/day. `gemini-3.5-flash-lite` and `gemini-3.1-flash-lite` carry ~25x the daily quota
(RPD 500 vs. RPD 20) of every other model, so high-volume tasks lead with one of them; quality-
sensitive tasks lead with a heavier model and only fall back to the lite pair last. Chains are
defined once in `convex/geminiModels.ts` (`GEMINI_MODELS`):

- **Chat** (tutor, highest volume): `gemini-3.1-flash-lite` → `gemini-3.5-flash` → `gemini-3-flash`
  → `gemini-2.5-flash-lite` → `gemini-2.5-flash`
- **Grading** (proof steps, correctness-first): `gemini-3.5-flash` → `gemini-3-flash` →
  `gemini-2.5-flash` → `gemini-3.1-flash-lite` → `gemini-2.5-flash-lite`
- **Authoring** (new questions, quality over volume): `gemini-3.6-flash` → `gemini-3.5-flash`
- **Rewrite** (theme personalization, lite-only): `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite`
- **Analysis** (abandoned-chat scoring): same chain as chat
- **Vision** (notebook/question-image reading): same chain as grading

`localAI.ts`'s client-side chat retry list is a duplicate of `GEMINI_MODELS.chat` and must be kept
in sync by hand (see comment there). The allowed model list is enforced server-side in
`convex/http.ts` (`ALLOWED_MODELS` = the union of every chain above), so the client can never
request an arbitrary model. `gemini-2.0-flash` was dropped from every chain — no longer in the
account's available models.

## Where AI is used

### 1. AI Tutor Chat — "Michael Faraday"
- **Files:** `src/services/localAI.ts` (client), `convex/http.ts` (`/gemini-stream`, `/gemini-generate` proxy), `src/components/AIChatPanel.tsx` (UI)
- **What it does:** Socratic tutor for practice, homework, and proof help. Streams responses via SSE. Uses mode-specific prompts (`PRACTICE_AGENT_PROMPT`, `HOMEWORK_AGENT_PROMPT`, `PROOF_AGENT_PROMPT`).
- **Config:** `temperature: 0.3`, `maxOutputTokens: 1024`.
- **Guardrail:** `violatesSocraticRules()` strips raw answers/calculations from tutor responses (skipped in proof mode, where showing work is expected).
- **Reliability:** retries per model (`MAX_RETRIES = 2`) with exponential backoff (2s / 4s) on HTTP 429.
- **Session management:** `needsCompaction()` compacts chat history after more than 4 user messages (keeps the last 4 + a heuristic summary). This is context-window management, **not** a usage cap.

### 2. Notebook Vision Hint (photo check)
- **File:** `src/services/localAI.ts` → `checkNotebookImage()`
- **What it does:** Student photographs handwritten work; Gemini vision returns one Socratic next-step hint.
- **Config:** `temperature: 0.2`, `maxOutputTokens: 1500`, non-streaming.

### 3. Teacher Question Import (vision extraction)
- **File:** `src/services/localAI.ts` → `extractQuestionFromMedia()`
- **What it does:** Teacher uploads a textbook photo/PDF; Gemini extracts the question and its format (multiple choice / fill-in-blank) as a structured draft for teacher review.
- **Config:** `temperature: 0.2`, `maxOutputTokens: 2048`, `responseMimeType: application/json`.

### 4. Proof Step Grading
- **File:** `convex/proofGrading.ts` → `gradeProofStep`
- **What it does:** Grades one geometry proof step (claim + reason) against the expected answer; returns correctness flags, a step score, and feedback.
- **Config:** `temperature: 0.1`. `MAX_ATTEMPTS_PER_MODEL = 3`, backoff `400ms × (attempt + 1)`, retries on `{429, 500, 502, 503, 504}`.
- Calls Gemini directly from the Convex action (bypasses the `http.ts` proxy).

### 5. Abandoned Chat Analytics
- **Files:** `convex/ai.ts` → `processAbandonedChats`; `src/services/localAI.ts` → `analyzeConversation()`, `generateCompositeBrief()`
- **What it does:** Analyzes idle tutor conversations for confusion score, sentiment, engagement, key struggle points, missing knowledge, and a teacher action item. Feeds the Teacher Dashboard (`AIChatAnalyticsView.tsx`, `ChatAnalysisView.tsx` — both are display-only, no direct Gemini calls).
- **Trigger:** chats idle for one hour (`convex/aiChat.ts`) are auto-processed and closed.
- **Config:** `GEMINI_MODELS.analysis` chain, `temperature: 0.2–0.3`, JSON mode. Client-side fallback uses a local heuristic if Gemini fails or exceeds a 15s timeout.

### 6. Question Authoring (questionGen cron)
- **File:** `convex/questionGen.ts`
- **What it does:** Writes new bagrut-style questions into the bank. Machine-authored and unreviewed — correctness review is a human job; students report bad ones via `questionReports`.
- **Trigger:** `convex/crons.ts`, every 75 minutes, uncapped.
- **Config:** `GEMINI_MODELS.authoring` chain (`gemini-3.6-flash` → `gemini-3.5-flash`, no further fallback), `temperature: 0.9` (variety over determinism), `maxOutputTokens: 8192`, `responseMimeType: application/json`.
- **Why newest-model-first:** low volume (one run per 75min) and a wrong question costs more than a skipped batch, so it leads with `3.6-flash` despite its tight quota (RPM 5 / RPD 20) — the cron just retries next cycle on a 429 rather than needing a long fallback chain.

### 7. Homework Personalization
- **Files:** `convex/ai.ts` → `personalizeHomework`; `convex/precompute.ts` → `precomputeThemeBatch`
- **What it does:** Rewrites question stems with a fun theme (football, Minecraft, Harry Potter, etc.) while preserving LaTeX/structure, in batches per theme.
- **Config:** `temperature: 0.7`, `maxOutputTokens: 4096`, structured `responseSchema`.
- **Rate limit:** self-reschedules every **5 minutes** (`ctx.scheduler.runAfter`, 300000ms) — the only explicit cooldown in the codebase, added to respect Gemini rate limits.

## How many AI calls does a student make per session?

**There is no hard cap.** Grep across `src/` and `convex/` for `MAX_MESSAGES`, `dailyLimit`,
`messageLimit`, or `quota` turns up nothing — no per-student session limit, daily message quota, or
token budget is enforced anywhere in the app.

The only numeric throttles that exist are system-level, not student-facing:
- Retry/backoff limits per Gemini call (2–3 attempts before giving up)
- The 5-minute cooldown between homework-personalization batches
- The 1-hour idle window before a chat is closed and analyzed

In practice, one student session can involve as many Gemini calls as messages sent in the tutor
chat, plus one call per notebook-photo check, plus (asynchronously, after the chat goes idle) one
analytics call — but nothing in the code stops a student from sending an unlimited number of
messages in a single session.

## Misc.
`test-gemini.mjs` / `test-gemini.js` at the repo root are ad hoc scripts for testing the Gemini API
directly; they are not part of the app bundle.
