# AI Usage in Faraday Project

All AI functionality in this app is powered by **Google Gemini**, called server-side via REST
(`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` /
`:streamGenerateContent`). The API key (`GEMINI_API_KEY`) lives only in Convex server env — it is
never shipped to the browser.

There is **no local/in-browser model** despite the "MediaPipe Web LLM" mention in `CLAUDE.md` —
that was aspirational documentation. `src/services/localAI.ts` is misleadingly named; it's a thin
client that proxies every call through Convex to Gemini.

## Models (fallback order)

Primary chain used across most features:
1. `gemini-2.5-flash`
2. `gemini-3.1-flash-lite`
3. `gemini-2.5-flash-lite`

Proof grading additionally falls back to `gemini-2.0-flash` as a third-tier option. The allowed
model list is enforced server-side in `convex/http.ts` (`ALLOWED_MODELS`) so the client can never
request an arbitrary model.

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
- **Config:** `gemini-2.5-flash` only, `temperature: 0.2–0.3`, JSON mode. Client-side fallback uses a local heuristic if Gemini fails or exceeds a 15s timeout.

### 6. Homework Personalization
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
