import { mutation } from "./_generated/server";

export const addQuestions = mutation({
  args: {},
  handler: async (ctx) => {
    const topics = await ctx.db.query("topics").collect();
    const findTopicId = (name: string) => topics.find((t) => t.nameHe === name)?._id;

    const sequencesId = findTopicId("סדרות");
    const probId = findTopicId("הסתברות");
    const trigoId = findTopicId("פונקציות טריגונומטריות");
    const rationalId = findTopicId("פונקציות רציונליות");

    if (!sequencesId || !probId || !trigoId || !rationalId) {
      throw new Error("Missing topics");
    }

    const newQuestions = [
      {
        topicId: sequencesId,
        stem: "בסדרה חשבונית נתון: $a_1 = 5$, $d = 3$. חשב את $a_{10}$.",
        difficulty: 2,
        tags: ["סדרה חשבונית", "הצבה בנוסחה"],
        metadata: { source: "תוספת חדשה", estimatedTime: 3 },
      },
      {
        topicId: sequencesId,
        stem: "בסדרה הנדסית האיבר הראשון הוא 2 והמנה היא 3. מהו האיבר החמישי?",
        difficulty: 3,
        tags: ["סדרה הנדסית"],
        metadata: { source: "תוספת חדשה", estimatedTime: 4 },
      },
      {
        topicId: sequencesId,
        stem: "סכום 5 האיברים הראשונים של סדרה חשבונית הוא 100. ידוע כי $a_1 = 10$. מצא את $d$.",
        difficulty: 4,
        tags: ["סדרה חשבונית", "סכום"],
        metadata: { source: "תוספת חדשה", estimatedTime: 5 },
      },
      {
        topicId: probId,
        stem: "בכד יש 4 כדורים אדומים ו-6 כדורים כחולים. מוציאים 2 כדורים ללא החזרה. מה ההסתברות ששניהם אדומים?",
        difficulty: 3,
        tags: ["הסתברות מותנית", "ללא החזרה"],
        metadata: { source: "תוספת חדשה", estimatedTime: 4 },
      },
      {
        topicId: probId,
        stem: "בקופסה 10 כרטיסים ממוספרים מ-1 עד 10. מוציאים כרטיס אחד. מה ההסתברות שהמספר זוגי וגדול מ-5?",
        difficulty: 2,
        tags: ["הסתברות בסיסית", "חיתוך מאורעות"],
        metadata: { source: "תוספת חדשה", estimatedTime: 2 },
      },
      {
        topicId: trigoId,
        stem: "פתור את המשוואה $2\\sin(x) = 1$ בתחום $0 \\le x \\le 2\\pi$.",
        difficulty: 3,
        tags: ["משוואות טריגונומטריות"],
        metadata: { source: "תוספת חדשה", estimatedTime: 5 },
      },
      {
        topicId: trigoId,
        stem: "מצא את התקופה של הפונקציה $f(x) = \\cos(3x) + \\sin(3x)$.",
        difficulty: 4,
        tags: ["פונקציות טריגונומטריות", "מחזוריות"],
        metadata: { source: "תוספת חדשה", estimatedTime: 4 },
      },
      {
        topicId: rationalId,
        stem: "מצא את האסימפטוטה האנכית של הפונקציה $f(x) = \\frac{2x+1}{x-3}$.",
        difficulty: 2,
        tags: ["אסימפטוטות", "פונקציה רציונלית"],
        metadata: { source: "תוספת חדשה", estimatedTime: 2 },
      },
      {
        topicId: rationalId,
        stem: "גזור את הפונקציה $f(x) = \\frac{x^2 - 1}{x + 2}$.",
        difficulty: 3,
        tags: ["נגזרת מנה", "פונקציה רציונלית"],
        metadata: { source: "תוספת חדשה", estimatedTime: 4 },
      },
      {
        topicId: rationalId,
        stem: "מצא נקודות חיתוך עם הצירים של $f(x) = \\frac{x^2 - 4}{x^2 + 1}$.",
        difficulty: 3,
        tags: ["נקודות חיתוך", "פונקציה רציונלית"],
        metadata: { source: "תוספת חדשה", estimatedTime: 3 },
      }
    ];

    let count = 0;
    for (const q of newQuestions) {
      const { tags, metadata, ...rest } = q;
      const formattedQ = {
        ...rest,
        choices: ["תשובה 1", "תשובה 2", "תשובה 3", "תשובה 4"],
        correctIndex: 0,
        solutionSteps: ["שלב 1: הבנת הנתונים", "שלב 2: פתרון"],
        hint: "נסה לחשוב על הנוסחה המתאימה",
        explanation: "הפתרון המלא מצריך הצבה בנוסחה."
      };
      await ctx.db.insert("questions", formattedQ);
      count++;
    }

    return `Added ${count} new questions.`;
  },
});
