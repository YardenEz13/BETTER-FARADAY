# Load testing — Faraday

Load tests use [**k6**](https://k6.io) (free, open-source, single binary).

## Install k6

```powershell
winget install k6.k6      # Windows
# or: choco install k6
```

## Scripts

| Script            | Targets                          | Safe on prod?                     |
| ----------------- | -------------------------------- | --------------------------------- |
| `convex_read.js`  | Convex read queries (HTTP API)   | ✅ read-only, no AI/Gemini spend  |
| `frontend.js`     | Vite/Vercel SPA shell + assets   | ✅ GET only                       |

> Mutations and Gemini actions are intentionally **not** load-tested — they write
> data and cost money. Point read tests at the `dev` deployment first.

## Run

```powershell
# smoke (default): quick sanity, 2 VUs / 30s
k6 run loadtest/convex_read.js

# ramped load / stress / soak
k6 run -e STAGE=load   loadtest/convex_read.js
k6 run -e STAGE=stress loadtest/convex_read.js
k6 run -e STAGE=soak   loadtest/convex_read.js

# custom deployment
k6 run -e CONVEX_URL=https://optimistic-weasel-444.convex.cloud loadtest/convex_read.js

# frontend
k6 run -e FRONTEND_URL=https://your-app.vercel.app -e STAGE=load loadtest/frontend.js
```

Profiles live at the top of each script (`smoke` / `load` / `stress` / `soak`) —
select with `-e STAGE=`.

## Thresholds (pass/fail gates)

`convex_read.js` fails the run if:
- transport error rate ≥ 1%
- p95 latency ≥ 800ms

Tune these in each script's `options.thresholds` as the baseline settles.

## Piping results into a logs / state tool

k6 streams structured output that any log platform can ingest:

```powershell
# JSON lines on disk -> ship to Loki / SigNoz / Better Stack / Axiom
k6 run --out json=loadtest/results.json loadtest/convex_read.js

# native Grafana Cloud k6 (free tier) — live dashboards + trends over time
k6 cloud login
k6 run -o cloud loadtest/convex_read.js
```

See the recommendation below for the free logs + state tracker.

## Live-class WRITE scenario (convex_live_write.js)

Simulates a live lesson: VU 1 is the teacher (rotates `live:start` rounds every
20s, polls `live:getResults`), the rest are students answering via
`live:submitAnswer` under distinct seeded identities.

```powershell
# Fixtures first (once per deployment):
npx convex run seedE2E:seed [--prod]
npx convex run seedE2E:seedLoadStudents [--prod]

npm run loadtest:live                       # smoke vs dev
k6 run -e STAGE=load loadtest/convex_live_write.js
# prod requires an explicit opt-in:
k6 run -e CONVEX_URL=https://befitting-panther-27.convex.cloud -e I_KNOW_THIS_IS_PROD=1 -e STAGE=load loadtest/convex_live_write.js
```

## Prod baseline — befitting-panther-27, 2026-07-14 (pre-launch, seeded, no users)

| Run | VUs | Requests | Failed | p95 |
|---|---|---|---|---|
| convex_read.js STAGE=stress | up to 200 | 31,772 (75/s) | 0% | 177 ms |
| convex_live_write.js STAGE=load | 25 | 5,576 (18.5/s) | 0% | 183 ms (mutations 243 ms) |

All thresholds passed with wide margins (read p95 budget 800ms, write 1000ms);
279 live answers accepted, zero OCC failures surfaced. No fixes required.
