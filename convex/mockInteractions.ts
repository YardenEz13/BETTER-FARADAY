import { mutation } from "./_generated/server";

const CHAT_SCRIPTS: Array<{
  title: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  metrics: {
    confusionScore: number;
    topicsCovered: string[];
    questionsAsked: number;
    avgResponseLength: number;
    sentiment: string;
    keyStrugglePoints: string[];
  };
}> = [
  {
    title: "שאלה על סדרה חשבונית",
    messages: [
      { role: "user", content: "לא מצליח להבין איך מוצאים את ההפרש בסדרה חשבונית" },
      { role: "assistant", content: "בסדרה חשבונית ההפרש d הוא קבוע בין כל שני איברים עוקבים. אם יש לך a₁ = 3 ו-a₄ = 12, אפשר להשתמש בנוסחה: a₄ = a₁ + 3d. נציב: 12 = 3 + 3d, אז 3d = 9, ולכן d = 3. נסה עכשיו: אם a₁ = 5 ו-a₃ = 11, מה d?" },
      { role: "user", content: "אז a₃ = a₁ + 2d, ולכן 11 = 5 + 2d, כלומר d = 3?" },
      { role: "assistant", content: "מצוין! בדיוק נכון. עכשיו אתה יודע להשתמש בנוסחה aₙ = a₁ + (n-1)d בביטחון." },
    ],
    metrics: { confusionScore: 0.3, topicsCovered: ["סדרה חשבונית", "הפרש משותף"], questionsAsked: 1, avgResponseLength: 120, sentiment: "positive", keyStrugglePoints: ["מציאת הפרש מנוסחה"] },
  },
  {
    title: "עזרה עם הסתברות מותנית",
    messages: [
      { role: "user", content: "לא מבין מתי משתמשים בהסתברות מותנית" },
      { role: "assistant", content: "הסתברות מותנית P(A|B) שואלת: מה ההסתברות של A בהינתן שB כבר קרה? למשל: בכיתה יש 20 תלמידים, 12 לומדים מתמטיקה. אם נבחר תלמיד שלומד מדעים (8 תלמידים), מה הסיכוי שהוא גם לומד מתמטיקה? כאן המרחב שלנו כבר מצטמצם ל-8." },
      { role: "user", content: "אה אוקיי, אז המכנה משתנה?" },
      { role: "assistant", content: "בדיוק! המכנה הופך להיות מספר המקרים שבהם B התקיים. P(A|B) = P(A וB) / P(B)." },
      { role: "user", content: "מה עם משפט בייס?" },
      { role: "assistant", content: "משפט בייס הוא דרך להפוך את ההסתברות: P(A|B) = P(B|A)·P(A) / P(B). הוא שימושי כשיודעים את P(B|A) אבל רוצים P(A|B)." },
    ],
    metrics: { confusionScore: 0.6, topicsCovered: ["הסתברות מותנית", "משפט בייס"], questionsAsked: 2, avgResponseLength: 150, sentiment: "neutral", keyStrugglePoints: ["שינוי מרחב המדגם", "בייס"] },
  },
  {
    title: "פונקציות טריגונומטריות - מחזור",
    messages: [
      { role: "user", content: "למה המחזור של sin(2x) הוא π ולא 2π?" },
      { role: "assistant", content: "שאלה מצוינת! המחזור של sin(x) הוא 2π. כשמכפילים את x ב-2, הפונקציה 'רצה' פי 2 מהר, ולכן המחזור מתקצר בחצי: 2π/2 = π. בכלל: המחזור של sin(bx) הוא 2π/b." },
      { role: "user", content: "ומה עם sin(x/3)?" },
      { role: "assistant", content: "כאן b = 1/3, אז המחזור הוא 2π / (1/3) = 6π. הפונקציה 'רצה' לאט יותר." },
    ],
    metrics: { confusionScore: 0.4, topicsCovered: ["מחזור", "טריגונומטריה"], questionsAsked: 1, avgResponseLength: 110, sentiment: "positive", keyStrugglePoints: ["השפעת מקדם על מחזור"] },
  },
  {
    title: "אסימפטוטות של פונקציה רציונלית",
    messages: [
      { role: "user", content: "איך מוצאים אסימפטוטה אנכית?" },
      { role: "assistant", content: "האסימפטוטה האנכית נמצאת היכן שהמכנה מתאפס (ולא גם המונה). למשל ב-f(x) = 2x/(x+5), האסימפטוטה האנכית היא x = -5." },
      { role: "user", content: "ומה עם אסימפטוטה אופקית?" },
      { role: "assistant", content: "האסימפטוטה האופקית היא ערך הפונקציה כש-x שואף לאינסוף. אם דרגת המונה = דרגת המכנה, האסימפטוטה היא מקדם המוביל מחולק במקדם המוביל. ב-2x/(x+5): y = 2/1 = 2." },
    ],
    metrics: { confusionScore: 0.5, topicsCovered: ["אסימפטוטה אנכית", "אסימפטוטה אופקית"], questionsAsked: 2, avgResponseLength: 130, sentiment: "neutral", keyStrugglePoints: ["חישוב אסימפטוטה אופקית"] },
  },
];

