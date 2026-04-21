# Faraday Project

Welcome to the **Faraday Project** (formerly Cobalt Apollo). This platform provides an adaptive learning experience for students, featuring dynamic practice sessions, AI-driven hints, and real-time conceptual heatmap tracking for educators. 

## Key Features

- **Adaptive Math Practice**: Dynamically adjusts the difficulty of mathematical questions based on the student's mastery of the topic.
- **AI Math Tutor**: A built-in AI tutor using conversational UI panels to provide contextual hints, walk through solution steps, and assist with homework.
- **Interactive UI**: A rich, dynamic, dark-mode focused UI that includes:
  - Complex math formula keypad.
  - Interactive "Logical Proof" interface for 5-unit mathematics (e.g., probability, rational functions, trigonometry, and series).
  - Gamified elements, XP tracking, and learning streaks.
- **Hebrew Localization**: Full support for Hebrew interfaces designed for the Israeli educational system (high school curriculum math).

## Tech Stack

- **React & TypeScript**: Front-end framework.
- **Vite**: Ultra-fast build tool.
- **Framer Motion**: Smooth, micro-animated interactions.
- **Convex**: Real-time serverless database and backend functions.
- **MediaPipe Web LLM**: In-browser local AI execution for AI-augmented learning interactions without cloud latency.
- **Lucide React**: Clean iconography.

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Initialize Database**
   Connect your Convex backend and seed the database with initial topics, classrooms, and questions:
   ```bash
   npx convex dev --once
   npx convex run seed:seedDatabase
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

## Recent Fixes
- Addressed a major UI freezing bug ("טוען שאלות" infinite loading state) which occurred due to data mismatch upon translating the interface to Hebrew.
- Fallbacks in UI added for module completion.
- Re-seeded valid question associations across the newly translated topics.
