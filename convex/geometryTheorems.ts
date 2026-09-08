/**
 * geometryTheorems — the standard justifications a proof step can rest on.
 *
 * Why this exists: `gradeProofSection` used to hand Gemini a single
 * `expectedReason` string ("צ.ז.צ (SAS)") and ask whether the student's reason
 * was right. At temperature 0.1 the model anchors on that wording, so a
 * student who writes "צלע זווית צלע" or "כי במקבילית האלכסונים חוצים זה את זה"
 * — the same theorem, their own words — was told their justification was wrong.
 * That is the complaint this file answers.
 *
 * A justification is a *reference to a named theorem*, not a sentence to be
 * matched. So resolve both sides to a theorem id and compare the ids. Same
 * theorem, any phrasing, is correct — deterministically, with no model call
 * and no cost. A different theorem is still wrong, which is the whole point:
 * this is an identity match, not a similarity score.
 *
 * `aliases` are how students and textbooks actually write each one, including
 * the abbreviations (צ.ז.צ / צזצ / SAS). Matching is prefix-tolerant, so
 * "במקבילית" reaches "מקבילית" without a Hebrew stemmer.
 *
 * Pure module — the grader uses it server-side, the UI uses it to offer the
 * list, and the tests hold it to both.
 */

export interface Theorem {
  id: string;
  /** The formal name, shown back to a student who phrased it informally. */
  canonicalHe: string;
  /** Ways it actually gets written. The canonical name is matched too. */
  aliases: string[];
  group: string;
}

export const THEOREM_GROUPS = [
  "זוויות וישרים",
  "משולשים",
  "חפיפה ודמיון",
  "מרובעים",
  "מעגל",
  "אנליטית",
] as const;

