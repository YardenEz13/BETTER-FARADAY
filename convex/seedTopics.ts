// ── Canonical curriculum topics ──
// The base `topics` rows every other seeder keys on (seedBagrut matches by
// nameHe). Idempotent by nameHe. Internal-only:
//   npx convex run seedTopics:seedTopics [--prod]
// Must run BEFORE seedBagrut / seedGeometryQuestions / addMore on a fresh
// deployment.
import { internalMutation } from "./_generated/server";

const TOPICS = [
  { name: "Sequences & Series", nameHe: "סדרות", order: 1, description: "סדרות חשבוניות והנדסיות, סכומים חלקיים", icon: "🔢" },
  { name: "Probability", nameHe: "הסתברות", order: 2, description: "קומבינטוריקה, הסתברות מותנית והתפלגויות", icon: "🎲" },
  { name: "Trigonometric Functions", nameHe: "פונקציות טריגונומטריות", order: 3, description: "תכונות, טרנספורמציות וגרפים של סינוס/קוסינוס/טנגנס", icon: "📐" },
  { name: "Rational Functions", nameHe: "פונקציות רציונליות", order: 4, description: "אסימפטוטות, תחום הגדרה וחקירת פונקציות", icon: "📊" },
  { name: "geometry", nameHe: "גיאומטריה", order: 10, description: "הוכחות גיאומטריות, משפטי חפיפה ודמיון, זוויות ומשפטי עיגול", icon: "📐" },
];

export const seedTopics = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("topics").collect();
    const byHe = new Set(existing.map((t) => t.nameHe));
    let inserted = 0;
    for (const t of TOPICS) {
      if (byHe.has(t.nameHe)) continue;
      await ctx.db.insert("topics", t);
      inserted++;
    }
    return { inserted, total: TOPICS.length };
  },
});