export const createMockInteractions = mutation({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    if (students.length === 0) throw new Error("אין תלמידים ב-DB. הרץ את ה-seed קודם.");

    const topics = await ctx.db.query("topics").collect();
    if (topics.length === 0) throw new Error("אין topics ב-DB. הרץ את ה-seed קודם.");

    const questions = await ctx.db.query("questions").collect();
    if (questions.length === 0) throw new Error("אין questions ב-DB. הרץ את ה-seed קודם.");

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    for (const student of students) {
      // ── 2-3 sessions per student across different topics ──
      const topicsForStudent = topics.slice(0, Math.min(3, topics.length));

      for (let si = 0; si < topicsForStudent.length; si++) {
        const topic = topicsForStudent[si];
        const sessionStart = now - (si + 1) * 2 * DAY - Math.random() * DAY;
        const sessionDurationMs = (8 + Math.floor(Math.random() * 12)) * 60 * 1000;

        const topicQs = questions.filter((q) => q.topicId === topic._id);
        if (topicQs.length === 0) continue;

        const numAttempts = 4 + Math.floor(Math.random() * 5);
        let correctCount = 0;

        const sessionId = await ctx.db.insert("sessions", {
          studentId: student._id,
          topicId: topic._id,
          startedAt: sessionStart,
          endedAt: sessionStart + sessionDurationMs,
          questionsAttempted: numAttempts,
          correctCount: 0,
          currentDifficulty: 2,
        });

        for (let ai = 0; ai < numAttempts; ai++) {
          const q = topicQs[ai % topicQs.length];
          const isCorrect = Math.random() > 0.35;
          if (isCorrect) correctCount++;

          const wrongIndex = (q.correctIndex + 1 + Math.floor(Math.random() * (q.choices.length - 1))) % q.choices.length;

          await ctx.db.insert("attempts", {
            studentId: student._id,
            questionId: q._id,
            topicId: topic._id,
            isCorrect,
            choiceIndex: isCorrect ? q.correctIndex : wrongIndex,
            timeMs: 15000 + Math.floor(Math.random() * 60000),
            hintsUsed: Math.random() > 0.7 ? 1 : 0,
            difficulty: q.difficulty,
          });
        }

        await ctx.db.patch(sessionId, { correctCount });
      }

      // ── 1-2 AI chats per student ──
      const numChats = 1 + Math.floor(Math.random() * 2);
      for (let ci = 0; ci < numChats; ci++) {
        const script = CHAT_SCRIPTS[(students.indexOf(student) + ci) % CHAT_SCRIPTS.length];
        const topic = topics[ci % topics.length];
        const chatStart = now - (ci + 1) * DAY - Math.random() * DAY;
        const chatDuration = (5 + Math.floor(Math.random() * 15)) * 60 * 1000;

        const chatId = await ctx.db.insert("aiChats", {
          studentId: student._id,
          topicId: topic._id,
          agentType: "practice",
          title: script.title,
          startedAt: chatStart,
          endedAt: chatStart + chatDuration,
          messageCount: script.messages.length,
          metrics: script.metrics,
        });

        for (let mi = 0; mi < script.messages.length; mi++) {
          const msg = script.messages[mi];
          await ctx.db.insert("aiMessages", {
            chatId,
            role: msg.role,
            content: msg.content,
            timestamp: chatStart + mi * 45000,
          });
        }
      }
    }
  },
});