export const THEOREMS: Theorem[] = [
  // ── זוויות וישרים ──
  { id: "vertical-angles", group: "זוויות וישרים", canonicalHe: "זוויות קודקודיות שוות",
    aliases: ["זוויות קודקוד שוות", "זוויות קודקודיות", "קודקודיות", "זוויות ראש"] },
  { id: "adjacent-angles", group: "זוויות וישרים", canonicalHe: "זוויות צמודות משלימות ל-180°",
    aliases: ["זוויות צמודות", "צמודות משלימות", "סכום זוויות צמודות 180"] },
  { id: "alternate-angles", group: "זוויות וישרים", canonicalHe: "זוויות מתחלפות בין ישרים מקבילים שוות",
    aliases: ["זוויות מתחלפות שוות", "מתחלפות", "זוויות מתחלפות"] },
  { id: "corresponding-angles", group: "זוויות וישרים", canonicalHe: "זוויות מתאימות בין ישרים מקבילים שוות",
    aliases: ["זוויות מתאימות שוות", "מתאימות", "זוויות מתאימות"] },
  { id: "cointerior-angles", group: "זוויות וישרים", canonicalHe: "זוויות חד-צדדיות משלימות ל-180°",
    aliases: ["זוויות חד צדדיות", "חד צדדיות", "זוויות שוכנות מנגד"] },
  { id: "perpendicular", group: "זוויות וישרים", canonicalHe: "ישרים מאונכים יוצרים זווית של 90°",
    aliases: ["מאונך", "מאונכים", "זווית ישרה", "אנך"] },
  { id: "perp-bisector", group: "זוויות וישרים", canonicalHe: "נקודה על אנך אמצעי נמצאת במרחק שווה מקצות הקטע",
    aliases: ["אנך אמצעי", "אנך אמצעי לקטע"] },
  { id: "angle-bisector", group: "זוויות וישרים", canonicalHe: "חוצה זווית מחלק את הזווית לשתי זוויות שוות",
    aliases: ["חוצה זווית", "חוצה הזווית", "חצי זווית"] },

  // ── משולשים ──
  { id: "triangle-sum", group: "משולשים", canonicalHe: "סכום זוויות במשולש הוא 180°",
    aliases: ["סכום הזוויות במשולש", "סכום זוויות משולש 180", "זוויות במשולש 180"] },
  { id: "exterior-angle", group: "משולשים", canonicalHe: "זווית חיצונית שווה לסכום שתי הזוויות הפנימיות שאינן צמודות לה",
    aliases: ["זווית חיצונית למשולש", "זווית חיצונית", "משפט הזווית החיצונית"] },
  { id: "isosceles-base-angles", group: "משולשים", canonicalHe: "במשולש שווה שוקיים זוויות הבסיס שוות",
    aliases: ["זוויות הבסיס שוות", "משולש שווה שוקיים זוויות בסיס", "שווה שוקיים זוויות בסיס"] },
  { id: "isosceles-converse", group: "משולשים", canonicalHe: "מול זוויות שוות במשולש מונחות צלעות שוות",
    aliases: ["מול זוויות שוות צלעות שוות", "משולש עם שתי זוויות שוות הוא שווה שוקיים"] },
  { id: "isosceles-apex", group: "משולשים", canonicalHe: "במשולש שווה שוקיים התיכון לבסיס הוא גם גובה וחוצה זווית הראש",
    aliases: ["תיכון לבסיס גם גובה", "במשולש שווה שוקיים התיכון לבסיס", "גובה לבסיס הוא תיכון"] },
  { id: "equilateral", group: "משולשים", canonicalHe: "במשולש שווה צלעות כל הזוויות שוות ל-60°",
    aliases: ["משולש שווה צלעות", "שווה צלעות 60"] },
  { id: "midsegment", group: "משולשים", canonicalHe: "קטע אמצעים במשולש מקביל לצלע השלישית ושווה למחציתה",
    aliases: ["קטע אמצעים", "קטע האמצעים במשולש", "משפט קטע האמצעים"] },
  { id: "median-hypotenuse", group: "משולשים", canonicalHe: "התיכון ליתר במשולש ישר זווית שווה למחצית היתר",
    aliases: ["תיכון ליתר", "התיכון ליתר שווה למחצית היתר"] },
  { id: "thirty-sixty", group: "משולשים", canonicalHe: "הצלע שמול זווית של 30° במשולש ישר זווית שווה למחצית היתר",
    aliases: ["מול זווית 30", "ניצב מול 30 חצי היתר"] },
  { id: "pythagoras", group: "משולשים", canonicalHe: "משפט פיתגורס",
    aliases: ["פיתגורס", "משפט פיתגורס", "pythagoras"] },
  { id: "thales-parallel", group: "משולשים", canonicalHe: "משפט תאלס — ישר מקביל לצלע חותך את שתי הצלעות האחרות ביחסים שווים",
    aliases: ["משפט תאלס", "תאלס", "תאלס מוכלל", "thales"] },
  { id: "greater-side-angle", group: "משולשים", canonicalHe: "מול הצלע הגדולה במשולש מונחת הזווית הגדולה",
    aliases: ["מול צלע גדולה זווית גדולה", "מול הזווית הגדולה הצלע הגדולה"] },

  // ── חפיפה ודמיון ──
  { id: "sas", group: "חפיפה ודמיון", canonicalHe: "צ.ז.צ — שתי צלעות והזווית שביניהן",
    aliases: ["צזצ", "צ ז צ", "צלע זווית צלע", "sas", "שתי צלעות והזווית שביניהן"] },
  { id: "asa", group: "חפיפה ודמיון", canonicalHe: "ז.צ.ז — שתי זוויות והצלע שביניהן",
    aliases: ["זצז", "ז צ ז", "זווית צלע זווית", "asa", "שתי זוויות והצלע שביניהן"] },
  { id: "sss", group: "חפיפה ודמיון", canonicalHe: "צ.צ.צ — שלוש צלעות",
    aliases: ["צצצ", "צ צ צ", "צלע צלע צלע", "sss", "שלוש צלעות שוות"] },
  { id: "saa", group: "חפיפה ודמיון", canonicalHe: "צ.ז.ז — צלע ושתי זוויות",
    aliases: ["צזז", "צ ז ז", "זווית זווית צלע", "aas", "saa"] },
  { id: "congruent-parts", group: "חפיפה ודמיון", canonicalHe: "במשולשים חופפים צלעות וזוויות מתאימות שוות",
    aliases: ["ממשולשים חופפים", "צלעות מתאימות במשולשים חופפים", "זוויות מתאימות במשולשים חופפים", "מחפיפת המשולשים"] },
  { id: "similar-aa", group: "חפיפה ודמיון", canonicalHe: "ז.ז — שתי זוויות שוות מוכיחות דמיון",
    aliases: ["זז", "ז ז", "זווית זווית", "aa", "שתי זוויות שוות דמיון"] },
  { id: "similar-ratio", group: "חפיפה ודמיון", canonicalHe: "במשולשים דומים יחס הצלעות המתאימות שווה",
    aliases: ["יחס דמיון", "ממשולשים דומים", "יחס הצלעות המתאימות", "מדמיון המשולשים"] },

  // ── מרובעים ──
  { id: "parallelogram-diagonals", group: "מרובעים", canonicalHe: "אלכסוני מקבילית חוצים זה את זה",
    aliases: ["אלכסוני מקבילית מחצים זה את זה", "אלכסונים במקבילית חוצים", "האלכסונים חוצים זה את זה"] },
  { id: "parallelogram-sides", group: "מרובעים", canonicalHe: "במקבילית צלעות נגדיות שוות ומקבילות",
    aliases: ["צלעות נגדיות במקבילית שוות", "צלעות נגדיות שוות ומקבילות", "במקבילית הצלעות הנגדיות שוות"] },
  { id: "parallelogram-angles", group: "מרובעים", canonicalHe: "במקבילית זוויות נגדיות שוות",
    aliases: ["זוויות נגדיות במקבילית שוות", "זוויות נגדיות שוות"] },
  { id: "parallelogram-proof", group: "מרובעים", canonicalHe: "מרובע שבו זוג צלעות נגדיות שוות ומקבילות הוא מקבילית",
    aliases: ["זוג צלעות נגדיות שוות ומקבילות מקבילית", "מרובע שאלכסוניו חוצים זה את זה הוא מקבילית"] },
  { id: "rectangle-diagonals", group: "מרובעים", canonicalHe: "אלכסוני מלבן שווים",
    aliases: ["אלכסוני מלבן שווים זה לזה", "במלבן האלכסונים שווים"] },
  { id: "rhombus-diagonals", group: "מרובעים", canonicalHe: "אלכסוני מעוין מאונכים וחוצים את זוויות המעוין",
    aliases: ["אלכסוני מעוין מאונכים", "במעוין האלכסונים מאונכים", "אלכסוני מעוין חוצים את הזוויות"] },
  { id: "rhombus-sides", group: "מרובעים", canonicalHe: "במעוין כל הצלעות שוות",
    aliases: ["כל הצלעות במעוין שוות", "מעוין כל הצלעות שוות"] },
  { id: "square-props", group: "מרובעים", canonicalHe: "בריבוע כל הצלעות שוות וכל הזוויות ישרות",
    aliases: ["ריבוע כל הצלעות שוות", "בריבוע כל הזוויות ישרות"] },
  { id: "trapezoid-midsegment", group: "מרובעים", canonicalHe: "קטע אמצעים בטרפז מקביל לבסיסים ושווה למחצית סכומם",
    aliases: ["קטע אמצעים בטרפז", "קטע האמצעים בטרפז"] },
  { id: "isosceles-trapezoid", group: "מרובעים", canonicalHe: "בטרפז שווה שוקיים זוויות הבסיס שוות והאלכסונים שווים",
    aliases: ["טרפז שווה שוקיים", "בטרפז שווה שוקיים האלכסונים שווים"] },
  { id: "quad-angle-sum", group: "מרובעים", canonicalHe: "סכום הזוויות במרובע הוא 360°",
    aliases: ["סכום זוויות במרובע", "זוויות במרובע 360"] },

  // ── מעגל ──
  { id: "radii-equal", group: "מעגל", canonicalHe: "רדיוסים באותו מעגל שווים",
    aliases: ["רדיוסים שווים", "רדיוסים באותו מעגל", "כל הרדיוסים שווים"] },
  { id: "inscribed-angle", group: "מעגל", canonicalHe: "זווית היקפית שווה למחצית הזווית המרכזית הנשענת על אותה קשת",
    aliases: ["זווית היקפית", "זווית היקפית וזווית מרכזית", "היקפית חצי מרכזית"] },
  { id: "inscribed-same-arc", group: "מעגל", canonicalHe: "זוויות היקפיות הנשענות על אותה קשת שוות",
    aliases: ["זוויות היקפיות על אותה קשת", "זוויות היקפיות שוות"] },
  { id: "thales-circle", group: "מעגל", canonicalHe: "זווית היקפית הנשענת על קוטר היא בת 90°",
    aliases: ["זווית היקפית על קוטר", "משפט תאלס במעגל", "זווית על הקוטר 90"] },
  { id: "tangent-radius", group: "מעגל", canonicalHe: "משיק למעגל מאונך לרדיוס בנקודת ההשקה",
    aliases: ["משיק מאונך לרדיוס", "המשיק מאונך לרדיוס בנקודת ההשקה"] },
  { id: "tangents-equal", group: "מעגל", canonicalHe: "שני משיקים למעגל מאותה נקודה שווים",
    aliases: ["משיקים מנקודה אחת שווים", "שני משיקים שווים"] },
  { id: "tangent-chord", group: "מעגל", canonicalHe: "הזווית בין משיק למיתר שווה לזווית ההיקפית הנשענת על אותו מיתר",
    aliases: ["זווית בין משיק למיתר", "משיק מיתר"] },
  { id: "chord-perp", group: "מעגל", canonicalHe: "אנך מהמרכז למיתר חוצה את המיתר",
    aliases: ["אנך למיתר חוצה אותו", "אנך מהמרכז למיתר", "המרכז חוצה את המיתר"] },
  { id: "cyclic-quad", group: "מעגל", canonicalHe: "במרובע חסום במעגל סכום זוויות נגדיות הוא 180°",
    aliases: ["מרובע חסום במעגל", "זוויות נגדיות במרובע חסום", "מרובע בן חסימה"] },
  { id: "equal-chords", group: "מעגל", canonicalHe: "מיתרים שווים במעגל נמצאים במרחק שווה מהמרכז",
    aliases: ["מיתרים שווים", "מיתרים שווים מרחק שווה מהמרכז"] },

  // ── אנליטית ──
  { id: "distance-formula", group: "אנליטית", canonicalHe: "נוסחת המרחק בין שתי נקודות",
    aliases: ["נוסחת המרחק", "מרחק בין שתי נקודות"] },
  { id: "midpoint-formula", group: "אנליטית", canonicalHe: "נוסחת אמצע קטע",
    aliases: ["אמצע קטע", "נוסחת האמצע"] },
  { id: "slope-parallel", group: "אנליטית", canonicalHe: "ישרים מקבילים בעלי שיפועים שווים",
    aliases: ["שיפועים שווים מקבילים", "מקבילים שיפוע שווה"] },
  { id: "slope-perp", group: "אנליטית", canonicalHe: "מכפלת השיפועים של ישרים מאונכים היא 1-",
    aliases: ["מכפלת השיפועים", "שיפועים מאונכים מכפלה מינוס אחד"] },
];

