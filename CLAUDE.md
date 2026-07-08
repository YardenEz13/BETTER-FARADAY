# Faraday Project (Cobalt Apollo) Instructions for Claude

## Claude Behavior Preferences
- Always use graphify for visualizations/diagrams in this project.
- Default to `/caveman` communication mode unless the user asks otherwise.

## Project Overview
Faraday Project (formerly Cobalt Apollo) is a next-generation adaptive learning platform for students, featuring dynamic math practice, an AI-driven math tutor (Michael Faraday), and real-time conceptual heatmap tracking for educators. The project is specifically tailored for the Israeli educational system (high school curriculum math).

## Technology Stack
- **Frontend Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4 + Vanilla CSS variables (`index.css` and `stitch-theme.css`)
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Math Rendering:** KaTeX
- **Backend/State:** Convex (Real-time sync and serverless functions)
- **AI Tutor:** Google Gemini API (via `src/services/localAI.ts` — the "Michael Faraday" tutor is a thin Gemini client, not an in-browser model)
- **Analytics Visualization:** Recharts
- **Testing:** Vitest, Testing Library, Playwright

## UI/UX & Design Philosophy
This project mandates a **premium, world-class aesthetic** with a "WOW" factor. The design language is the **"Faraday Logic" clay/electric system**: a bright, tactile, gamified surface (Duolingo-adjacent) fused with an electric-physics accent motif.
1. **Aesthetic Theme:** Bright, energetic, and playful-but-precise. The default surface is a **light theme** — near-white/soft-green backgrounds (`--color-background`, `--color-surface`) with a vivid **electric-green primary** (`--color-primary`), a **violet secondary** (`--color-secondary`), and an **amber tertiary** (`--color-tertiary`) reserved for streaks/energy. A dark mode exists via `ThemeContext` and must stay in sync. Drive everything from the CSS variables in `index.css` — never hardcode hex values.
2. **"Clay" depth, not glass:** The signature is the **clay card** (`.clay-card`, `.clay-btn`) — solid surfaces with a 2px border and a chunky offset "3D press" shadow (`--shadow-clay*`), giving a soft, tactile, button-like feel. Prefer this stacked/tactile depth over heavy blur; use `backdrop-blur` sparingly for translucent overlay panels only.
3. **Electric motif:** On-brand flourishes come from the in-house `electric` icon family and `FaradayCanvas` (the animated Faraday-cage / field-line backdrop). Nodes, wires, and accents should read as "charge flowing through a circuit." Keep these performant and gated on `useReducedMotion`.
4. **Dynamic Interactions:** The app must feel alive. Use micro-interactions, the clay press effect, subtle hover lifts, and Framer Motion for smooth page and state transitions. Avoid jarring jumps.
5. **Typography:** `Assistant` (Hebrew-first) for UI/headings, a mono face for `label-mono` eyebrow labels. Font weights (extrabold headings vs. medium body) establish hierarchy.

> Note: this project was formerly styled as a dark "deep-space cobalt/cyan" concept. That direction has been **retired** — the current light clay/electric-green system is the intended design. Do not reintroduce the dark-cobalt aesthetic.

## Mandatory Development Rules & Constraints
1. **RTL (Hebrew) Support is Mandatory:** The application is entirely in Hebrew. **All layouts must respect Right-To-Left alignment natively.** Use `dir="rtl"` standard practices and logical CSS properties (e.g., `marginStart` / `ms-`, `paddingInlineStart` / `ps-` in Tailwind). DO NOT use hardcoded left/right margins or paddings unless absolutely necessary for a non-directional visual tweak.
2. **KaTeX Integration:** Do not break KaTeX components. Remember that Hebrew text might occasionally appear inside math blocks, which is handled via `strict: "ignore"` in the KaTeX config.
3. **Responsive Design:** Ensure the application scales beautifully down to tablet and mobile, especially the AI Chat (`AIChatPanel.tsx`) and the Learning Map (`StudentDashboard.tsx`).
4. **Convex Data Fetching:** Do not break existing Convex hooks (`useQuery`, `useMutation`). Keep data fetching logic clean and separate from complex UI rendering logic when possible.
5. **Typescript:** Use strict typing. Ensure all interfaces and props are strongly typed.

## Key Areas of the Application
1. **Student Dashboard & Learning Map (`src/pages/StudentDashboard.tsx`):**
   - An immersive, gamified "skill tree" or galaxy map. Nodes pulse/glow based on state (locked, active, completed).
   - Clear animated progression (streaks, XP, levels).
2. **AI Chat Experience (`src/components/AIChatPanel.tsx`):**
   - The AI Tutor (Michael Faraday) interface should feel like an integrated, magical overlay.
   - Smooth streaming text, "AI is thinking" indicators, and flawless KaTeX equation blending.
3. **Teacher Dashboard (`src/pages/TeacherDashboard.tsx`):**
   - A high-end analytics command center.
   - Heatmap using elegant gradients and glowing dots instead of harsh red/green blocks.
   - Real-time alerts and milestones animating smoothly.
   - Beautiful Recharts graphs for statistics.

## Important Directories
- `/src/components`: Reusable UI components.
- `/src/pages`: Top-level page components and views.
- `/src/services`: Non-UI logic, external integrations.
- `/src/index.css`: Global styles, Tailwind base imports, and CSS variables.
- `/convex`: Contains the Convex backend schema, mutations, queries, and generated files.

## Common Development Commands
- `npm install`: Install dependencies.
- `npx convex dev --once`: Initialize the database schema locally.
- `npx convex run seed:seedDatabase`: Seed the database with initial topics, classrooms, and questions.
- `npm run dev`: Start the Vite development server.
- `npm run build`: Build for production using TypeScript and Vite.
- `npm run lint`: Run ESLint.
- `npm run test`: Run unit tests with Vitest.

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

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- `graphify` is installed under the user's Python Scripts dir (`%APPDATA%\Python\Python314\Scripts\graphify.exe`), which was added to the user PATH on 2026-07-02. If `graphify` is ever "not recognized" (e.g. a fresh shell before PATH propagates, or the PATH entry gets reset), invoke it by full path instead: `& "$env:APPDATA\Python\Python314\Scripts\graphify.exe" <command>` (PowerShell) or `"/c/Users/yarde/AppData/Roaming/Python/Python314/Scripts/graphify.exe" <command>` (bash).
