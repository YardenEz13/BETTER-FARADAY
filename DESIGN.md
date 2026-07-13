# Faraday Logic — Design System

The "clay/electric" design system: a bright, tactile, gamified surface (Duolingo-adjacent) fused with an
electric-physics accent motif. Light theme is the default surface; a dark theme (`[data-theme="dark"]`)
mirrors every token. **Never hardcode hex in `.tsx` — always use the CSS variables below (via Tailwind
utilities or `var(--token)`).**

Live reference: run the dev server and open **`/design`** (dev-only route) to see every token and
primitive rendered in both themes.

## Color tokens

All defined in `src/index.css` inside `@theme` (light) and overridden in `[data-theme="dark"]`.

| Role | Variable | Light | Usage |
|---|---|---|---|
| Primary (Volt green) | `--color-primary` / `-dark` / `-container` / `-on-*` | `#17C964` | primary actions, success, streaks bar |
| Secondary (Arc violet) | `--color-secondary` / `-dark` / `-container` | `#7B61FF` | AI/tutor accents, secondary actions |
| Tertiary (Filament amber) | `--color-tertiary` / `-dark` / `-container` | `#FFB02E` | streaks, energy, warnings |
| Error | `--color-error` / `-container` | `#FF4B4B` | destructive actions, invalid state |
| Background | `--color-background` | `#F3F6F2` | page background |
| Surface | `--color-surface` / `-dim` / `-bright` | `#ffffff` | cards, panels |
| Surface containers | `--color-surface-container-{lowest,low,DEFAULT,high,highest}` | `#fff`→`#dedede` | nested surfaces, chips, recessed tracks |
| On-surface text | `--color-on-surface` / `-variant` | `#3c3c3c` / `#777` | body text / muted text |
| Outline | `--color-outline` / `-variant` | `#e0e0e0` / `#ebebeb` | 2px card borders, dividers |

Each color also exposes `-fixed`, `-fixed-dim`, `-on-*-fixed(-variant)` variants for Material-style fixed
accents. Use container colors (`bg-primary-container text-on-primary-container`) for tinted badges/pills
rather than opacity hacks.

## Type scale

Semantic tokens generate Tailwind utilities directly (`text-headline-md`, etc. — each bundles size +
line-height + weight).

| Utility | Size | Weight | Usage |
|---|---|---|---|
| `text-headline-xl` | 32px | 700 | page hero / big number moments (pairs with `font-headline-xl` = Yarden) |
| `text-headline-lg` | 24px | 700 | page title |
| `text-headline-md` | 20px | 800 | section title / dialog title |
| `text-headline-sm` | 17px | 700 | card title / list-row title |
| `text-body-lg` | 16px | — | reading text, chat, fields |
| `text-body-md` | 14px | — | default UI body |
| `text-body-sm` | 13px | — | secondary text, table cells |
| `text-label-lg` | 12px | 600 | eyebrow labels, chips, small buttons |
| `text-label-md` | 11px | 600 | meta text, captions, axis labels |
| `text-label-sm` | 10px | 600 | micro badges, timestamps |

Font families: `Assistant` (Hebrew-first UI/body), `Yarden` (display headlines, `font-headline-xl/lg`
only), `JetBrains Mono` (`font-mono` — the `.num`/`.label-mono` "voltmeter" faces for stats).

## Radius

| Token | Value |
|---|---|
| `--radius-sm` | 10px |
| `--radius` | 14px |
| `--radius-md` | 16px |
| `--radius-lg` | 20px |
| `--radius-xl` | 24px |
| `--radius-full` | pill/circle |

## Clay shadows

The signature "3D press" offset shadow — solid color, no blur, mimics a button standing off the surface.

| Token | Used by |
|---|---|
| `--shadow-clay` | `.clay-card`, `.btn-clay-ghost` (neutral offset) |
| `--shadow-clay-primary` | `.btn-clay-primary`, active `SegTabs` pill |
| `--shadow-clay-secondary` | `.btn-clay-secondary` |
| `--shadow-clay-tertiary` | tertiary/amber emphasis surfaces |
| `--shadow-clay-error` | destructive/error emphasis |
| `--shadow-sm/md/lg` | soft ambient shadows for non-clay overlays (bottom sheets, popovers) |

