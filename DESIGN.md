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

`.num` is also bidi-isolated (`direction: ltr; unicode-bidi: isolate`), the same protection `.katex`
gets. A lone `1,240` survives a Hebrew line but a multi-part readout does not — in `3 / 10` the spaces
around the separator take the paragraph's direction and the two operands swap, so the student is told
they finished 10 out of 3. **Because `direction` also orders flex children, `.num` goes on the numeral
itself, never on a row that also holds an icon** — that is why `Stat` wraps its value in its own span.

`.num` and `.label-mono` both stack `JetBrains Mono` over `Assistant` deliberately: the mono face
carries no Hebrew, so Hebrew falls through to Assistant and only the digits and Latin get the voltmeter
face. Eyebrow labels take **no** `uppercase` and no wide tracking — Hebrew has no case, so the pair only
pushed the letters apart and cost legibility. The Faraday eyebrow gesture is `.label-tick` instead: a
terminal stub on the inline-start, the wire landing on the label (`.label-tick--live` for the volt
version). It is opt-in, because `.label-mono` is used inline as often as it is used as a block eyebrow.

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

### The light source

The clay is lit from above, and three tokens carry that:

| Token | Role |
|---|---|
| `--color-clay-lip` | the lit top edge — `.clay-card` sets it as `border-block-start-color` |
| `--color-clay-riser` | the shaded side wall: the offset in `--shadow-clay` **and** the card's `border-block-end-color` |
| `--clay-highlight` | the sheen just inside the lip (`inset 0 1px 0`) |

The bottom border and the riser must stay the same colour. A border even a shade off the riser puts a
seam between them, and the card goes back to reading as a drawn box standing on a slab. `--color-clay-lip`
inverts in dark: on lab ink a lit edge is *brighter* than the outline, where on paper it is lighter.

## Backdrops

Four layers can sit behind a screen. The first two are free and global; the last two are opt-in.

| Layer | Where it lives | Scope |
|---|---|---|
| **Ground** | `body::before`, one fixed pseudo-element | every page |
| **Dot field** | a second `background-image` on that same pseudo-element | every page |
| **Field lines** | `ElectricField`, absolutely positioned in a container | hero surfaces, `EmptyState` |
| **Canvas** | `FaradayCanvas` / `NightSkyCanvas` | the 8 flagship pages, tied to the equipped shop theme |

The ground and the dot field are one fixed layer at `z-index: -1`, so they cost a single composited
paint, never repaint on scroll, and reach all 21 pages rather than the 8 that mount a canvas. It is
`fixed` rather than a `<body>` background so the gradient is sized to the viewport instead of stretching
down a long page. Tokens: `--bg-lift` (the light the clay is lit by, arriving from above the fold),
`--bg-sink` (where the page settles at the bottom), `--grid-dot` and `--grid-size`. All four invert in
dark, where the lift becomes a faint volt bloom rather than white.

**Never hand-roll a fixed backdrop div in a page.** That is what `TeacherDashboard` used to do, and it
is why exactly one page had a dot field. If a page needs more than the ground, it mounts `ElectricField`
in a container, or a canvas.

`ElectricField` animates with SMIL (`<animate>`, `<animateMotion>`), not CSS — so `animation: none` does
**not** stop it, and neither does the reduced-motion block at the bottom of `index.css`. It takes
`useReducedMotion()` and simply does not render the animate elements, leaving a still frame. Pass
`className="electric-field"` when you mount it: focus mode hides that class outright, and since none of
this is canvas, hiding it genuinely stops the work.

In focus mode the **ground stays** and everything else goes — it is static, and it is what keeps the page
from reading as a flat sheet, while a repeating pattern behind text is exactly what that mode exists to
remove. `prefers-contrast: more` drops the dot field for the same reason.

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

## States

These are defined once in `src/index.css` and must not be re-implemented per component. Every one of
them used to be a browser or framework default; each now says something in the app's own vocabulary.

