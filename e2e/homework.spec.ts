import { test, expect, type Locator, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * Homework submission — the gap §8 of docs/pilot-plan.md leaves open, and the
 * only e2e that exercises the answer editor and the grader together.
 *
 * It drives the exact path that was broken in both directions: a square root
 * was unenterable (MathLive's shortcut needs the Latin letters "sqrt" and the
 * student is on a Hebrew keyboard) and then graded wrong (the bank stores "√2"
 * as plain Unicode while the editor emits "\sqrt{2}", and the old checker
 * compared strings).
 *
 * Wrong answer first, then the retry, then the root. One assignment, one pass:
 * the fixture is shared and durable, so a test that only ever submitted a
 * correct answer would leave the section closed for the next run. Asserting
 * the wrong answer matters on its own — the checker this replaced accepted any
 * answer longer than five characters, which "correct answers pass" would never
 * have caught.
 *
 * Fixtures: `npx convex run seedE2E:seed` creates the homework, the compound
 * question and the assignment. Its stored answer is √2 (E2E_HOMEWORK_ANSWER).
 */

// A correctly answered section renders its verdict instead of the answer field
// and offers no retry, so the fixture has to be reopened before each test —
// otherwise the first project to pass closes it for the second.
test.beforeEach(() => {
  execSync("npx convex run seedE2E:resetHomework", { stdio: "ignore" });
});

const E2E_STUDENT = "תלמיד בדיקה";
const E2E_HOMEWORK = "שיעורי בית לבדיקה E2E";

/**
 * Empty the answer field. "ניסיון חוזר" deliberately keeps the previous answer so
 * the student can edit it, and the fixture is reused between runs, so every
 * attempt has to start by clearing what is already there. MathLive ignores
 * ctrl+A, so this deletes the way a student does.
 */
async function clearField(page: Page, field: Locator) {
  await field.click();
  await page.keyboard.press("End");
  for (let i = 0; i < 80; i++) {
    const latex = await field.evaluate((el: Element & { value?: string }) => el.value ?? "");
    if (latex === "") return;
    await page.keyboard.press("Backspace");
  }
  throw new Error("could not clear the answer field");
}

/**
 * Put text in the answer field. `keyboard.type` sends synthetic keydowns, which
 * MathLive ignores on a touch profile (it opens its own keypad there and takes
 * input through the IME path instead), so the mobile project saw an empty field
 * and a disabled submit. `insertText` is the IME path — what a phone's soft
 * keyboard actually delivers — and works on both.
 */
async function typeIntoField(page: Page, field: Locator, text: string) {
  await field.click();
  await page.keyboard.insertText(text);
  await expect
    .poll(() => field.evaluate((el: Element & { value?: string }) => el.value ?? ""), { timeout: 10_000 })
    .not.toBe("");
}

async function openTheAssignment(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("faraday_prototype_auth", "true");
    // The tour otherwise sits over the controls this test clicks.
    localStorage.setItem("faraday_tour_done", "true");
  });
  await page.goto("/");

  await page.getByText(E2E_STUDENT).first().click();
  await expect(page).toHaveURL(/\/student\//);

  await page.getByRole("button", { name: "שיעורי בית" }).first().click();
  await expect(page).toHaveURL(/\/homework/);

  await page.getByText(E2E_HOMEWORK).first().click({ timeout: 20_000 });

  // The assignment opens on a list of its questions, not on a question. The
  // preamble and the answer editor mount only once a card is opened.
  await page.getByText(/סעיף אחד/).first().click({ timeout: 20_000 });
  await expect(page.getByText(/שאלת E2E/).first()).toBeVisible({ timeout: 20_000 });

  // The fixture survives between runs, so the section may already carry a
  // verdict from last time. Reopen it rather than depending on a clean database.
  const retry = page.getByRole("button", { name: /ניסיון חוזר/ });
  if (await retry.first().isVisible().catch(() => false)) await retry.first().click();

  const field = page.locator("math-field").first();
  await expect(field).toBeVisible({ timeout: 20_000 });
  return field;
}

test("homework grades a wrong answer wrong, and a root typed from the strip right", async ({ page }) => {
  const field = await openTheAssignment(page);

  // ── A wrong answer, deliberately over five characters ──
  await clearField(page, field);
  await typeIntoField(page, field, "123456");
  await page.getByRole("button", { name: /בדיקת תשובה/ }).first().click();
  await expect(page.getByText(/התשובה שגויה/).first()).toBeVisible({ timeout: 20_000 });

  // ── Retry, and enter √2 the way a Hebrew-keyboard student has to ──
  await page.getByRole("button", { name: /ניסיון חוזר/ }).first().click();
  await expect(field).toBeVisible({ timeout: 10_000 });
  await clearField(page, field);
  // The chip is the only route to a radical without a Latin keyboard.
  await page.getByRole("button", { name: "שורש ריבועי" }).first().click();
  await page.keyboard.insertText("2");

  // What the editor actually produced, before anything is graded on it.
  await expect
    .poll(() => field.evaluate((el: Element & { value?: string }) => el.value ?? ""), { timeout: 10_000 })
    .toContain("sqrt");

  await page.getByRole("button", { name: /בדיקת תשובה/ }).first().click();

  // Graded server-side against the stored "√2". A string compare fails here.
  await expect(page.getByText(/התשובה נכונה/).first()).toBeVisible({ timeout: 20_000 });
});
