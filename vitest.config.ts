import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
// e2e/ belongs to Playwright (`npm run test:e2e`), not vitest. Sibling git
// worktrees under .claude/ carry full copies of the suite — never scan them.
const EXCLUDE = ['**/node_modules/**', '**/e2e/**', '**/.claude/**', '**/.gemini/**'];
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  // The "storybook" project runs on vitest's browser-mode module runner,
  // which requires a newer vite (nested vite@8.1.5, rolldown/oxc-based) than
  // the app's own vite@5.4.10. That rolldown-based dep optimizer sometimes
  // fails to synthesize named ESM exports from certain CJS packages pulled in
  // transitively by @storybook/addon-vitest's test setup — pre-bundling them
  // explicitly here works around it.
  optimizeDeps: {
    include: ['aria-query', 'lz-string', 'pretty-format'],
  },
  test: {
    projects: [{
      extends: true,
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
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        exclude: EXCLUDE,
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});