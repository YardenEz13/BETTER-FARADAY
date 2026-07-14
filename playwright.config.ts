import { defineConfig, devices } from "@playwright/test";

// E2E smoke suite. Prerequisites (run once before `npm run test:e2e`):
//   1. A Convex backend the app can reach — either `npx convex dev` (local
//      anonymous deployment; writes VITE_CONVEX_URL into .env.local) or the
//      cloud dev deployment.
//   2. Seeded fixtures: `npx convex run seedE2E:seed`
// The Vite dev server is started (or reused) automatically below.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:1913",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1913",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
