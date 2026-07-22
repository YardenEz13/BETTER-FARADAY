/**
 * Achievements — earned milestones, derived entirely from numbers the student
 * screens already subscribe to (XP ledger, streak, attempt stats).
 *
 * Deliberately client-side and stateless: no table, no cron, no write path.
 * An achievement is just a threshold on a stat, so "have I earned it" is a
 * comparison rather than something to store and keep in sync.
 */

export type AchievementStats = {
  /** Lifetime XP earned (xp.getXpSummary.earned — NOT the spendable balance). */
  xp: number;
  streak: number;
  attempts: number;
  correct: number;
  topicsCompleted: number;
};

export type Achievement = {
  key: string;
  name: string;
  desc: string;
  /** ELECTRIC_ICONS registry key. */
  icon: string;
  goal: number;
  value: number;
  earned: boolean;
  /** 0-100 progress toward the goal. */
  pct: number;
};

const DEFS: Array<Omit<Achievement, "value" | "earned" | "pct"> & { of: keyof AchievementStats }> = [
  // Volume
  { key: "first_spark", name: "ניצוץ ראשון", desc: "ענית על השאלה הראשונה", icon: "zap", of: "attempts", goal: 1 },
  { key: "warmed_up", name: "מתחמם", desc: "25 שאלות מאחוריך", icon: "bolt", of: "attempts", goal: 25 },
  { key: "century", name: "מאה ראשונה", desc: "100 שאלות נפתרו", icon: "circuit", of: "attempts", goal: 100 },
  { key: "machine", name: "מכונת פתרון", desc: "500 שאלות נפתרו", icon: "gauge", of: "attempts", goal: 500 },

  // Accuracy
  { key: "ten_right", name: "עשר בול", desc: "10 תשובות נכונות", icon: "check", of: "correct", goal: 10 },
  { key: "sharp", name: "חד כתער", desc: "50 תשובות נכונות", icon: "target", of: "correct", goal: 50 },
  { key: "precision", name: "אלוף הדיוק", desc: "250 תשובות נכונות", icon: "trophy", of: "correct", goal: 250 },

  // Consistency
  { key: "three_days", name: "שלושה ברצף", desc: "3 ימי למידה רצופים", icon: "flame", of: "streak", goal: 3 },
  { key: "full_week", name: "שבוע מלא", desc: "7 ימי למידה רצופים", icon: "calendar", of: "streak", goal: 7 },
  { key: "month_on", name: "חודש בוער", desc: "30 ימי למידה רצופים", icon: "star", of: "streak", goal: 30 },

  // Energy
  { key: "charged", name: "מטען ראשון", desc: "500 נקודות אנרגיה", icon: "battery", of: "xp", goal: 500 },
  { key: "full_battery", name: "סוללה מלאה", desc: "2,000 נקודות אנרגיה", icon: "capacitor", of: "xp", goal: 2000 },
  { key: "power_plant", name: "תחנת כוח", desc: "10,000 נקודות אנרגיה", icon: "inductor", of: "xp", goal: 10000 },

  // Map progress
  { key: "first_station", name: "תחנה ראשונה", desc: "נושא אחד הושלם", icon: "map", of: "topicsCompleted", goal: 1 },
  { key: "route", name: "מסלול מתפתח", desc: "3 נושאים הושלמו", icon: "field", of: "topicsCompleted", goal: 3 },
  { key: "grid_master", name: "שליט הרשת", desc: "6 נושאים הושלמו", icon: "magnet", of: "topicsCompleted", goal: 6 },
];

export function computeAchievements(stats: AchievementStats) {
  const list: Achievement[] = DEFS.map(({ of, ...def }) => {
    const value = stats[of] ?? 0;
    return {
      ...def,
      value,
      earned: value >= def.goal,
      pct: Math.min(100, Math.round((value / def.goal) * 100)),
    };
  });

  // Earned first (newest wins are the ones worth showing), then whichever
  // unearned one is closest to done.
  const unearned = list.filter((a) => !a.earned).sort((a, b) => b.pct - a.pct);
  return {
    list: [...list.filter((a) => a.earned), ...unearned],
    earnedCount: list.length - unearned.length,
    total: list.length,
    next: unearned[0] ?? null,
  };
}
