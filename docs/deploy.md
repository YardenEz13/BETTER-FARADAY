# Production deployment runbook

Convex project: `cobalt-apollo` (team `yarden-etz-gmail-com`)
- Dev deployment: `optimistic-weasel-444`
- **Prod deployment: `befitting-panther-27`** (created 2026-07-14)
  - Client URL: `https://befitting-panther-27.convex.cloud`
  - HTTP actions (health, Gemini proxy): `https://befitting-panther-27.convex.site`

## Deploying backend changes to prod

```bash
npx convex deploy -y        # pushes convex/ to the prod deployment
```

## One-time prod setup — status

| Step | Status |
|---|---|
| `npx convex deploy` (create prod) | ✅ done |
| Seed topics: `npx convex run seedTopics:seedTopics --prod` | ✅ done (5 topics) |
| Seed questions: `seedBagrut:seedBagrutQuestions`, `seedGeometry:seedGeometryProof`, `seedGeometryQuestions:addGeometryQuestions`, `addMore:addQuestions` (all `--prod`) | ✅ done (100 + 1 + 10 + 10) |
| `npx convex env set GEMINI_API_KEY <key> --prod` | ⚠️ **manual** — run yourself (key is in `.env.local` as VITE_GEMINI_API_KEY, or copy from dev: `npx convex env get GEMINI_API_KEY`) |
| Themed-question precompute backfill: `npx convex run precompute:startPrecomputePipeline --prod` | ⚠️ after GEMINI_API_KEY is set |
| Vercel prod env vars (dashboard → Project → Settings → Environment Variables, scope Production): `VITE_CONVEX_URL=https://befitting-panther-27.convex.cloud`, `VITE_SENTRY_DSN=<from sentry.io project>`, `SENTRY_AUTH_TOKEN=<sentry org token>` — then redeploy | ⚠️ manual |
| GitHub repo variables (Settings → Secrets and variables → Actions → Variables): `CONVEX_SITE_URL=https://befitting-panther-27.convex.site`, optional `PROD_APP_URL=<vercel prod URL>` | ⚠️ manual — powers `.github/workflows/uptime.yml` |
| Sentry: create React project at sentry.io → copy DSN | ⚠️ manual |

## Verification checklist (after the manual steps)

- `curl https://befitting-panther-27.convex.site/health` → `{"ok":true,...}` (already verified ✅)
- Vercel prod URL loads and the network tab shows requests to `befitting-panther-27.convex.cloud`
- Prod dashboard → Crons shows exactly: `cleanup-abandoned-chats` (1h), `sweep-bridge-sessions` (1h), `generate-weekly-digests` (weekly)
- Send a tutor message → teacher dashboard "קריאות Gemini היום" KPI increments
- Uptime workflow: run manually via Actions → Uptime → Run workflow

## Load testing (see loadtest/README.md)

Run reads + the live-write scenario against prod **before onboarding real
users** (the write scenario refuses prod targets unless `I_KNOW_THIS_IS_PROD=1`).
Seed the load-test fixtures first: `npx convex run seedE2E:seed --prod`,
then clean up the "כיתת בדיקות E2E" classroom afterwards from the dashboard.

## Notes

- Seed/clear functions are `internalMutation`s — callable only via
  `npx convex run` or the dashboard, never from the client bundle.
- `convex/clear.ts` deletes ALL topics and questions. Never run it on prod.
