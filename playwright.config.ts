import { defineConfig, devices } from "@playwright/test";

// E2E smoke suite. Prerequisites (run once before `npm run test:e2e`):
//   1. A Convex backend the app can reach — either `npx convex dev` (local
//      anonymous deployment; writes VITE_CONVEX_URL into .env.local) or the
//      cloud dev deployment.
//   2. Seeded fixtures: `npx convex run seedE2E:seed`
// The Vite dev server is started (or reused) automatically below.
//
// Set E2E_BASE_URL to run against a deployed build instead — a Vercel preview,
// say. That skips the local dev server entirely, so the suite is testing the
// artifact that shipped rather than a fresh compile of the working tree:
//
//   E2E_BASE_URL=https://<branch>.vercel.app npm run test:e2e
//
// Seed the Convex backend *that build points at*, which is baked in at build
// time and is not necessarily the one .env.local names.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:1913";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Nothing to start when the target is already deployed.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