const BY_ID = new Map(THEOREMS.map((t) => [t.id, t]));

export const theoremById = (id: string): Theorem | undefined => BY_ID.get(id);

/* ────────────────────────────── matching ────────────────────────────── */

/** Words that carry no identifying information in a justification. */
const STOPWORDS = new Set([
  "כי", "לפי", "של", "את", "זה", "הם", "הן", "היא", "הוא", "לכן", "נובע", "ולכן",
  "משפט", "לפיכך", "בגלל", "מפני", "כיוון", "שכן", "אז", "יש", "כל", "על", "עם",
  "לפי משפט", "מתקיים", "נתון", "ידוע", "בגלל ש", "וגם", "גם", "או", "אם", "כאשר",
  "לכל", "בין", "אל", "מן", "כך", "ש",
]);

/** Prefixes Hebrew glues onto a noun; "במקבילית" is "מקבילית" for our purposes. */
const PREFIXES = "בהלכמשו";

/**
 * Strip niqqud, punctuation and abbreviation marks, fold final letters, and
 * split into content tokens. "צ.ז.צ (SAS)" and "צזצ" both reduce to ["צזצ","sas"]-ish
 * forms that the alias table can reach.
 */
export function normalizeHebrew(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[֑-ׇ]/g, "")        // niqqud / cantillation
    .replace(/[׳״'"`´’“”]/g, "")  // geresh, gershayim, quotes
    .replace(/[.,;:!?()[\]{}\-–—_/\\|]/g, " ")
    .replace(/°/g, " ")
    .toLowerCase()
    .replace(/[ם]/g, "מ").replace(/[ן]/g, "נ").replace(/[ץ]/g, "צ")
    .replace(/[ף]/g, "פ").replace(/[ך]/g, "כ")
    .replace(/\s+/g, " ")
    .trim()
    // Glue runs of single letters back into one token, so "צ.ז.צ", "צ ז צ" and
    // "צזצ" are the same word. Without this the tokens compare as an unordered
    // multiset and צ.ז.ז (SAA) is indistinguishable from ז.צ.ז (ASA) — two
    // different congruence theorems.
    .replace(/(?:^| )([\u05d0-\u05ea])(?: [\u05d0-\u05ea])+(?= |$)/g, (m) => (m.startsWith(" ") ? " " : "") + m.replace(/ /g, ""));
}

function tokens(text: string): string[] {
  return normalizeHebrew(text)
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w));
}

