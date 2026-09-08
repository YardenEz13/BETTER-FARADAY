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

## Focus mode

A second, calmer skin over the same screens, for students who lose the thread on the default one.
It is a device preference (`localStorage: faraday_focus_mode`), toggled from the header button on the
student home and the practice session, and it moves in two places at once:

- `data-focus="on"` on `<html>` — the block at the bottom of `src/index.css` zeroes every decorative
  CSS animation, hover travel, glow and backdrop-blur, and flattens the clay shadow to a hairline.
  It is a blanket rule, so decoration added later is covered without being listed.
- `useFocusMode()` in the pages (`src/components/FocusModeContext.tsx`) — the loud pieces do not
  **mount**. CSS cannot stop a canvas RAF loop, a GSAP tween or a confetti burst, and on a school
  phone those are the expensive half.

What goes, and why: the field-line backdrops, the mascot rig and his reaction bubbles, confetti,
flying XP, the streak/charge meters, XP counters, badges, titles, the shop, the league, achievements,
the daily experiment, notification badges, the self-opening tour, the proactive help card, and the
question's difficulty rating. What stays: the question, the explanation, the hint, the tutor button,
the teacher's live broadcast, the calculator, and one count of how far into the day you are.

The student home swaps its serpentine map and stats sidebar for `src/components/FocusBoard.tsx` —
one column: the next topic with one button, today as one line, then the topics as a plain list.

**When adding to a student screen:** if it moves on its own, celebrates, counts up, or offers a
detour, gate it on `!focus`. Motion-only effects can gate on the page's `reducedMotion`, which both
pages already OR focus mode into.

## Answer checking

One module decides whether a maths answer is right: `convex/answerMatch.ts`. The server grades with it
(authoritative) and the client imports the same file for instant optimistic feedback, so the two cannot
drift. It replaced two checkers that disagreed — one graded any answer over five characters as correct,
and both compared *strings*, so the LaTeX the MathField emits (`\sqrt{2}`) never matched the plain
Unicode the bank stores (`√2`).

It does not compare text. Both sides are canonicalised to one plain syntax, parsed, and compared by
**evaluating them at sample points**. √8 = 2√2, (x+1)² = x²+2x+1, 0.5 = 1/2 — all free once you evaluate.

The ladder, cheapest first:

| verdict | meaning | outcome |
| --- | --- | --- |
| `exact` | identical once canonicalised | correct |
| `equivalent` | different form, same value | correct |
| `rounded` | a rounded decimal of the exact answer | correct, with a note |
| `wrong` | parsed on both sides, genuinely differs | wrong |
| `unparsed` | one side is not maths we can read | one Gemini call — `answerCheck.adjudicateAnswer` |

Only `unparsed` escalates to the model. A confidently wrong answer is wrong; paying for a second opinion
on every miss would be most of the Gemini budget. An adjudication that overturns the verdict also files a
`questionReports` row — an answer our parser cannot read is usually a badly formatted question, and the
bank is machine-authored.

**Adding an answer type:** put it in `AUTO_GRADED_TYPES` only if `matchAnswer` can decide it. Anything
else stays self-check. Every new form goes in the golden set in `convex/answerMatch.test.ts` — a row for
what must be accepted and, more importantly, a row for the near-miss that must still be rejected.

## Geometry justifications

`convex/geometryTheorems.ts` holds the curriculum's theorems with the aliases students actually write
(`צ.ז.צ` / `צזצ` / `צלע זווית צלע` / `SAS`). A justification is a *reference to a theorem*, not a sentence
to match, so both sides resolve to a theorem id and the ids are compared. Same theorem in the student's
own words is correct, deterministically, with no model call.

It is an identity match, not a similarity score — a different theorem is still wrong. Two details carry
that: token matching tolerates one glued Hebrew prefix (`במקבילית` reaches `מקבילית`), and `covers` is an
**ordered** subsequence, because צלע-זווית-צלע and זווית-צלע-זווית are different theorems built from the
same three words.

Where the student is right but informal, the step scores full marks and carries a `reasonPhrasingNote`
with the formal name. That was the whole complaint: the grader used to see one `expectedReason` string
and mark a correct justification wrong for being worded differently.

`acceptableReasons` on a proof step lists *other routes* to the same claim — not rephrasings, which the
matcher already handles.

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