**Keyboard focus — the current loop.** Two layers with two different jobs, and only one of them is
load-bearing. The `outline` (3px `primary-dark`, 2px offset) carries the contrast on its own: it is an
outline rather than a `box-shadow` so it leaves the clay riser alone and survives forced-colors mode.
On top of it a `::after` rides the component's own 2px border and runs the same current down it that
`.progress-current-glow` runs along an XP bar — the same 115° repeating gradient, the same 1.1s
`progress-current-flow`, the same `--color-inverse-primary` spark. That half is identity only, and it
needs no gate: `[data-focus="on"] *::after` and the reduced-motion block both stop it, leaving the
outline that was doing the work anyway.

The clay primitives get it automatically. A bespoke control opts in with **`.focus-loop`**, which buys
the ring without inheriting a primitive's padding and borders.

**Disabled — de-energised.** Never `opacity`. Fading a clay control dims its riser too, so it loses its
volume and reads as a rendering fault, and the label drops under contrast on the way. Instead the
colour drains to the neutral rail at full opacity, and `.btn-clay-primary` / `-secondary` add an
open-contact glyph (`--icon-open-contact`, painted as a mask so it takes `currentColor`). If you are
adding a disabled style to a bespoke button, use these classes rather than a new `disabled:opacity-*`.

**Text selection.** `::selection` is volt-tinted and the text keeps `--color-on-surface`. Don't override
it locally.

Three more browser defaults are claimed centrally, and none of them should ever be set per-component:
`caret-color` on `.field`, `accent-color` on `:root` (native checkbox / radio / range paint themselves
from it), and the Firefox scrollbar. That last one is fenced behind
`@supports not selector(::-webkit-scrollbar)` on purpose: Chrome and Safari drop their own
`::-webkit-scrollbar` styling the moment a standard scrollbar property is set, so the fence is what lets
Firefox be themed without costing Chrome the 6px bar and its hover tint.

**Touch.** The reset does **not** kill `-webkit-tap-highlight-color` — it is a volt tint on `:root`, and
the clay controls opt out of it because they answer a finger with their own press. Anything else you
make tappable inherits it and needs nothing.

**Increased contrast.** `@media (prefers-contrast: more)` darkens the structural tokens (`--color-outline`,
`--color-on-surface-variant`, and the two clay faces) in both themes. The accents already carry their
weight and stay put. Add new structural tokens to that block when you add them.

**Scroll targets.** `scroll-behavior` is smooth app-wide and four screens carry a `fixed top-0` header,
so `[id]` reserves `--header-h` worth of `scroll-margin-block-start`. Keep `--header-h` honest if a
header's height changes.

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

Two policies inside it are load-bearing and were both set by an adversarial pass that broke the first
version. Rounding is allowed **to the precision the student actually wrote** — "1.414" claims three
decimals and is a fair rounding of √2, while "1004" claims integer precision and is simply not 1000; the
flat 0.5% tolerance it replaced accepted both. And the sample points **straddle zero**, because an
all-positive sample set cannot tell `abs(x)` from `x`.

One known gap, left deliberately: `1,5` is read as two answers, not as 1.5. Israeli notation uses a
decimal point, and treating the comma as a decimal separator would break every solution set.

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
3. Physical `ml/mr`, `pl/pr`, `left/right`, `border-l/r`, `rounded-l/r` and `text-left/right` in
   `src/**/*.tsx` — **fails the build if the count grows**. Rule 3 below was the one rule nothing
   measured, which is how four notification badges came to be pinned with `-right-*` and sat on the
   wrong corner. Some physical values are legitimate (a full-bleed `left-0 right-0`, a `left-1/2`
   centre), so this is a growth ratchet rather than a ban: everything present today is baselined and
   only new ones fail.

Counts *below* baseline are allowed silently — the script only complains about regressions. When you
migrate legacy code and reduce a file's count, run:

```
node scripts/design-lint.mjs --update
```

`--update` is monotonic: it writes the **lower** of (baseline, current) for every file, so re-baselining
one metric can never quietly raise the ceiling on another. A file the scan no longer sees is dropped; a
file new to the scan enters at its current count, which is how a newly added metric gets its first
baseline.

To deliberately accept a **higher** count — a genuinely physical `left-1/2` centre, say — pass
`--update --relax`. It is a separate flag so the decision shows up in the diff instead of riding along
with an unrelated re-baseline. Never hand-edit `scripts/design-lint-baseline.json`.
