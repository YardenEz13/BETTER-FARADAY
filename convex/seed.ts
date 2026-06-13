import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const seedDatabase = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing questions so we can re-seed translated ones
    const q1 = await ctx.db.query("questions").collect();
    for (const d of q1) await ctx.db.delete(d._id);
    const q2 = await ctx.db.query("topics").collect();
    for (const d of q2) await ctx.db.delete(d._id);
    const q3 = await ctx.db.query("students").collect();
    for (const d of q3) await ctx.db.delete(d._id);
    const q4 = await ctx.db.query("attempts").collect();
    for (const d of q4) await ctx.db.delete(d._id);
    const q5 = await ctx.db.query("sessions").collect();
    for (const d of q5) await ctx.db.delete(d._id);
    const q6 = await ctx.db.query("hintRequests").collect();
    for (const d of q6) await ctx.db.delete(d._id);
    const q7 = await ctx.db.query("aiChats").collect();
    for (const d of q7) await ctx.db.delete(d._id);
    const q8 = await ctx.db.query("aiMessages").collect();
    for (const d of q8) await ctx.db.delete(d._id);
    
    // Avoid double-seeding classrooms
    const existing = await ctx.db.query("classrooms").first();
    let classroomId = existing?._id;
    if (!classroomId) {
      classroomId = await ctx.db.insert("classrooms", {
        name: "כיתה י\"א 3",
        teacherName: "מר כהן",
      });
    }

    // --- Students ---
    const colors = ["#4f8ef7", "#f472b6", "#22c55e", "#f59e0b", "#a78bfa", "#38bdf8", "#fb923c", "#e879f9"];
    const studentNames = [
      "מיה לוי", "דניאל כהן", "נועה ברק", "אריאל שמיר", "תמר גולן",
      "יובל אדר", "שירה אזולאי", "רון פרידמן", "אדם ביטון", "ליה מושה",
    ];
    const studentIds: Id<"students">[] = [];
    for (let i = 0; i < studentNames.length; i++) {
      const id = await ctx.db.insert("students", {
        name: studentNames[i],
        classroomId,
        avatarColor: colors[i % colors.length],
        streak: Math.floor(Math.random() * 8),
        currentTopicId: undefined,
        level: 1,
      });
      studentIds.push(id);
    }

    // --- Topics ---
    const topicsData = [
      { name: "Sequences & Series", nameHe: "סדרות", order: 1, description: "סדרות חשבוניות והנדסיות, סכומים חלקיים", icon: "🔢" },
      { name: "Probability", nameHe: "הסתברות", order: 2, description: "קומבינטוריקה, הסתברות מותנית והתפלגויות", icon: "🎲" },
      { name: "Trigonometric Functions", nameHe: "פונקציות טריגונומטריות", order: 3, description: "תכונות, טרנספורמציות וגרפים של סינוס/קוסינוס/טנגנס", icon: "📐" },
      { name: "Rational Functions", nameHe: "פונקציות רציונליות", order: 4, description: "אסימפטוטות, תחום הגדרה וחקירת פונקציות", icon: "📊" },
    ];
    const topicIds: Record<string, Id<"topics">> = {};
    for (const t of topicsData) {
      const id = await ctx.db.insert("topics", t);
      topicIds[t.name] = id;
    }

    // --- Questions: Sequences ---
    const seqId = topicIds["Sequences & Series"];
    const seqQuestions = [
      // Level 1
      {
        difficulty: 1, stem: "מהו האיבר ה-5 בסדרה החשבונית 2, 5, 8, 11, ...?",
        choices: ["13", "14", "15", "17"], correctIndex: 1,
        solutionSteps: ["מזהים את ההפרש d = 5−2 = 3", "aₙ = a₁ + (n−1)d", "a₅ = 2 + 4·3 = 14"],
        hint: "ההפרש המשותף d נמצא על ידי חיסור איברים עוקבים. למה שווה a₅ = a₁ + (5−1)·d?",
        explanation: "a₅ = 2 + 4×3 = 14. ההפרש המשותף הוא 3.",
      },
      {
        difficulty: 1, stem: "האיבר הראשון בסדרה חשבונית הוא 10 וההפרש הוא 4. מהו האיבר ה-3?",
        choices: ["18", "14", "22", "20"], correctIndex: 0,
        solutionSteps: ["a₁ = 10, d = 4", "a₃ = a₁ + 2d", "a₃ = 10 + 2·4 = 18"],
        hint: "הוסיפו את ההפרש 4 פעמיים לאיבר הראשון כדי להגיע לאיבר השלישי.",
        explanation: "האיבר השני הוא 10+4=14, והשלישי הוא 14+4=18.",
      },
      // Level 2
      {
        difficulty: 2, stem: "בסדרה חשבונית נתון a₁ = 3 ו- a₄ = 12. מהו ההפרש המשותף?",
        choices: ["2", "3", "4", "5"], correctIndex: 1,
        solutionSteps: ["a₄ = a₁ + 3d", "12 = 3 + 3d", "3d = 9", "d = 3"],
        hint: "השתמשו בנוסחה aₙ = a₁ + (n−1)d. הציבו n=4 ופתרו עבור d.",
        explanation: "12 = 3 + 3d → d = 3",
      },
      {
        difficulty: 2, stem: "סכום 10 האיברים הראשונים של סדרה חשבונית הוא 140, ו- a₁ = 5. מצאו את ההפרש המשותף.",
        choices: ["2", "3", "4", "5"], correctIndex: 0,
        solutionSteps: ["Sₙ = n/2·(2a₁ + (n−1)d)", "140 = 5·(10 + 9d)", "28 = 10 + 9d", "18 = 9d", "d = 2"],
        hint: "השתמשו בנוסחה Sₙ = n/2(2a₁ + (n−1)d). הציבו S₁₀=140, a₁=5, n=10 ופתרו עבור d.",
        explanation: "Sₙ = n/2(2a₁+(n−1)d). 140 = 5(10+9d). 28=10+9d. d=2",
      },
      // Level 3
      {
        difficulty: 3, stem: "בסדרה הנדסית, a₁ = 2 ו- r = 3. מהו סכום 4 האיברים הראשונים?",
        choices: ["26", "40", "80", "54"], correctIndex: 2,
        solutionSteps: ["S₄ = a₁·(rⁿ−1)/(r−1)", "= 2·(3⁴−1)/(3−1)", "= 2·80/2 = 80"],
        hint: "השתמשו בנוסחה Sₙ = a₁·(rⁿ−1)/(r−1). כאן r=3, n=4.",
        explanation: "S₄ = 2·(3⁴−1)/(3−1) = 2·80/2 = 80",
      },
      {
        difficulty: 3, stem: "איזה איבר בסדרה ההנדסית 3, 6, 12, 24, ... שווה ל- 384?",
        choices: ["שביעי", "שמיני", "תשיעי", "עשירי"], correctIndex: 1,
        solutionSteps: ["aₙ = a₁·rⁿ⁻¹", "384 = 3·2ⁿ⁻¹", "128 = 2ⁿ⁻¹", "2⁷ = 128, לכן n−1=7, n=8"],
        hint: "רשמו aₙ = 3·2ⁿ⁻¹ = 384. חלקו את שני האגפים ב- 3, ואז בטאו כחזקה של 2.",
        explanation: "3·2ⁿ⁻¹ = 384 → 2ⁿ⁻¹ = 128 = 2⁷ → n = 8",
      },
      // Level 4
      {
        difficulty: 4, stem: "בסדרה הנדסית אינסופית מתכנסת, a₁ = 12 ו- r = 1/3. מהו סכומה?",
        choices: ["18", "15", "36", "24"], correctIndex: 0,
        solutionSteps: ["S∞ = a₁/(1−r)", "= 12/(1−1/3)", "= 12/(2/3)", "= 18"],
        hint: "השתמשו בנוסחה לסכום סדרה הנדסית אינסופית מתכנסת: S∞ = a₁/(1−r).",
        explanation: "S∞ = 12/(2/3) = 18",
      },
      {
        difficulty: 4, stem: "בסדרה חשבונית שבה ההפרש הוא -3, סכום 5 האיברים הראשונים הוא 20. מצאו את האיבר הראשון a₁.",
        choices: ["10", "8", "12", "14"], correctIndex: 0,
        solutionSteps: ["S₅ = 5/2·(2a₁ + 4d)", "20 = 2.5·(2a₁ - 12)", "8 = 2a₁ - 12", "20 = 2a₁", "a₁ = 10"],
        hint: "הציבו את d = -3, S₅ = 20, n = 5 לתוך נוסחת הסכום.",
        explanation: "20 = 5/2(2a₁ + 4(-3)) → 8 = 2a₁ - 12 → 2a₁ = 20 → a₁ = 10",
      },
      // Level 5
      {
        difficulty: 5, stem: "האיבר השלישי והשביעי של סדרה חשבונית הם 13 ו- 33. מצאו את האיבר ה-20.",
        choices: ["88", "93", "98", "103"], correctIndex: 2,
        solutionSteps: ["a₇ − a₃ = 4d = 20 → d = 5", "a₃ = a₁ + 2d → 13 = a₁ + 10 → a₁ = 3", "a₂₀ = 3 + 19·5 = 98"],
        hint: "מצאו את d מהמשוואה (a₇ − a₃) = (7−3)·d. לאחר מכן מצאו את a₁, ולבסוף את a₂₀.",
        explanation: "d=5, a₁=3, a₂₀ = 3+95 = 98.",
      },
      {
        difficulty: 5, stem: "בסדרה הנדסית נתון שסכום האיברים הראשון והשני הוא 8, וסכום האיברים השלישי והרביעי הוא 72. מהו r? (נתון r>0)",
        choices: ["2", "3", "4", "5"], correctIndex: 1,
        solutionSteps: ["a₁ + a₁r = 8", "a₁r² + a₁r³ = 72 → r²(a₁ + a₁r) = 72", "r²·8 = 72", "r² = 9 → r = 3 (כי נתון שחיובי)"],
        hint: "בטאו את הסכומים בעזרת a₁ ו-r, והוציאו גורם משותף r² מהסכום השני.",
        explanation: "r²(a₁ + a₂) = a₃ + a₄. לכן r²·8 = 72 → r² = 9 → r = 3.",
      }
    ];
    for (const q of seqQuestions) {
      await ctx.db.insert("questions", { ...q, topicId: seqId });
    }

    // --- Questions: Probability ---
    const probId = topicIds["Probability"];
    const probQuestions = [
      // Level 1
      {
        difficulty: 1, stem: "בשק יש 3 כדורים אדומים ו- 5 כדורים כחולים. מהי ההסתברות להוציא כדור אדום?",
        choices: ["3/8", "5/8", "3/5", "1/3"], correctIndex: 0,
        solutionSteps: ["סך כל הכדורים = 8", "P(אדום) = 3/8"],
        hint: "הסתברות = (תוצאות רצויות) / (סך כל התוצאות). כמה כדורים יש בסך הכל?",
        explanation: "P(אדום) = 3 / (3+5) = 3/8",
      },
      {
        difficulty: 1, stem: "מטילים קובייה הוגנת (1-6). מהי ההסתברות לקבל מספר זוגי?",
        choices: ["1/6", "1/2", "1/3", "2/3"], correctIndex: 1,
        solutionSteps: ["מספרים זוגיים בקובייה: 2, 4, 6 (3 אפשרויות)", "סך כל האפשרויות = 6", "P = 3/6 = 1/2"],
        hint: "כמה מספרים זוגיים יש בין 1 ל-6?",
        explanation: "3 תוצאות רצויות מתוך 6 אפשריות. לכן 3/6 = 1/2.",
      },
      // Level 2
      {
        difficulty: 2, stem: "בכמה דרכים ניתן לסדר 4 תלמידים בשורה?",
        choices: ["16", "12", "24", "48"], correctIndex: 2,
        solutionSteps: ["מספר התמורות האפשריות = 4! = 4·3·2·1 = 24"],
        hint: "עבור n פריטים שונים בשורה, מספר הסידורים האפשריים הוא !n (n עצרת).",
        explanation: "4! = 24 סידורים בשורה",
      },
      {
        difficulty: 2, stem: "מטילים מטבע הוגן 3 פעמים. מהי ההסתברות שכל התוצאות יהיו 'עץ'?",
        choices: ["1/3", "1/8", "1/4", "3/8"], correctIndex: 1,
        solutionSteps: ["ההסתברות לעץ בהטלה בודדת = 1/2", "P(עץ, עץ, עץ) = (1/2)³ = 1/8"],
        hint: "הכפילו את ההסתברויות של כל הטלה בנפרד כי המאורעות בלתי תלויים.",
        explanation: "1/2 * 1/2 * 1/2 = 1/8",
      },
      // Level 3
      {
        difficulty: 3, stem: "מטילים שתי קוביות. מהי ההסתברות שסכום התוצאות יהיה 7?",
        choices: ["1/6", "1/9", "5/36", "7/36"], correctIndex: 0,
        solutionSteps: ["סך כל התוצאות האפשריות = 36", "סכום של 7: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) = 6 תוצאות", "P = 6/36 = 1/6"],
        hint: "רישמו את כל הזוגות (a,b) שעבורם a+b=7. כמה תוצאות כאלו קיימות מתוך ה-36?",
        explanation: "יש 6 תוצאות רצויות מתוך 36. P = 1/6",
      },
      {
        difficulty: 3, stem: "בכיתה בת 20 תלמידים, 12 לומדים מתמטיקה ו- 8 לומדים מדעים. 3 תלמידים לומדים את שני המקצועות. מהי ההסתברות שתלמיד שנבחר באקראי לומד לפחות מקצוע אחד?",
        choices: ["17/20", "3/4", "4/5", "1"], correctIndex: 0,
        solutionSteps: ["|M∪S| = 12 + 8 − 3 = 17", "P = 17/20"],
        hint: "השתמשו בעקרון ההכלה וההדחה: |A∪B| = |A| + |B| − |A∩B|",
        explanation: "P = (12+8-3)/20 = 17/20",
      },
      // Level 4
      {
        difficulty: 4, stem: "מקבוצה של 5 גברים ו- 3 נשים, נבחרת ועדה בת 3 איש. מהי ההסתברות שבוועדה יש בדיוק 2 נשים?",
        choices: ["15/56", "3/14", "3/8", "1/4"], correctIndex: 0,
        solutionSteps: ["C(3,2)·C(5,1) = 3·5 = 15", "סך הכל בחירות C(8,3) = 56", "P = 15/56"],
        hint: "בחרו 2 נשים מתוך 3 וגם גבר 1 מתוך 5. חלקו במספר הדרכים לבחור 3 אנשים מתוך 8.",
        explanation: "P = C(3,2)·C(5,1)/C(8,3) = (3 * 5) / 56 = 15/56",
      },
      {
        difficulty: 4, stem: "בכד 4 כדורים לבנים ו-6 כדורים שחורים. מוציאים 2 כדורים ללא החזרה. מהי ההסתברות ששניהם לבנים?",
        choices: ["2/15", "4/25", "1/5", "8/45"], correctIndex: 0,
        solutionSteps: ["הסתברות ראשון לבן: 4/10", "הסתברות שני לבן (ללא החזרה): 3/9 = 1/3", "P = (4/10) * (1/3) = 4/30 = 2/15"],
        hint: "זכרו שאחרי ההוצאה הראשונה, גם מספר הכדורים הלבנים וגם סך כל הכדורים קטנים ב-1.",
        explanation: "P = (4/10) * (3/9) = 12/90 = 2/15.",
      },
      // Level 5
      {
        difficulty: 5, stem: "שולפים קלף באקראי מחפיסת קלפים רגילה (52 קלפים). בהינתן שהקלף הוא קלף תמונה (נסיך, מלכה, מלך), מהי ההסתברות שהוא מלך?",
        choices: ["1/13", "1/3", "1/4", "3/13"], correctIndex: 1,
        solutionSteps: ["מספר קלפי תמונה = 12 (נסיך, מלכה, מלך לכל צורה)", "מלכים = 4", "P(King | face) = 4/12 = 1/3"],
        hint: "שימוש בהסתברות מותנית: P(מלך | תמונה) = P(מלך וגם תמונה) / P(תמונה).",
        explanation: "מתוך 12 קלפי התמונה (המרחב המדגמי החדש), ישנם 4 מלכים, לכן ההסתברות היא 4/12 = 1/3.",
      },
      {
        difficulty: 5, stem: "קופסה א' מכילה 3 כדורים לבנים ו-2 שחורים. קופסה ב' מכילה 2 כדורים לבנים ו-4 שחורים. בוחרים קופסה באקראי ושולפים כדור אחד. הוא נמצא שחור. מהי ההסתברות ששלפנו מקופסה א'?",
        choices: ["1/2", "3/8", "3/5", "5/11"], correctIndex: 1,
        solutionSteps: ["P(A) = 1/2, P(B) = 1/2", "P(Black|A) = 2/5", "P(Black|B) = 4/6 = 2/3", "P(Black) = 1/2 * 2/5 + 1/2 * 2/3 = 1/5 + 1/3 = 8/15", "P(A|Black) = (1/5) / (8/15) = 3/8"],
        hint: "השתמשו במשפט בייס. P(A|Black) = P(Black|A)*P(A) / P(Black).",
        explanation: "בעזרת משפט בייס ההסתברות המותנית היא (1/5) חלקי הסתברות כוללת של (8/15), שהם 3/8.",
      }
    ];
    for (const q of probQuestions) {
      await ctx.db.insert("questions", { ...q, topicId: probId });
    }

    // --- Questions: Trigonometric Functions ---
    const trigId = topicIds["Trigonometric Functions"];
    const trigQuestions = [
      // Level 1
      {
        difficulty: 1, stem: "למה שווה (90°)sin?",
        choices: ["0", "1", "-1", "0.5"], correctIndex: 1,
        solutionSteps: ["sin(90°) = 1 (ממעגל היחידה)"],
        hint: "חשבו על מעגל היחידה. מהן הקואורדינטות ב-90°?",
        explanation: "ב- 90° על מעגל היחידה, הנקודה היא (0, 1). ערך הסינוס הוא קואורדינטת ה-y, ולכן שווה ל-1.",
      },
      {
        difficulty: 1, stem: "מהו המחזור של הפונקציה f(x) = sin(x)?",
        choices: ["π", "2π", "π/2", "4π"], correctIndex: 1,
        solutionSteps: ["המחזור הסטנדרטי של הפונקציה sin(x) הוא 2π"],
        hint: "אחרי כמה רדיאנים הפונקציה sin(x) משלימה מחזור מלא אחד?",
        explanation: "הפונקציה sin(x) משלימה מחזור מלא אחד כל 2π רדיאנים.",
      },
      // Level 2
      {
        difficulty: 2, stem: "מהי המשרעת (אמפליטודה) של הפונקציה f(x) = 3·sin(2x)?",
        choices: ["2", "3", "6", "1/2"], correctIndex: 1,
        solutionSteps: ["המשרעת = |A| כאשר f(x) = A·sin(Bx)", "A = 3"],
        hint: "המשרעת היא המקדם של הסינוס. היא שולטת על הגובה הכולל של הגל.",
        explanation: "המשרעת = |3| = 3. הפרמטר B=2 משפיע על המחזור ולא על המשרעת.",
      },
      {
        difficulty: 2, stem: "מהו המחזור של הפונקציה f(x) = cos(3x)?",
        choices: ["3π", "2π/3", "6π", "π/3"], correctIndex: 1,
        solutionSteps: ["מחזור = 2π / |B|", "= 2π / 3"],
        hint: "עבור פונקציה מסוג f(x) = cos(Bx), המחזור הוא 2π / B. כאן B = 3.",
        explanation: "המחזור = 2π/3",
      },
      // Level 3
      {
        difficulty: 3, stem: "לאיזה מהביטויים הבאים שווה הביטוי sin²(x) + cos²(x)?",
        choices: ["0", "1", "2", "sin(2x)"], correctIndex: 1,
        solutionSteps: ["זוהי הזהות הפיתגוראית הבסיסית: sin²(x) + cos²(x) = 1"],
        hint: "זוהי אחת הזהויות הטריגונומטריות הבסיסיות ביותר. זוכרים אותה?",
        explanation: "הזהות הפיתגוראית הבסיסית: sin²x + cos²x = 1",
      },
      {
        difficulty: 3, stem: "מהי ההזזה האופקית של הפונקציה f(x) = sin(x − π/4)?",
        choices: ["π/4 שמאלה", "π/4 ימינה", "π/2 ימינה", "ללא הזזה"], correctIndex: 1,
        solutionSteps: ["f(x) = sin(x − C) מציין הזזה ימינה בגודל C", "C = π/4 → הזזה ימינה ב π/4"],
        hint: "בפונקציה מהצורה f(x) = sin(x − C), הגרף מוזז אופקית. אם C > 0, לאיזה כיוון?",
        explanation: "הפונקציה sin(x − π/4) היא בעצם הפונקציה sin(x) שהוזזה ימינה בשיעור של π/4.",
      },
      // Level 4
      {
        difficulty: 4, stem: "פתרו את המשוואה 2sin(x) − 1 = 0 עבור התחום [0, 2π]:",
        choices: ["x = π/6 בלבד", "x = π/6 וגם 5π/6", "x = π/3 וגם 2π/3", "x = π/4"], correctIndex: 1,
        solutionSteps: ["sin(x) = 1/2", "x = π/6 או x = π − π/6 = 5π/6"],
        hint: "בודדו תחילה את sin(x). לאחר מכן מצאו את כל הזוויות בתחום [0, 2π] שעבורן הסינוס שווה לערך זה. זכרו שסינוס חיובי ברביע הראשון וברביע השני.",
        explanation: "sin(x) = 1/2 מחזיר פתרונות של x = π/6 ו- 5π/6 בתחום [0,2π]",
      },
      {
        difficulty: 4, stem: "מהו ערכו של tan(π/3)?",
        choices: ["1/2", "1", "√3", "√3/3"], correctIndex: 2,
        solutionSteps: ["tan(π/3) = sin(π/3) / cos(π/3)", "= (√3/2) / (1/2)", "= √3"],
        hint: "השתמשו בערכים ידועים: מהם סינוס וקוסינוס של 60 מעלות?",
        explanation: "tan(60°) = √3",
      },
      // Level 5
      {
        difficulty: 5, stem: "מהו ערך המקסימום של הפונקציה f(x) = 5 − 2cos(x)?",
        choices: ["3", "5", "7", "10"], correctIndex: 2,
        solutionSteps: ["ערכו נאות של cos(x) נע בין −1 ל- 1", "ערכו של −2cos(x) נע בין −2 ל- 2", "מקסימום מתקבל כאשר cos(x) = −1: f = 5 − 2(−1) = 7"],
        hint: "מהו ערך המינימום שהביטוי cos(x) יכול לקבל? הצבתו תיתן את המקסימום לכל הביטוי.",
        explanation: "מקסימום מתקבל כאשר חיסור המינימום מקבל חיוב כפול: 5 − 2(−1) = 7",
      },
      {
        difficulty: 5, stem: "פתרו את המשוואה cos(2x) + cos(x) = 0 בתחום [0, 2π]:",
        choices: ["π/3, π, 5π/3", "π/2, π, 3π/2", "π/4, 3π/4", "π/3, 5π/3"], correctIndex: 0,
        solutionSteps: ["cos(2x) = 2cos²(x) - 1", "2cos²(x) + cos(x) - 1 = 0", "(2cos(x) - 1)(cos(x) + 1) = 0", "cos(x)=1/2 → x=π/3, 5π/3", "cos(x)=-1 → x=π"],
        hint: "השתמשו בזהות לזווית כפולה עבור קוסינוס כדי להפוך למשוואה ריבועית.",
        explanation: "הפתרונות הם π/3 ו- 5π/3 (מהגורם חצי) ו- π (מהגורם מינוס אחד).",
      }
    ];
    for (const q of trigQuestions) {
      await ctx.db.insert("questions", { ...q, topicId: trigId });
    }

    // --- Questions: Rational Functions ---
    const ratId = topicIds["Rational Functions"];
    const ratQuestions = [
      // Level 1
      {
        difficulty: 1, stem: "מהו תחום ההגדרה של f(x) = 1/(x−3)?",
        choices: ["כל המספרים הממשיים", "x ≠ 0", "x ≠ 3", "x > 3"], correctIndex: 2,
        solutionSteps: ["המכנה אינו יכול להיות שווה ל-0", "x − 3 ≠ 0", "x ≠ 3"],
        hint: "מצאו מה מאפס את המכנה — ערכים אלו אינם נכללים בתחום ההגדרה.",
        explanation: "המכנה x−3 = 0 כאשר x = 3. לכן תחום ההגדרה הוא: ℝ \\ {3}",
      },
      {
        difficulty: 1, stem: "היכן חותכת הפונקציה f(x) = (x-2)/(x+1) את ציר ה-x?",
        choices: ["(0, -2)", "(2, 0)", "(-1, 0)", "אין נקודות חיתוך"], correctIndex: 1,
        solutionSteps: ["חיתוך עם ציר ה-x מתקבל כאשר y = 0", "x - 2 = 0 → x = 2"],
        hint: "השוו את המונה לאפס (וודאו שהמכנה לא מתאפס באותה נקודה).",
        explanation: "המונה מתאפס ב- x=2. המכנה לא מתאפס שם.",
      },
      // Level 2
      {
        difficulty: 2, stem: "מהי האסימפטוטה האנכית של הפונקציה f(x) = 2x / (x + 5)?",
        choices: ["x = 5", "x = -5", "y = 2", "אין אסימפטוטה אנכית"], correctIndex: 1,
        solutionSteps: ["אסימפטוטה אנכית נוצרת כאשר המכנה שווה לאפס והמונה אינו אפס.", "x + 5 = 0 → x = -5"],
        hint: "האסימפטוטה האנכית מתקבלת מהערך המאפס את המכנה.",
        explanation: "x = -5",
      },
      {
        difficulty: 2, stem: "מהי האסימפטוטה האופקית של הפונקציה f(x) = (3x-1) / (2x+4)?",
        choices: ["y = 3/2", "y = 0", "y = 3", "אין אסימפטוטה אופקית"], correctIndex: 0,
        solutionSteps: ["החזקות הגבוהות ביותר של x במונה ובמכנה שוות (x¹)", "היחס בין המקדמים הוא 3/2"],
        hint: "חלקו את המקדמים של החזקות הגבוהות ביותר של x במונה ובמכנה.",
        explanation: "y = 3/2",
      },
      // Level 3
      {
        difficulty: 3, stem: "היכן יש חור (נקודת אי-רציפות סליקה) לפונקציה f(x) = (x² − 4) / (x − 2)?",
        choices: ["x = 4", "x = 0", "x = 2", "x = -2"], correctIndex: 2,
        solutionSteps: ["נפרק את המונה: x² − 4 = (x − 2)(x + 2)", "הגורם (x−2) מצטמצם, ולכן ב- x = 2 יש חור."],
        hint: "פרקו את המונה לגורמים ובדקו האם גורם במונה מצטמצם עם גורם במכנה.",
        explanation: "הגורם x−2 מצטמצם, ולכן ב- x=2 יש חור ולא אסימפטוטה אנכית.",
      },
      {
        difficulty: 3, stem: "מהו תחום ההגדרה של f(x) = x / (x² - 9)?",
        choices: ["x ≠ 3", "x ≠ -3, 3", "כל x", "x > 0"], correctIndex: 1,
        solutionSteps: ["המכנה x² - 9 = 0", "x² = 9 → x = 3, -3"],
        hint: "פרקו את המכנה להפרש ריבועים ומצאו אילו ערכים מאפסים אותו.",
        explanation: "המכנה מתאפס בשתי נקודות: -3 ו- 3.",
      },
      // Level 4
      {
        difficulty: 4, stem: "מצאו את תחומי החיוביות של הפונקציה f(x) = (x−1) / (x+2):",
        choices: ["x > 1 או x < −2", "−2 < x < 1", "x > 1", "x < −2"], correctIndex: 0,
        solutionSteps: ["נקודות איפוס: x = 1. נקודות אי-הגדרה: x = −2.", "נבדוק את הסימנים בתחומים: x > 1 (חיובי), −2 < x < 1 (שלילי), x < −2 (חיובי)."],
        hint: "ציירו ציר מספרים עם הנקודות x=1 ו- x=−2 ובדקו את סימן הפונקציה בכל תחום.",
        explanation: "הפונקציה חיובית כאשר המונה והמכנה בעלי אותו סימן: x > 1 או x < −2.",
      },
      {
        difficulty: 4, stem: "האם לפונקציה f(x) = x³ / (x² + 1) יש אסימפטוטה אופקית?",
        choices: ["כן, y=0", "כן, y=1", "לא, אך יש לה אסימפטוטה משופעת", "לא, ויש לה אסימפטוטה אנכית"], correctIndex: 2,
        solutionSteps: ["חזקת המונה (3) גדולה מ-1 מחזקת המכנה (2)", "לכן יש לה אסימפטוטה משופעת (y=x)"],
        hint: "השוו את מעלות הפולינומים. מה קורה כשמעלת המונה גדולה באחד?",
        explanation: "מעלת המונה 3, מכנה 2. יש אסימפטוטה משופעת ולא אופקית.",
      },
      // Level 5
      {
        difficulty: 5, stem: "מהי האסימפטוטה המשופעת של הפונקציה f(x) = (x² + 3x + 5) / (x + 1)?",
        choices: ["y = x + 3", "y = x + 2", "y = x", "y = 2x + 1"], correctIndex: 1,
        solutionSteps: ["נבצע חילוק פולינומים: (x² + 3x + 5) = (x+1)(x+2) + 3", "לכן f(x) = x + 2 + 3/(x+1)", "האסימפטוטה המשופעת היא החלק הליניארי y = x + 2"],
        hint: "בצעו חילוק פולינומים ארוך או השתמשו בפירוק לגורמים עם שארית.",
        explanation: "האסימפטוטה המשופעת היא y = x + 2.",
      },
      {
        difficulty: 5, stem: "מבין האפשרויות, אילו נקודות קיצון יש לפונקציה f(x) = x / (x² + 1)?",
        choices: ["(1, 0.5) מקסימום, (-1, -0.5) מינימום", "(0, 0) מינימום", "(1, 1) מקסימום", "אין נקודות קיצון"], correctIndex: 0,
        solutionSteps: ["f'(x) = [1(x²+1) - x(2x)] / (x²+1)² = (1-x²) / (x²+1)²", "1-x² = 0 → x = 1, x = -1", "f(1) = 1/2, f(-1) = -1/2"],
        hint: "גזרו את הפונקציה בעזרת נגזרת מנה והשוו לאפס.",
        explanation: "הנגזרת מתאפסת ב- x=1 וב- x=-1. הנקודה (1, 0.5) היא מקסימום ו-(-1, -0.5) היא מינימום.",
      }
    ];
    for (const q of ratQuestions) {
      await ctx.db.insert("questions", { ...q, topicId: ratId });
    }

    // --- Mock Homework ---
    const hwOld = await ctx.db.query("homework").collect();
    for (const h of hwOld) await ctx.db.delete(h._id);
    const aqOld = await ctx.db.query("assignedQuestions").collect();
    for (const a of aqOld) await ctx.db.delete(a._id);

    const hwId = await ctx.db.insert("homework", {
      classroomId,
      title: "תרגול שבועי - סדרות (הכנה למבחן)",
      topicIds: [seqId],
      teacherNotes: "שימו לב לחזור על סדרה הנדסית לפני המטלה.",
      questionCount: 3,
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      deadline: Date.now() + 5 * 24 * 60 * 60 * 1000,
      status: "active",
    });

    const allSeqQs = await ctx.db.query("questions").withIndex("by_topic", q => q.eq("topicId", seqId)).collect();
    if (allSeqQs.length >= 3) {
      for (let i = 0; i < studentIds.length; i++) {
        const sId = studentIds[i];
        const rand = Math.random();
        let status = "pending";
        let submittedAt = undefined;
        let score = undefined;
        let answers: any[] = [];
        
        const selectedQs = [allSeqQs[0], allSeqQs[3], allSeqQs[6]];

        if (rand > 0.6) {
          status = "submitted";
          submittedAt = Date.now() - Math.random() * 86400000;
          score = Math.floor(Math.random() * 30) + 70;
          answers = [
            { sectionLabel: "1", studentAnswer: "18", isCorrect: true, timeMs: 45000, hintsUsed: 0 },
            { sectionLabel: "2", studentAnswer: "24", isCorrect: Math.random() > 0.2, timeMs: 65000, hintsUsed: 1 }
          ];
        } else if (rand > 0.3) {
          status = "in_progress";
          answers = [
            { sectionLabel: "1", studentAnswer: "18", isCorrect: true, timeMs: 45000, hintsUsed: 0 }
          ];
        }

        for (const q of selectedQs) {
          await ctx.db.insert("assignedQuestions", {
            homeworkId: hwId,
            studentId: sId,
            questionId: q._id,
            assignedDifficulty: q.difficulty,
            personalizedReason: "הותאם לפי ביצועים קודמים",
            status,
            submittedAt,
            answers,
            score,
            aiInteractions: Math.floor(Math.random() * 3),
          });
        }
      }
    }

    // Done
  },
});
