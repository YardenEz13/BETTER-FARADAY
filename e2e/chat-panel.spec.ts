import { test, expect } from "@playwright/test";

// The AI chat panel had no e2e at all, and §8 of docs/pilot-plan.md calls it one
// of the two paths most likely to break in front of a class.
//
// This covers opening it, not answering from it. Asserting on a real reply means
// a live Gemini call per run: money, a rate limiter, and a non-deterministic
// string to match. The open path is where the breakage actually lives — a panel
// that fails to mount, or mounts behind the question card — and it is free.
const E2E_STUDENT = "תלמיד בדיקה";
const E2E_TOPIC_HE = "חשבון בסיסי (בדיקות)";

test("the AI chat panel opens from a practice session", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("faraday_prototype_auth", "true");
    // The tour otherwise sits over the button this test clicks.
    localStorage.setItem("faraday_tour_done", "true");
  });
  await page.goto("/");

  await page.getByText(E2E_STUDENT).first().click();
  await expect(page).toHaveURL(/\/student\//);
  await page.getByLabel(E2E_TOPIC_HE).first().click({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/practice\//);
  await expect(page.getByText(/כמה זה/).first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "שאל את פאראדיי" }).first().click();

  // The greeting is rendered by the panel's empty state — no model call.
  await expect(page.getByText(/שלום, אני פרופסור פאראדיי/).first())
    .toBeVisible({ timeout: 15_000 });
});
