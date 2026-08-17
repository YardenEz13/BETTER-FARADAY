/**
 * Hebrew counted nouns. Hebrew has a dual form, so the naive `${n} ימים`
 * renders "1 ימים" / "2 ימים" — both wrong. Every screen that counts something
 * goes through here.
 *
 * The singular and dual drop the numeral ("יומיים", not "2 ימים") because that
 * is how the count is actually said out loud.
 */

/** The primitive: singular, dual, then plural-with-numeral. */
export function countOf(n: number, one: string, two: string, many: string): string {
  return n === 1 ? one : n === 2 ? two : `${n} ${many}`;
}

/** "יום" · "יומיים" · "3 ימים" */
export function dayCount(n: number): string {
  return countOf(n, "יום", "יומיים", "ימים");
}

/** "שעה" · "שעתיים" · "3 שעות" */
export function hourCount(n: number): string {
  return countOf(n, "שעה", "שעתיים", "שעות");
}

/** "דקה" · "שתי דקות" · "3 דקות" */
export function minuteCount(n: number): string {
  return countOf(n, "דקה", "שתי דקות", "דקות");
}

/** "שבוע" · "שבועיים" · "3 שבועות" */
export function weekCount(n: number): string {
  return countOf(n, "שבוע", "שבועיים", "שבועות");
}

/** "הקפאה אחת" · "שתי הקפאות" · "3 הקפאות" */
export function freezeCount(n: number): string {
  return countOf(n, "הקפאה אחת", "שתי הקפאות", "הקפאות");
}

/** "שאלה אחת" · "שתי שאלות" · "3 שאלות" */
export function questionCount(n: number): string {
  return countOf(n, "שאלה אחת", "שתי שאלות", "שאלות");
}

/** "סעיף אחד" · "שני סעיפים" · "3 סעיפים" */
export function sectionCount(n: number): string {
  return countOf(n, "סעיף אחד", "שני סעיפים", "סעיפים");
}

/** "תלמיד אחד" · "שני תלמידים" · "3 תלמידים" */
export function studentCount(n: number): string {
  return countOf(n, "תלמיד אחד", "שני תלמידים", "תלמידים");
}

/** "נושא אחד" · "שני נושאים" · "3 נושאים" */
export function topicCount(n: number): string {
  return countOf(n, "נושא אחד", "שני נושאים", "נושאים");
}