/** Two tokens match if they are equal, or differ only by one glued prefix. */
function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length > b.length) return tokenMatches(b, a);
  // a is the shorter one; b may carry one or two prefix letters.
  if (b.length - a.length === 1 && PREFIXES.includes(b[0]) && b.slice(1) === a) return true;
  if (b.length - a.length === 2 && PREFIXES.includes(b[0]) && PREFIXES.includes(b[1]) && b.slice(2) === a) return true;
  return false;
}

/**
 * Every token of `needle` appears in `hay`, **in order** — a subsequence match.
 *
 * Order is not decoration here: it is the difference between צלע-זווית-צלע and
 * זווית-צלע-זווית, two different congruence theorems built from the same three
 * words. An order-blind (multiset) match made SAS/ASA/SAA mutually
 * indistinguishable, which would have let a wrong justification pass as right.
 */
function covers(hay: string[], needle: string[]): boolean {
  if (needle.length === 0) return false;
  let i = 0;
  for (const h of hay) {
    if (i < needle.length && tokenMatches(h, needle[i])) i++;
  }
  return i === needle.length;
}

/**
 * Which theorem is this text referring to? Returns the id, or null when the
 * text names nothing we know.
 *
 * Scored by the number of tokens matched, so a specific alias
 * ("אלכסוני מעוין מאונכים") beats a vaguer one that also fits.
 */