On `:active`, clay elements translate down and their shadow collapses to a 1px sliver — that's the
"press" feel. Don't recreate this by hand; use `.clay-card` / `.btn-clay-*` / `ClayButton` / `ClayCard`.

## Spacing

`--spacing-*` tokens exist (`xs` 4px, `sm` 12px, `md` 24px, `lg` 40px, `xl` 64px, plus `-gutter`,
`-margin`, `-stack-*` variants) but in practice most layout uses plain Tailwind spacing utilities
(`gap-3`, `p-4`, …) — the semantic spacing tokens are mainly for legacy call sites. Prefer Tailwind's
default scale for new code; only reach for `var(--spacing-*)` if matching an existing legacy layout.

## Which component when

All primitives live in `src/components/ui/` — import from `"../components/ui"` (barrel), not the files.

| Component | Use for | Notes |
|---|---|---|
| `ClayButton` | Any clickable action | `variant`: primary/secondary/ghost/icon · `size`: sm/md/lg · `loading` |
| `ClayCard` | Any elevated content surface | `padding`: none/sm/md/lg · `interactive` adds hover lift for clickable cards |
| `Chip` | Filter pills, stat chips, toggles | `selected`, optional leading `icon` |
| `SegTabs` | 2–5 way view switcher (nav, filters) | Generic over a string union; animated pill via `layoutId` |
| `Field` / `FieldTextarea` | Text inputs | Built-in label/hint/error chrome, `aria-*` wired up |
| `Badge` | Small status/count pill | `tone`: primary/secondary/tertiary/error/neutral |
| `Stat` | KPI readout (number + label) | `tone`, `size`: md/lg, mono `.num` face |
| `ProgressBar` | Linear progress / mastery bars | `variant`: primary/gradient/tertiary, or custom `color` for heat scales |
| `EmptyState` | Zero-data / empty list states | icon disc + title + description + CTA slot |
| `Skeleton` / `SkeletonText` / `SkeletonCircle` / `SkeletonClayCard` / `SkeletonCard` | Loading placeholders | `Skeleton` = generic block; `SkeletonCard` = pre-built kpi/student-card/mastery-cell shapes |
| `BottomSheet` | Mobile-first modal/sheet | Swipe-to-dismiss, falls back gracefully on desktop |

## Rules

1. **No hex in `.tsx`.** Colors come from CSS variables (`bg-primary`, `text-on-surface`, or
   `var(--color-*)` in rare inline cases). Canvas-painting files are the only sanctioned exception
   (see `HEX_ALLOWLIST` in `scripts/design-lint.mjs`).
2. **No new `style={{}}` in `src/pages/*`.** Prefer `ui/` primitives + Tailwind + CSS variable classes.
   Existing inline styles are tracked as debt, not banned outright — don't add more.
3. **RTL is mandatory.** Use logical Tailwind utilities (`ms-`, `me-`, `ps-`, `pe-`, `border-s-*`,
   `border-e-*`) — never `ml-`/`mr-`/`pl-`/`pr-` in new code. Pages are `dir="rtl"`.
4. **Run `npm run lint:design`** (i.e. `node scripts/design-lint.mjs`) before committing UI changes.

## Design-lint ratchet

`scripts/design-lint.mjs` tracks two debt metrics against a committed baseline
(`scripts/design-lint-baseline.json`):

1. Raw hex colors in `src/**/*.tsx` (outside the allowlist) — **fails the build if the count grows**.
2. `style={{` inline styles in `src/pages/**/*.tsx` — **warns if the count grows** (not yet a hard fail).

Counts *below* baseline are allowed silently — the script only complains about regressions. When you
migrate legacy code and reduce a file's count, run:

```
node scripts/design-lint.mjs --update
```

This rewrites the baseline to the new (lower) counts, "ratcheting" the debt ceiling down so it can never
silently creep back up. Never hand-edit `scripts/design-lint-baseline.json`; always regenerate it with
`--update` after a real reduction.
