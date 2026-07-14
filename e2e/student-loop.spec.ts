import { test, expect } from "@playwright/test";

// Core student loop: role page → student home (learning map) → practice
// session → answer a question → review phase with feedback.
// Fixtures come from `npx convex run seedE2E:seed` (see playwright.config.ts).
const E2E_STUDENT = "תלמיד בדיקה";
const E2E_TOPIC_HE = "חשבון בסיסי (בדיקות)";

test("student answers a practice question end-to-end", async ({ page }) => {
  // Pre-authorize the PrototypeGate (localStorage flag) before first paint,
  // and ask for reduced motion so the map's pulse animations settle (the app
  // honors prefers-reduced-motion).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("faraday_prototype_auth", "true");
  });
  await page.goto("/");

  // Role page lists students from Convex — pick the seeded test student.
  await page.getByText(E2E_STUDENT).first().click();
  await expect(page).toHaveURL(/\/student\//);

  // Learning map: each topic is a SkillNode with aria-label = Hebrew name.
  await page.getByLabel(E2E_TOPIC_HE).first().click({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/practice\//);

  // A seeded question renders (all stems start with "כמה זה").
  await expect(page.getByText(/כמה זה/).first()).toBeVisible({ timeout: 20_000 });

  // Answer: click the first choice card (A). Selection auto-submits.
  const choice = page.locator("button", { has: page.locator("text=A") }).first();
  await choice.click();

  // Review phase: the countdown / next-question button appears regardless of
  // whether the picked answer was right or wrong.
  await expect(
    page.getByRole("button", { name: /שאלה הבאה|s\.\.\./ }).first()
  ).toBeVisible({ timeout: 15_000 });
});
