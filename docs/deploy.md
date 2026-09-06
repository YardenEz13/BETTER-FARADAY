# Production deployment runbook

Convex project: `cobalt-apollo` (team `yarden-etz-gmail-com`)
- Dev / preview deployment: `optimistic-weasel-444`
  - Client URL: `https://optimistic-weasel-444.convex.cloud`
  - HTTP actions: `https://optimistic-weasel-444.convex.site`
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
| `npx convex env set GEMINI_API_KEY <key> --prod` | ✅ done — `/health` returns `aiEnabled: true` |
| ~~Themed-question precompute backfill~~ | ❌ **removed.** The pipeline was deleted — it cost 3.7 GB/month of database bandwidth. The ~10.5k rows it already generated are still served; nothing generates more. See `docs/convex-budget.md`. |
| Vercel prod env vars (dashboard → Project → Settings → Environment Variables, scope Production): `VITE_CONVEX_URL=https://befitting-panther-27.convex.cloud`, `VITE_SENTRY_DSN=<from sentry.io project>`, `SENTRY_AUTH_TOKEN=<sentry org token>` — then redeploy | ⚠️ manual |
| Vercel **Preview** env vars (same screen, scope Preview): `VITE_CONVEX_URL=https://optimistic-weasel-444.convex.cloud` — branch/preview deploys point at the dev deployment | ⚠️ manual |
| GitHub repo variables: `CONVEX_SITE_URL`, optional `PROD_APP_URL` | 🔴 **NOT SET — the uptime monitor is a no-op.** `gh variable list` returns empty. Both curl steps in `uptime.yml` are gated on `vars.CONVEX_SITE_URL != ''`, so every run since setup has reported **success while checking nothing**. Fix: `gh variable set CONVEX_SITE_URL --body https://befitting-panther-27.convex.site` |
| Sentry: create React project at sentry.io → copy DSN | ⚠️ manual |

## Verification checklist (after the manual steps)

- `curl https://befitting-panther-27.convex.site/health` → `{"ok":true,...}` (already verified ✅)
- Vercel prod URL loads and the network tab shows requests to `befitting-panther-27.convex.cloud`
- Prod dashboard → Crons shows exactly three: `sweep-bridge-sessions` (6h),
  `check-ai-usage` (2h), `generate-weekly-digests` (weekly). If you see
  `generate-questions`, `cleanup-abandoned-chats` or anything precompute, an
  old deploy is live — those were removed deliberately.
- **`SLOW_CRONS` must NOT be set on prod.** It is set on dev only, and slows
  the two cleanups to 6h/12h. Prod reads the faster branch by default.
- Send a tutor message → teacher dashboard "קריאות Gemini היום" KPI increments
- Uptime workflow: run manually via Actions → Uptime → Run workflow

## Load testing

The k6 suite was removed — it was 439 lines maintained for a single
pre-pilot rehearsal. Write the scenario you actually need the week you need
it. Fixtures still exist: `npx convex run seedE2E:seed --prod`, then clean up
the "כיתת בדיקות E2E" classroom afterwards from the dashboard.

## Notes

- Seed/clear functions are `internalMutation`s — callable only via
  `npx convex run` or the dashboard, never from the client bundle.
- `convex/clear.ts` deletes ALL topics and questions. Never run it on prod.
