import { describe, it, expect } from "vitest";
import { consentDateError } from "./classroom";

// The failure this guards against is a promise, not a crash: the parental
// consent form (docs/parental-consent-he.md) tells parents that nothing starts
// before a signed form comes back. addStudent is the only public door into the
// students table, so if this check is loose, that sentence stops being true and
// nothing anywhere else notices.
describe("consentDateError", () => {
  const TODAY = "2026-09-07";

  it("accepts a signed form dated today or earlier", () => {
    expect(consentDateError("2026-09-07", TODAY)).toBeNull();
    expect(consentDateError("2026-08-31", TODAY)).toBeNull();
  });

  it("rejects a missing or malformed date", () => {
    for (const bad of ["", "   ", "07/09/2026", "2026-9-7", "אתמול"]) {
      expect(consentDateError(bad, TODAY)).toMatch(/לא תקין/);
    }
  });

  // Date.parse("2026-13-45") is NaN, but Date.parse("Sep 7 2026") is not — the
  // shape check is what keeps a free-text date out of the field.
  it("rejects a well-shaped date that is not a real day", () => {
    expect(consentDateError("2026-13-45", TODAY)).toMatch(/לא תקין/);
  });

  it("rejects a future date — nobody has a form that has not been signed yet", () => {
    expect(consentDateError("2026-09-08", TODAY)).toMatch(/בעתיד/);
    expect(consentDateError("2027-01-01", TODAY)).toMatch(/בעתיד/);
  });
});
