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
