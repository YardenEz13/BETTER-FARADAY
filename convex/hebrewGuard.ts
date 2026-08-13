// ── Script guard for machine-authored Hebrew ─────────────────────────────
//
// Gemini occasionally emits an Arabic letter where a Hebrew one belongs —
// mid-word, inside otherwise-correct Hebrew:
//
//     מيسي        instead of  מסי        (Messi)
//     צ'נדلר      instead of  צ'נדלר     (Chandler)
//     סتيב        instead of  סטיב       (Steve)
//     סכום الזוויות  instead of  סכום הזוויות
//
// Hebrew and Arabic are the same abjad letter for letter (ס↔س, ל↔ل, י↔ي,
// ר↔ر, ה↔ه, ו↔و), so the model is picking the wrong script's token for the
// *right* letter. It happens where Hebrew coverage is thinnest — foreign
// proper nouns — which is why the theme rewriter (whose whole job is to inject
// player names and TV characters) produced ~4% of its rows this way while the
// least foreign-named themes stayed under 1%.
//
// The text is repairable in principle: map each Arabic letter back to its
// Hebrew cognate and 443 of 443 affected rows came out clean. We deliberately
// do NOT do that. Roughly one word in twenty is a genuine Arabic word rather
// than a slipped letter (`الزوויות` is the Arabic article ال, not a swapped
// ה), and transliterating those yields confident nonsense — `אלזוויות` — that
// reads like Hebrew to a spell-check and is wrong. In a bank nobody reviews,
// silently-plausible beats loudly-broken in exactly the wrong direction.
//
// So this is a detector, not a fixer. Callers drop the row.

/**
 * Arabic and its supplements, including the combining vowel marks that can
 * hide inside a word that otherwise renders as pure Hebrew.
 *
 * Stops at U+FEFC on purpose: U+FEFF is the byte-order mark, which sits at the
 * end of the Presentation Forms-B block but is not Arabic and turns up in
 * perfectly good text.
 */
const ARABIC_SCRIPT = new RegExp(
  "[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]",
);

/** True when the text contains any Arabic-script character. */
export function hasArabicScript(text: string): boolean {
  return ARABIC_SCRIPT.test(text);
}

/**
 * The offending word, with a caret on the bad character — the logs are the
 * only place anyone sees these, and "row rejected" without the word tells a
 * reader nothing about whether the guard is working or over-firing.
 */
export function arabicSample(text: string): string {
  const at = text.search(ARABIC_SCRIPT);
  if (at < 0) return "";
  const start = text.lastIndexOf(" ", at) + 1;
  const end = text.indexOf(" ", at);
  return text.slice(start, end < 0 ? text.length : end);
}

/**
 * Name of the first field carrying Arabic script, or null when the whole
 * record is clean. Values may be strings or string arrays (choices, steps).
 */
export function findArabicField(
  record: Readonly<Record<string, string | readonly string[]>>,
): string | null {
  for (const [field, value] of Object.entries(record)) {
    if (typeof value === "string") {
      if (hasArabicScript(value)) return field;
      continue;
    }
    for (let i = 0; i < value.length; i++) {
      if (hasArabicScript(value[i])) return `${field}[${i}]`;
    }
  }
  return null;
}
