# Convex bandwidth budget

What the app costs to run, what normal looks like, and what to watch so a
runaway is caught in hours instead of at the end of a billing month.

Written after the August 2026 incident, where two background crons burned
4.38 GB of a 4.81 GB month and disabled the whole team's projects.

## How Convex bills

Database I/O is **bytes read + written by function executions**. The part
that surprises people is the multiplier: a reactive `useQuery` re-executes
whenever *any document in any table it touched* changes. So cost is

```
bytes per execution  ×  number of invalidations
```

Both terms matter, and the second one is invisible in the code. A cheap-looking
query that reads eight tables and sits on an always-open dashboard is not cheap.

Two consequences worth internalising:

- **Only subscribed queries re-run.** A query on an unmounted route costs
  nothing. `StudentHome` holds 11 subscriptions, but they all unmount when the
  student enters `/practice/:topicId`, so they do not pay per answer.
- **A hot writer poisons every query that reads it.** `aiUsage.record` patches a
  row on every Gemini call. While the teacher dashboard read that table, one
  student chat message re-read every student's attempts. Fixed by giving usage
  its own subscription — but the pattern will recur, so watch for it.

## Plan limits

Starter includes ~1–2 GB Database I/O per month, then bills **$0.22/GB**. The
important difference from Free: Free *hard-stops and disables projects*, Starter
bills the overage. **Keep a spending limit set** — it is the dial that turns a
runaway into a small charge instead of a dead pilot or an unbounded invoice.

## Modelled pilot cost

One class of 35 students, 30 questions/day each, 20 school days.

### Student practice — the floor

During a practice session only three queries are live: `classroom.get`,
`topics.list`, and `questions.getNextQuestion`. The first two are trivial. The
third re-runs on every answer and dominates:

| Read | Size |
|---|---|
| 500 attempts (`by_student_topic`, for solvedIds) | ~125 KB |
| ~12 questions at the current difficulty (fat: stem, choices, solutionSteps, explanation) | ~30 KB |
| recent-10 attempts, current session | negligible |
| **per answer** | **~155 KB** |

35 × 30 × 20 = 21,000 answers → **~3.3 GB/month**, or roughly **$0.30** of
overage. That is the price of running the pilot. It is fine.

### Teacher dashboard — the actual risk

`commandCenter.getCommandCenter` reads **eight tables** and, at 35 students,
roughly:

| Read | Size |
|---|---|
| 35 × 200 attempts | ~1.8 MB |
| 35 × 50 `aiChats` (fat `metrics` object: 13 fields, 4 arrays, a summary string) | ~2.6 MB |
| 40 hintRequests, all pdfAssignments + pdfQuestions, students, topics | ~0.2 MB |
| **per execution** | **~4.5 MB** |

It is invalidated by writes to `attempts`, `students`, `aiChats`,
`hintRequests`, `pdfAssignments`, and `pdfQuestions` — i.e. by normal class
activity. A single 45-minute lesson with the dashboard open, 35 students
answering ~15 questions each, is ~525 invalidations:

```
525 × 4.5 MB ≈ 2.4 GB — in one lesson
```

`aiChat.getTeacherChatAnalytics` sits on the same screen and is comparable:
35 × 20 fat chat docs **plus a `sessionBriefs` lookup per chat** ≈ 1,400
documents per execution.

**This is the one thing that can repeat the incident.** Two ways out:

1. **Operational, free:** don't leave the dashboard open during class. Open it
   between lessons. Perfectly reasonable for a single-class pilot.
2. **Structural, ~half a day:** maintain a denormalised per-student counter row
   (per-topic correct/total, last-active, chat count) patched in the same
   mutation that inserts an attempt. The dashboard then reads 35 small rows
   instead of 7,000 fat documents — a ~50× cut. Do this before a second class.

## What to watch

Convex's own dashboard already does the monitoring. Do **not** build an in-app
bandwidth monitor: it would duplicate the dashboard and burn bandwidth to
measure bandwidth.

- **Usage → breakdown by function**, weekly during the pilot. This is what
  found the incident.
- **Set a spending limit.** Non-negotiable. It is the only hard backstop.
- **Notification emails** as limits approach — make sure they reach an address
  someone reads on a school day.

### The rule

> Any function in the top 3 by bandwidth that isn't `getNextQuestion` or
> `getCommandCenter` is an anomaly. Investigate it the same day.

Background jobs are the dangerous class, because nothing on screen tells you
they are running. Both incident functions were crons:
`precompute.getMissingPrecomputations` (3.71 GB) and `questionGen.pickGap`
(674 MB). Before putting *any* job on a schedule, work out its cost per run
times its runs per month, and write the number down.

## Fixed so far

| Change | Saved |
|---|---|
| Deleted the themed-precompute pipeline | ~3.7 GB/mo |
| Deleted the 75-minute question-authoring cron | ~674 MB/mo |
| `aiUsage` out of `getCommandCenter` | removes the highest-frequency dashboard invalidation |
| `getNextQuestion` attempts read bounded to 500 | was unbounded — grew forever per student per topic |
