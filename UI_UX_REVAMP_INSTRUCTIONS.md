# UI/UX Revamp Brief: FARADAY Logic (Cobalt Apollo)

## Overview
You are tasked with a comprehensive UI/UX revamp of the **FARADAY Logic** (project codename: Cobalt Apollo) educational platform. This platform is a next-generation math and logic learning environment that features a Student Dashboard (with a learning map, interactive math steps, and AI teacher chat) and a Teacher Dashboard (with real-time heatmaps, live alerts, and pedagogical analytics).

The current design is functional but needs to be elevated to a **premium, world-class aesthetic**. We want users to say "WOW" when they open the app. 

## Technology Stack
- **Frontend Framework:** React 18 (Vite)
- **Styling:** Tailwind CSS v4 + Vanilla CSS variables (`index.css`)
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Math Rendering:** KaTeX (Strict mode ignored for Hebrew compatibility)
- **Backend/State:** Convex (Real-time sync)

## Design Philosophy & Aesthetics
1. **Premium & State-of-the-Art:** Move away from basic UI components. Implement a highly polished, modern interface (think Apple/Linear/Vercel level of polish, but tailored for a futuristic educational tool).
2. **Dynamic & Alive:** The app should feel highly responsive. Use micro-interactions, subtle hover states, and smooth Framer Motion page transitions.
3. **Glassmorphism & Depth:** Utilize subtle background blurs, multi-layered shadows, and semi-transparent surfaces to create depth without visual clutter.
4. **Color Palette:** 
   - Avoid generic red/blue/green. Use a curated, harmonious palette (e.g., sleek dark mode with vibrant, neon-like accents for primary actions and success states).
   - The primary theme is "Faraday / Advanced Physics / Logic" – think deep space blues, cobalt, electric cyan, and sleek dark surfaces.
5. **Typography:** Use modern, highly readable fonts (e.g., Inter, Outfit, or Rubik for Hebrew support). Font weights should be used strategically to establish clear visual hierarchy.

## Key Areas to Revamp

### 1. Student Dashboard & Learning Map (`StudentDashboard.tsx`)
- **The Map:** Currently a vertical node-based path. Make it look like an immersive, gamified "skill tree" or galaxy map. Nodes should pulse or glow based on their state (locked, active, completed).
- **Progress Tracking:** Give the user a clear, beautifully animated sense of progression (streaks, XP, levels).

### 2. AI Chat Experience (`AIChatPanel.tsx`)
- **The AI Tutor (Michael Faraday):** The chat interface should feel distinct from standard ChatGPT clones. It needs to feel like an integrated, magical overlay.
- **Math Rendering:** Ensure KaTeX equations blend perfectly with the chat bubbles (proper line heights, colors, and paddings).
- **Typing Animations:** Implement smooth streaming text and "AI is thinking" indicators.

### 3. Teacher Dashboard (`TeacherDashboard.tsx`)
- **The Heatmap:** Needs to be highly scannable but beautiful. Instead of harsh red/green/yellow blocks, use elegant gradients, glowing dots, and subtle borders to indicate student risk levels.
- **Real-Time Insights Panel:** The alerts and milestones should look like a command center feed. Smoothly animate new events as they come in.
- **Analytics Cards:** Upgrade the statistical cards with Recharts (already in dependencies) or custom CSS graphs that are visually stunning.

## UX Rules & Constraints
1. **RTL Support is Mandatory:** The application is entirely in **Hebrew**. All layouts, margins, paddings, and flex directions must respect Right-To-Left alignment natively. (Use `dir="rtl"` standard practices and logical CSS properties like `marginStart` / `ms-` in Tailwind if needed).
2. **KaTeX Integration:** Do not break the KaTeX components. Remember that Hebrew text might occasionally appear inside math blocks, which is handled via `strict: "ignore"` in the KaTeX config.
3. **Responsive Design:** Ensure the application scales beautifully down to tablet and mobile, especially the AI Chat and the Learning Map.
4. **Do Not Break Convex Hooks:** Keep all `useQuery` and `useMutation` hooks intact. Focus your changes on the JSX layout, Framer Motion wrappers, and CSS classes.

## Action Plan for Stitch
1. Start by auditing and overhauling `index.css` to establish a new robust system of CSS variables (colors, spacing, shadows).
2. Revamp the global layout wrapper and sidebar/topbar components.
3. Overhaul the Student experience (Learning Map & Chat).
4. Redesign the Teacher Dashboard to look like a high-end analytics command center.
5. Add Framer Motion transitions between all major state changes.