export function resolveTheorem(text: string): string | null {
  const words = tokens(text);
  if (words.length === 0) return null;

  let best: { id: string; score: number } | null = null;
  for (const th of THEOREMS) {
    for (const alias of [th.canonicalHe, ...th.aliases]) {
      const aliasWords = tokens(alias);
      if (aliasWords.length === 0) continue;
      if (!covers(words, aliasWords)) continue;
      const score = aliasWords.length;
      if (!best || score > best.score) best = { id: th.id, score };
    }
  }
  return best?.id ?? null;
}

/**
 * Do these two justifications name the same theorem? Null-safe: two texts that
 * resolve to nothing are NOT declared equal — an unrecognised reason is for the
 * model to judge, not for this to wave through.
 */
export function sameTheorem(a: string, b: string): boolean {
  const ida = resolveTheorem(a);
  if (!ida) return false;
  return ida === resolveTheorem(b);
}

/** The formal name for a theorem the student referred to informally. */
export function canonicalNameOf(text: string): string | null {
  const id = resolveTheorem(text);
  return id ? (BY_ID.get(id)?.canonicalHe ?? null) : null;
}

/* ───────────────────────── judging a justification ───────────────────────── */

export interface ReasonJudgement {
  /** The student named one of the acceptable theorems. */
  agrees: boolean;
  /** The theorem the student named, when we recognised one. */
  matchedId?: string;
  /** Set when they were right but did not use the formal wording. */
  phrasingNote?: string;
  /** They named a theorem we know, and it is not one of the acceptable ones —
   *  confidently wrong, no model opinion needed. */
  knownButDifferent: boolean;
}

/**
 * Decide a proof step's justification without asking a model.
 *
 * `acceptable` is every justification the question allows (`expectedReason`
 * plus any `acceptableReasons`). A student who names the same theorem in their
 * own words agrees; one who names a *different* known theorem does not; one who
 * writes something we cannot place is left undecided (`agrees` false,
 * `knownButDifferent` false) for the model to judge.
 */
export function judgeReason(acceptable: string[], studentReason: string): ReasonJudgement {
  const reasons = acceptable.filter((r) => r && r.trim());
  const matchedId = resolveTheorem(studentReason) ?? undefined;
  const agrees = reasons.some((r) => sameTheorem(r, studentReason));
  const formal = agrees ? canonicalNameOf(studentReason) : null;
  // Only call it "informal" when they did not already write the formal name.
  const wroteFormalName = !!formal && normalizeHebrew(studentReason) === normalizeHebrew(formal);
  return {
    agrees,
    matchedId,
    phrasingNote: agrees && formal && !wroteFormalName ? `בניסוח הרשמי: ${formal}` : undefined,
    knownButDifferent: !agrees && !!matchedId,
  };
}
