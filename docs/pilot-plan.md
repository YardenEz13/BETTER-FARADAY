# Pilot readiness plan — 4 weeks

Target: a real classroom pilot one month out. This plan is ordered by
execution sequence, not by severity. Each step lists what to do, why it
matters for the pilot specifically, and where the work lands in the code.

Current baseline (verified 2026-07-25): `npm run build` green, `npm run test`
green at 162/162, prod Convex deployment `befitting-panther-27` exists,
rate limiter + AI kill-switch + Sentry + uptime probe + `/legal` all present.
The gap is content volume, content trust, and operational headroom.

---

## Step 1 — Scale the question bank through the packet pipeline

**The problem.** The bank is 100 bagrut-style questions: exactly 20 per topic
across 5 topics, spread over difficulty 1–4, so roughly 5 per difficulty
band. `questions.getNextQuestion` excludes recently-attempted IDs but falls
back to repeats once the pool is dry (`convex/questions.ts:50`). With a
default daily goal of 5–30 questions, a student exhausts a topic in one or
two sessions and starts seeing repeats inside week 1. This is the single
thing most likely to end the pilot early.

**The leverage.** Do not hand-author. The packet import pipeline already
built for this is the scaling engine: `packetImport.ts` (mutations/queries)
+ `packetPipeline.ts` (Gemini actions) run PDF → inventory → solve →
structure → verify → teacher review → publish into `compoundQuestions`.
It handles the Gemini Files API, batch staggering for rate limits, recursive
splitting on MAX_TOKENS, a stale-packet watchdog, and crop mode for figures.

**Do:**
1. Run 8–12 real bagrut papers (581/582 or the relevant unit level) through
   the pipeline end to end. Measure yield per paper — questions published vs.
   questions dropped or flagged — before committing to a target count.
2. Fix whatever the yield number exposes. Expect the weak spots to be
   figure-heavy geometry and multi-part parameter questions.
3. Set the target from the measured yield: aim for **~60 usable questions per
   topic minimum**, roughly 12 per difficulty band, so a student practising
   daily for a month does not repeat.
4. Backfill themed precompute after the bank grows
   (`precompute:startPrecomputePipeline`) — this is blocked on
   `GEMINI_API_KEY` being set on prod (see Step 6).

**Why first.** Everything downstream — difficulty tuning, exam mode, review
deck — is meaningless against a bank this thin, and pipeline throughput has
the longest lead time of anything in this plan.

---

## Step 2 — Content correctness gate

**The problem.** The 100 seeded questions are AI-authored "in the style of
Israeli bagrut," and pipeline-imported questions are Gemini-solved. Nothing
between generation and a student's screen guarantees the answer is right. One
wrong `correctIndex` in front of a real class costs teacher trust
permanently, and you do not get it back inside a one-month pilot.

**Do:**
1. Human math review of every question before publish. The review UI already
   exists (`PacketReviewPage.tsx`, `packetImport.updateQuestionDraft`); the
   missing piece is the discipline, not the tooling.
2. Keep proof questions behind their existing `proof_unverified` status
   (`packetImport.ts:291`) until reviewed — do not let that state auto-clear.
3. Add a "report a bad question" affordance for students and teachers that
   captures questionId + studentId + route. Any wrong answer that slips
   through then surfaces in hours instead of at the pilot post-mortem.
4. Spot-check KaTeX rendering across the new bank on a real device — Hebrew
   inside math blocks is the known fragile case.

---

## Step 3 — Make selection hold up at the new bank size

Once the bank is 5–10x larger, the selection logic becomes the constraint
instead of the inventory.

**Do:**
1. Widen the no-repeat window in `getNextQuestion` — the current recent-attempt
   exclusion was tuned against a 20-question topic.
2. Verify difficulty coverage per topic after import. A topic with 60
   questions all at difficulty 2 is still a broken adaptive experience; the
   engine needs real candidates at each band it can escalate to.
3. Check that the adaptive step actually moves through the enlarged range
   rather than parking students mid-scale.
4. Confirm exam mode (`exams.startExam`) and the review deck draw from the
   grown `compoundQuestions` bank, not just the legacy `questions` table.

---

## Step 4 — Gemini cost and quota headroom

**The problem.** `globalDaily` is 2000 calls/day (`convex/aiGate.ts:23`).
Thirty students at 20 tutor messages each is 600, plus notebook vision
checks, abandoned-chat analytics, homework personalization, and the Step 1
precompute backfill. Tripping the cap mid-lesson shows every student
"פאראדיי עמוס כרגע" at the same moment — the worst possible pilot failure,
because it looks like the product is broken rather than busy.

**Do:**
1. Confirm billing is on a paid Gemini tier. Free-tier RPD limits will trip
   before your own cap does, and the pipeline in Step 1 will consume heavily.
2. Model the real per-student-per-day call budget from pilot class size, then
   set `globalDaily` with headroom above it.
3. Alert on `aiUsage` before the cap trips. Usage is already metered
   (`aiUsage.record` on every proxy call) but nothing watches the number.
4. Decide the degradation story: when the cap is hit, is the tutor off, or is
   practice still fully usable without it? Practice must survive tutor
   unavailability.

---

## Step 5 — Device and network readiness

