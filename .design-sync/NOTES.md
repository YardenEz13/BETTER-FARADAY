# Design-sync notes — cobalt-apollo / Faraday Electric Components

## Key facts

- This is an **app** project (not a published library). `node_modules/cobalt-apollo` does not exist.
  The entry is `src/components/electric/index.ts` (hand-authored, re-exports all electric components).
- CSS uses **Tailwind v4** (Vite plugin, not PostCSS). `src/index.css` uses `@import "tailwindcss"` —
  esbuild cannot process this directly. CSS is scraped from `.design-sync/sb-reference` via [CSS_FROM_STORYBOOK].
- The storybook preview (`stitch-theme.css`) also contains CSS variables. It is imported in `.storybook/preview.tsx`
  alongside `src/index.css`, so both are included in the storybook build and will be scraped.
- Stories import components via **relative paths** (e.g., `from './icons'`), NOT from a package name.
  The story-imports resolver should handle this by redirecting to `window.CobaltApollo.*`.
- The `withAppTheme` decorator (in `.storybook/preview.tsx`) sets `data-theme` on `<html>` and `<body>`,
  and sets `dir="rtl"`. This is bundled as preview decorators automatically.
- **SVG SMIL animations**: all electric icons use `<animate>` / `<animateMotion>` elements with
  `repeatCount="indefinite"`. The compare harness fast-forwards/freezes animations for grading.
  Shipped previews are fully animated.
- `ElectricLoader` uses Tailwind utility classes (`flex`, `flex-col`, `items-center`, `gap-4`,
  `animate-[spin_6s_linear_infinite]`, `text-sm`, `font-semibold`, `text-primary`, `tracking-widest`,
  `min-h-screen`, `bg-background`). These require compiled Tailwind CSS to render correctly.
- Fonts: Google Fonts (Assistant, JetBrains Mono) are loaded via CDN in `src/index.css`. The local
  Yarden font is loaded from `src/assets/YardenAlefAlefAlef/web/`. The electric components only use
  Assistant (labels in ElectricLoader) — Yarden is display-only and not needed for these components.
- RTL: all components are RTL-aware. The story canvas has `dir="rtl"` via the decorator.

## Re-sync risks

(To be filled after first sync completes.)
