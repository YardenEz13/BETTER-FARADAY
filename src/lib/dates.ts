/**
 * Hebrew date/duration formatting. Five screens grew their own near-identical
 * copies of these; keep new ones here so the app reads consistently.
 *
 * Intl formatters are cached — constructing one per render is the expensive
 * part, and these are called inside list maps.
 */

const shortDateTime = new Intl.DateTimeFormat("he-IL", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});
const longDateTime = new Intl.DateTimeFormat("he-IL", {
  day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
});

/** "3 בספט׳, 14:05" — the default for lists and timestamps. */
export function formatDateHe(ts: number): string {
  return shortDateTime.format(ts);
}

/** "3 בספטמבר, 14:05" — for headers where the month is worth spelling out. */
export function formatDateLongHe(ts: number): string {
  return longDateTime.format(ts);
}

/** Elapsed time in Hebrew: "45 דק'" under an hour, else "2 שע' 5 דק'". */
export function formatDurationHe(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} דק'`;
  return `${Math.floor(mins / 60)} שע' ${mins % 60} דק'`;
}