**The problem.** Students will be on phones, on school wifi, behind school
content filters. Current e2e coverage is one desktop happy-path spec
(`e2e/student-loop.spec.ts`).

**Do:**
1. Self-host the mathlive fonts. `MathField.tsx:17` pulls them from
   `cdn.jsdelivr.net` at runtime, and school content filters block CDNs
   routinely — that is a silently broken math keypad for the whole class.
2. Real-device pass on the three paths that matter: practice loop, AI chat
   panel, and the QR notebook bridge (`/bridge/:token`).
3. Sanity-check load time on the actual school connection. Bundles are lazy
   split correctly (main 733KB / 249KB gzipped, teacher dashboard 541KB /
   152KB), so this is a measurement, not an assumed rewrite.
4. Extend e2e to cover homework submission and the chat panel, at mobile
   viewport.

---

## Step 6 — Finish prod configuration and alerting

`docs/deploy.md` still marks these manual and undone. This checklist is the
launch gate.

**Do:**
1. `GEMINI_API_KEY` on prod — Step 1's precompute backfill is blocked on it.
2. Vercel prod and preview env vars; Sentry DSN; `CONVEX_SITE_URL` repo
   variable for the uptime workflow.
3. Run the `docs/deploy.md` verification checklist: `/health`, crons present,
   tutor message increments the teacher KPI.
4. Route alerts somewhere a human sees during a school day. The uptime
   workflow only emails the repo owner, and GitHub auto-disables schedules
   after 60 days of inactivity.
5. Document a Convex snapshot/backup cadence for the pilot window.

---

## Step 7 — Teacher workflow

The teacher is the pilot's real customer; if the dashboard does not earn its
keep in week 1, the pilot does not get renewed.

**Do:**
1. CSV roster import. `classroom.addStudent` adds one student at a time —
   unusable for a class of 35 on day one.
2. Walk the full teacher path start to finish as a teacher would: roster →
   assign homework → watch the command center → read a session brief. Fix
   whatever breaks the narrative.
3. Confirm the weekly digest cron (`digest.generateAllDigests`, Sundays
   04:00 UTC) produces something a teacher would actually read.

Parent reports were removed (they were blocked on consent anyway). If the
pilot wants them back, they return as a capability-URL feature built on top
of a signed consent record, not before one.

---

## Step 8 — Data lifecycle

**The problem.** `Legal.tsx` promises access, correction, and deletion via
email, but there is no student purge anywhere — only
`deleteHomework` / `deleteChat` / `deleteAssignment`. You have already
committed in writing to a capability the code cannot perform.

**Do:**
1. ~~Add a cascading student purge~~ — done: `classroom.purgeStudent` cascades
   attempts, sessions, aiChats/aiMessages, sessionBriefs, studentPowerMap,
   hintRequests, xpEvents, PDF work and file storage.
2. Confirm chat retention actually runs — abandoned chats close hourly via
   `ai.processAbandonedChats`, but transcripts persist indefinitely.
3. **Start the parental consent paperwork now, in parallel with Step 1.**
   There is no consent flow in the codebase (zero hits for consent or
   הסכמת הורים). `Legal.tsx` is a good disclosure, but disclosure is not
   consent. Minors' work, chat transcripts, and notebook photos go to Google.
   An Israeli school pilot needs signed parental consent and school sign-off,
   and that paperwork is the longest lead time in this document — longer than
   any code here. It gates the pilot date regardless of engineering progress.

---

## Step 9 — Dress rehearsal

**Do:**
1. Load-test the write path. Live-class writes are what break when 30 students
   answer simultaneously. The old k6 suite was deleted as unused — write the
   one scenario you need against prod, then clean up the E2E classroom.
2. Full rehearsal with 5–10 real students for one lesson, on school devices
   and school wifi, one to two weeks before the pilot. Every remaining
   assumption fails here rather than in front of the class.
3. Write the incident runbook: who to call, how to flip the AI kill-switch,
   how to roll back a bad question, what the teacher tells the class if the
   tutor goes down.

---

## Step 10 — Authentication and authorization

Last, deliberately. Roughly an hour of work, and the pilot date is what makes
it necessary — but it should land against the finished product rather than
being maintained through four weeks of churn.

**Do:**
1. Student identity: replace the open name-picker (`classroom.list` lets
   anyone play as anyone) with a per-student PIN.
2. Teacher role boundary: `/teacher` currently sits behind only the shared
   prototype password (`PrototypeGate.tsx:23`), so any student who types the
   URL reads every classmate's chat transcripts, confusion scores, and
   struggle analysis. Separate teacher credential required.
3. `setAiEnabled` (`aiGate.ts:59`) is a public unauthenticated mutation —
   anyone can disable the tutor for the entire pilot. Make it internal and
   drive it from an authenticated dashboard control.
4. Lock the Gemini proxy: `Access-Control-Allow-Origin: "*"`
   (`convex/http.ts:20`) plus a client-supplied `studentId` rate-limit key
   means the per-student bucket is trivially reset and the endpoint is an
   open relay. Origin allowlist, and key the limiter off the authenticated
   identity.
5. Validate `studentId` server-side across Convex functions rather than
   trusting the client argument.
