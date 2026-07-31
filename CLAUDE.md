# Faraday — Claude instructions

Adaptive math-practice platform for Israeli high-school students. Hebrew, RTL,
KaTeX. React 18 + Vite + TypeScript, Convex backend, Gemini tutor ("Michael
Faraday") behind a server-side proxy.

## Behavior (every session, no reminder needed)

- **Caveman.** Talk terse. Use the `caveman` skill. Full technical accuracy, no filler.
- **Ponytail.** Use the `ponytail` skill on every coding task. Delete before adding. Stdlib and native before deps. Shortest working diff.
- **Graphify first.** Before answering anything about this codebase, run `graphify query "<question>"`. It beats grep. `graphify update .` after every commit.
- **Verify before asserting.** Trace consumers before calling code dead — three "safe" cuts this project audited turned out load-bearing. Grep every caller first.

## Branches

`green-torch` is the preview branch. It is where work lands and gets checked
before production.

```
work → green-torch → master → prod
```

- Check out `green-torch` at session start (create from `origin/green-torch` if missing). Never commit to `master` directly.
- Merge `green-torch` → `master` only when asked. **Pushing `master` deploys Convex to prod** via `.github/workflows/ci.yml`, so that merge is a production release.
- `graphify update .` then push, after every commit.

## Rules

1. **RTL is mandatory.** Logical properties only (`ms-`/`me-`, `ps-`/`pe-`). No hardcoded left/right.
2. **Design tokens only.** Everything comes from the CSS variables in `src/index.css` — never hardcode hex. `npm run lint` enforces this (`scripts/design-lint.mjs`). Full design language: `DESIGN.md`. The light clay/electric-green system is current; the old dark cobalt theme is retired.
3. **Don't break KaTeX.** Hebrew appears inside math blocks; handled by `strict: "ignore"`.
4. **Strict TypeScript.** No new `any`.
5. **Icons** come from the in-house `src/components/electric` family. No icon libraries.
6. **Mobile matters.** Students are on phones. Never load fonts/assets from a CDN — school networks filter them.

## Commands

```
npm run dev      # vite dev server
npm run build    # tsc -b && vite build (this is the typecheck)
npm run lint     # eslint + design-lint
npm test         # vitest
npm run test:e2e # playwright (needs a live Convex backend + seedE2E:seed)
```

Convex: `npx convex dev` for local. **Never `npx convex dev --prod`** — it points
`.env.local` at production and local dev then writes real student data. Prod
deploys happen in CI on `master`. Deploy docs: `docs/deploy.md`. Pilot status
and open gaps: `docs/pilot-plan.md`.

## Watch out

- The question bank is machine-authored and unreviewed. `questionGen` adds more every 75 min, uncapped. Correctness review is a human job; students report bad questions via `questionReports`.
- `studentPowerMap` is an engine, not a screen — `levels.ts` and `homework.ts` read it.
- No auth yet. `studentId` is a client-supplied arg everywhere; rate limits are abuse-slowdown, not a security boundary.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## graphify

Knowledge graph at `graphify-out/`. `graphify query "<q>"` for questions,
`graphify path "<A>" "<B>"` for relationships, `graphify explain "<concept>"`
for one concept. `graphify-out/wiki/index.md` for broad navigation;
`GRAPH_REPORT.md` only for architecture review. `graphify update .` after
every commit (AST-only, no API cost).

Not on PATH? Use the full path: `& "$env:APPDATA\Python\Python314\Scripts\graphify.exe"`
(PowerShell) or `"/c/Users/yarde/AppData/Roaming/Python/Python314/Scripts/graphify.exe"` (bash).
