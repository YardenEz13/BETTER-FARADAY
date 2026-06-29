# Faraday Project (Cobalt Apollo) Instructions for Claude

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
- **Local AI:** MediaPipe Web LLM (In-browser local AI execution without cloud latency)
- **Analytics Visualization:** Recharts
- **Testing:** Vitest, Testing Library, Playwright

## UI/UX & Design Philosophy
This project mandates a **premium, world-class aesthetic** with a "WOW" factor.
1. **Aesthetic Theme:** "Advanced Physics / Logic" – Think deep space blues, cobalt, electric cyan, and sleek dark surfaces. Avoid generic colors.
2. **Depth & Glassmorphism:** Utilize subtle background blurs, multi-layered shadows, and semi-transparent surfaces to create depth without visual clutter.
3. **Dynamic Interactions:** The app must feel alive. Use micro-interactions, subtle hover states, and Framer Motion for smooth page and state transitions. Avoid jarring jumps.
4. **Typography:** Modern, highly readable fonts. Font weights should be used strategically to establish clear visual hierarchy.

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
