import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// e2e/ belongs to Playwright (`npm run test:e2e`), not vitest. Sibling git
// worktrees under .claude/ carry full copies of the suite — never scan them.
const EXCLUDE = ['**/node_modules/**', '**/e2e/**', '**/.claude/**', '**/.gemini/**'];

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'unit',
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: EXCLUDE,
    // Modules read VITE_CONVEX_URL at import time (localAI.gemini.ts), which
    // runs before any vi.stubEnv in a test file — inject it here instead.
    env: {
      VITE_CONVEX_URL: 'https://test.convex.cloud'
    },
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
