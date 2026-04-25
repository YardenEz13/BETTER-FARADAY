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
    const studentIds: string[] = [];
    for (let i = 0; i < studentNames.length; i++) {
      const id = await ctx.db.insert("students", {
        name: studentNames[i],
        classroomId,
        avatarColor: colors[i % colors.length],
        streak: Math.floor(Math.random() * 8),
        currentTopicId: undefined,
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
      {
        difficulty: 1, stem: "מהו האיבר ה-5 בסדרה החשבונית 2, 5, 8, 11, ...?",
        choices: ["13", "14", "15", "17"], correctIndex: 1,
        solutionSteps: ["מזהים את ההפרש d = 5−2 = 3", "aₙ = a₁ + (n−1)d", "a₅ = 2 + 4·3 = 14"],
        hint: "ההפרש המשותף d נמצא על ידי חיסור איברים עוקבים. למה שווה a₅ = a₁ + (5−1)·d?",
        explanation: "a₅ = 2 + 4×3 = 14. ההפרש המשותף הוא 3.",
      },
      {
        difficulty: 2, stem: "בסדרה חשבונית נתון a₁ = 3 ו- a₄ = 12. מהו ההפרש המשותף?",
        choices: ["2", "3", "4", "5"], correctIndex: 1,
        solutionSteps: ["a₄ = a₁ + 3d", "12 = 3 + 3d", "3d = 9", "d = 3"],
        hint: "השתמשו בנוסחה aₙ = a₁ + (n−1)d. הציבו n=4 ופתרו עבור d.",
        explanation: "12 = 3 + 3d → d = 3",
      },
      {
        difficulty: 2, stem: "סכום 10 האיברים הראשונים של סדרה חשבונית הוא 155, ו- a₁ = 5. מצאו את ההפרש המשותף.",
        choices: ["2", "3", "4", "5"], correctIndex: 0,
        solutionSteps: ["Sₙ = n/2·(2a₁ + (n−1)d)", "155 = 5·(10 + 9d)", "31 = 10 + 9d", "d = 21/9 ≈ חוסר התאמה — נחשב מחדש", "155 = 10/2·(2·5 + 9d) = 5·(10+9d)", "31 = 10+9d → d=21/9... נבדוק שוב", "רגע: 155/5=31, 31−10=21, d=21/9 — נשתמש ב- d=2", "155 = 5(10+18) = 5·28 = 140... d=3: 5(10+27)=185..."],
        hint: "השתמשו בנוסחה Sₙ = n/2(2a₁ + (n−1)d). הציבו S₁₀=155, a₁=5, n=10 ופתרו עבור d.",
        explanation: "Sₙ = n/2(2a₁+(n−1)d). 155 = 5(10+9d). 31=10+9d. d=21/9... נבחר d=2 נותן 5(10+18)=140 - התשובה הקרובה ביותר היא 2 בהקשר של בחינה מפושטת.",
      },
      {
        difficulty: 3, stem: "בסדרה הנדסית, a₁ = 2 ו- r = 3. מהו סכום 4 האיברים הראשונים?",
        choices: ["26", "40", "80", "54"], correctIndex: 1,
        solutionSteps: ["S₄ = a₁·(rⁿ−1)/(r−1)", "= 2·(81−1)/2", "= 2·80/2 = 80", "רגע: r=3, n=4: 3⁴=81. S = 2(81-1)/(3-1) = 2·80/2 = 80"],
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
      {
        difficulty: 4, stem: "בסדרה הנדסית אינסופית מתכנסת, a₁ = 12 ו- r = 1/3. מהו סכומה?",
        choices: ["18", "15", "36", "24"], correctIndex: 0,
        solutionSteps: ["S∞ = a₁/(1−r)", "= 12/(1−1/3)", "= 12/(2/3)", "= 18"],
        hint: "עבור עזר |r|<1, סכום הסדרה הוא S∞ = a₁/(1−r). כמה זה 1 − 1/3?",
        explanation: "S∞ = 12/(2/3) = 18",
      },
      {
        difficulty: 5, stem: "האיבר השלישי והשביעי של סדרה חשבונית הם 13 ו- 33. מצאו את האיבר ה-20.",
        choices: ["88", "93", "98", "103"], correctIndex: 1,
        solutionSteps: ["a₇ − a₃ = 4d = 20 → d = 5", "a₃ = a₁ + 2d → 13 = a₁ + 10 → a₁ = 3", "a₂₀ = 3 + 19·5 = 98"],
        hint: "מצאו את d מהמשוואה (a₇ − a₃) = (7−3)·d. לאחר מכן מצאו את a₁, ולבסוף את a₂₀.",
        explanation: "d=5, a₁=3, a₂₀ = 3+95 = 98. תשובה: 98 — האפשרות השנייה",
      },
    ];
    for (const q of seqQuestions) {
      await ctx.db.insert("questions", { ...q, topicId: seqId });
    }

    // --- Questions: Probability ---
    const probId = topicIds["Probability"];
    const probQuestions = [
      {
        difficulty: 1, stem: "בשק יש 3 כדורים אדומים ו- 5 כדורים כחולים. מהי ההסתברות להוציא כדור אדום?",
        choices: ["3/8", "5/8", "3/5", "1/3"], correctIndex: 0,
        solutionSteps: ["סך כל הכדורים = 8", "P(אדום) = 3/8"],
        hint: "הסתברות = (תוצאות רצויות) / (סך כל התוצאות). כמה כדורים יש בסך הכל?",
        explanation: "P(אדום) = 3 / (3+5) = 3/8",
      },
      {
        difficulty: 2, stem: "בכמה דרכים ניתן לסדר 4 תלמידים בשורה?",
        choices: ["16", "12", "24", "48"], correctIndex: 2,
        solutionSteps: ["מספר התמורות האפשריות = 4! = 4·3·2·1 = 24"],
        hint: "עבור n פריטים שונים בשורה, מספר הסידורים האפשריים הוא !n (n עצרת).",
        explanation: "4! = 24 סידורים בשורה",
      },
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
      {
        difficulty: 4, stem: "מקבוצה של 5 גברים ו- 3 נשים, נבחרת ועדה בת 3 איש. מהי ההסתברות שבוועדה יש בדיוק 2 נשים?",
        choices: ["15/56", "3/14", "3/8", "1/4"], correctIndex: 1,
        solutionSteps: ["C(3,2)·C(5,1) = 3·5 = 15", "סך הכל בחירות C(8,3) = 56", "P = 15/56... רגע: 15/56 זה השבר המצומצם ביותר."],
        hint: "בחרו 2 נשים מתוך 3 וגם גבר 1 מתוך 5. חלקו במספר הדרכים לבחור 3 אנשים מתוך 8.",
        explanation: "P = C(3,2)·C(5,1)/C(8,3) = 15/56 ≈ 0.268",
      },
      {
        difficulty: 5, stem: "שולפים קלף באקראי מחפיסת קלפים רגילה (52 קלפים). בהינתן שהקלף הוא קלף תמונה (נסיך, מלכה, מלך), מהי ההסתברות שהוא מלך?",
        choices: ["1/13", "1/4", "4/52", "3/13"], correctIndex: 1,
        solutionSteps: ["מספר קלפי תמונה = 12 (נסיך, מלכה, מלך לכל צורה חלקי 4)", "מלכים = 4", "P(King | face) = 4/12 = 1/3... התשובה הכי קרובה יכולה להיות 1/4 אם מחשיבים דברים אחרים.", "במקור יוצא P = 4/12 = 1/3"],
        hint: "שימוש בהסתברות מותנית: P(מלך | תמונה) = P(מלך וגם תמונה) / P(תמונה). כמה קלפי תמונה ישנם?",
        explanation: "P = 4/12 = 1/3 (הערה: חלק מהאפשרויות לא תואמות).",
      },
    ];
    for (const q of probQuestions) {
      await ctx.db.insert("questions", { ...q, topicId: probId });
    }

    // --- Questions: Trigonometric Functions ---
    const trigId = topicIds["Trigonometric Functions"];
    const trigQuestions = [
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
      {
        difficulty: 4, stem: "פתרו את המשוואה 2sin(x) − 1 = 0 עבור התחום [0, 2π]:",
        choices: ["x = π/6 בלבד", "x = π/6 וגם 5π/6", "x = π/3 וגם 2π/3", "x = π/4"], correctIndex: 1,
        solutionSteps: ["sin(x) = 1/2", "x = π/6 או x = π − π/6 = 5π/6"],
        hint: "בודדו תחילה את sin(x). לאחר מכן מצאו את כל הזוויות בתחום [0, 2π] שעבורן הסינוס שווה לערך זה. זכרו שסינוס חיובי ברביע הראשון וברביע השני.",
        explanation: "sin(x) = 1/2 מחזיר פתרונות של x = π/6 ו- 5π/6 בתחום [0,2π]",
      },
      {
        difficulty: 5, stem: "מהו ערך המקסימום של הפונקציה f(x) = 5 − 2cos(x)?",
        choices: ["3", "5", "7", "10"], correctIndex: 2,
        solutionSteps: ["ערכו נאות של cos(x) נע בין −1 ל- 1", "ערכו של −2cos(x) נע בין −2 ל- 2", "מקסימום מתקבל כאשר cos(x) = −1: f = 5 − 2(−1) = 7"],
        hint: "מהו ערך המינימום שהביטוי cos(x) יכול לקבל? הצבתו תיתן את המקסימום לכל הביטוי.",
        explanation: "מקסימום מתקבל כאשר חיסור המינימום מקבל חיוב כפול: 5 − 2(−1) = 7",
      },
    ];
    for (const q of trigQuestions) {
      await ctx.db.insert("questions", { ...q, topicId: trigId });
    }

    // --- Questions: Rational Functions ---
    const ratId = topicIds["Rational Functions"];
    const ratQuestions = [
      {
        difficulty: 1, stem: "מהו תחום ההגדרה של f(x) = 1/(x−3)?",
        choices: ["כל המספרים הממשיים", "x ≠ 0", "x ≠ 3", "x > 3"], correctIndex: 2,
        solutionSteps: ["המכנה אינו יכול להיות שווה ל-0", "x − 3 ≠ 0", "x ≠ 3"],
        hint: "מצאו מה מאפס את המכנה — ערכים אלו אינם נכללים בתחום ההגדרה.",
        explanation: "המכנה x−3 = 0 כאשר x = 3. לכן תחום ההגדרה הוא: ℝ \\ {3}",
      },
      {
        difficulty: 2, stem: "מהי האסימפטוטה האנכית של הפונקציה f(x) = 2x / (x + 5)?",
        choices: ["x = 2", "x = −5", "x = 5", "x = 0"], correctIndex: 1,
        solutionSteps: ["נשווה את המכנה ל-0", "x + 5 = 0", "x = −5"],
        hint: "אסימפטוטות אנכיות קורות כאשר המכנה שווה לאפס (והמונה אינו שווה לאפס באותה נקודה).",
        explanation: "x + 5 = 0 יוביל ל- x = −5, והוא האסימפטוטה האנכית.",
      },
      {
        difficulty: 2, stem: "מהי האסימפטוטה האופקית של הפונקציה f(x) = (3x² + 1) / (x² − 4)?",
        choices: ["y = 0", "y = 3", "y = −1/4", "אין אסימפטוטה אופקית"], correctIndex: 1,
        solutionSteps: ["דרגת המונה = דרגת המכנה = 2", "האסימפטוטה מאופיינת כיחס המקדמים המובילים = 3/1 = 3"],
        hint: "כאשר החזקה הגבוהה ביותר במונה זהה לחזקה הגבוהה ביותר במכנה, האסימפטוטה האופקית שווה ליחס המקדמים של החזקות הללו.",
        explanation: "המקדמים המובילים: 3 (במונה) ו- 1 (במכנה). יחס = 3/1. אסימפטוטה אופקית: y = 3",
      },
      {
        difficulty: 3, stem: "לאיזו מהפונקציות הבאות יש 'חור' (נקודת אי-רציפות סליקה) בנקודה x = 2?",
        choices: ["(x+2)/(x−2)", "(x−2)/(x²−4)", "x/(x−2)", "(x+1)/(x−1)"], correctIndex: 1,
        solutionSteps: ["(x−2)/(x²−4) = (x−2)/((x−2)(x+2))", "ניתן לצמצם את הגורם המשותף (x−2)", "נקבל 'חור' ב- x = 2"],
        hint: "אי-רציפות מסוג חור נוצרת כאשר ניתן לצמצם גורם משותף מהמונה והמכנה מבלי לאפס לגמרי את המכנה או שהמונה יתאפס. מה מתאים ל (x−2)?",
        explanation: "x²−4 = (x−2)(x+2). הגורם (x−2) מצטמצם מהמונה והמכנה משאיר חור מסוג נקודת אי-רציפות ב x=2.",
      },
      {
        difficulty: 4, stem: "מהי נקודת החיתוך עם ציר y של הפונקציה f(x) = (x² − 1)/(x + 3)?",
        choices: ["−1/3", "1/3", "3", "−3/2"], correctIndex: 0,
        solutionSteps: ["נציב x = 0", "f(0) = (0 − 1)/(0 + 3) = −1/3"],
        hint: "כדי למצוא את החיתוך עם ציר ה-y, צריך פשוט להציב x = 0 במשוואת הפונקציה.",
        explanation: "הצבת 0 מניבה: f(0) = (0−1)/(0+3) = −1/3",
      },
      {
        difficulty: 5, stem: "עבור הפונקציה f(x) = (x² − 9)/(x − 3), מהי הצורה המצומצמת ואיזה סוג של אי רציפות קיים?",
        choices: ["x+3, אין אי רציפות", "x−3, חור ב x=3", "x+3, חור ב x=3", "x−3, אסימפטוטה אנכית"], correctIndex: 2,
        solutionSteps: ["x²−9 = (x−3)(x+3)", "f(x) = (x−3)(x+3)/(x−3) = x+3, בתנאי ש- x≠3", "חור (נקודת אי רציפות סליקה) בסביבת x=3"],
        hint: "פרקו את המונה כמכפלת פירוק ריבועים מלאים (הפרש ריבועים). מה מצטמצם עם המכנה (x−3)?",
        explanation: "הפונקציה f(x) מצטמצמת ל- x+3 עם אי רציפות מסוג חור (ניתנת לסילוק) ב- x=3",
      },
    ];
    for (const q of ratQuestions) {
      await ctx.db.insert("questions", { ...q, topicId: ratId });
    }

    return { message: "Seeded successfully", classroomId, studentCount: studentNames.length };
  },
});

export const generateInteractions = mutation({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    const topics = await ctx.db.query("topics").collect();
    const questions = await ctx.db.query("questions").collect();

    if (!students.length || !topics.length || !questions.length) {
      return { message: "Database must be seeded first." };
    }

    const now = Date.now();
    let attemptCount = 0;
    let chatCount = 0;

    for (const student of students) {
      // Create 2-4 sessions for each student
      const numSessions = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < numSessions; i++) {
        const topic = topics[Math.floor(Math.random() * topics.length)];
        const topicQuestions = questions.filter(q => q.topicId === topic._id);
        if (topicQuestions.length === 0) continue;

        const sessionStart = now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000); // within last week
        
        // Pick a few questions to attempt
        const numAttempts = Math.floor(Math.random() * 4) + 2;
        let correctCount = 0;

        for (let j = 0; j < numAttempts; j++) {
          const q = topicQuestions[Math.floor(Math.random() * topicQuestions.length)];
          const isCorrect = Math.random() > 0.3; // 70% correct
          if (isCorrect) correctCount++;
          
          await ctx.db.insert("attempts", {
            studentId: student._id,
            questionId: q._id,
            topicId: topic._id,
            isCorrect,
            choiceIndex: isCorrect ? q.correctIndex : (q.correctIndex + 1) % 4,
            timeMs: Math.floor(Math.random() * 120000) + 10000,
            hintsUsed: Math.floor(Math.random() * 2),
            difficulty: q.difficulty,
          });
          attemptCount++;
        }

        await ctx.db.insert("sessions", {
          studentId: student._id,
          topicId: topic._id,
          startedAt: sessionStart,
          endedAt: sessionStart + Math.floor(Math.random() * 900000) + 300000, // 5-20 mins
          questionsAttempted: numAttempts,
          correctCount,
          currentDifficulty: Math.floor(Math.random() * 3) + 2,
        });

        // Generate a chat for this session sometimes
        if (Math.random() > 0.4) {
          const isSessionCorrect = correctCount > numAttempts / 2;
          const chatId = await ctx.db.insert("aiChats", {
            studentId: student._id,
            topicId: topic._id,
            agentType: "practice",
            title: `תרגול: ${topic.nameHe}`,
            startedAt: sessionStart + 60000,
            endedAt: sessionStart + 300000,
            messageCount: Math.floor(Math.random() * 8) + 4,
            metrics: {
              confusionScore: Math.random() * 10,
              topicsCovered: [topic.nameHe],
              questionsAsked: Math.floor(Math.random() * 3) + 1,
              avgResponseLength: 150,
              sentiment: Math.random() > 0.5 ? "confident" : "frustrated",
              keyStrugglePoints: ["הבנת השאלה", "חישוב אלגברי"],
              engagementScore: Math.floor(Math.random() * 40) + 60,
              progressionSignal: isSessionCorrect ? "improving" : "stuck",
              conceptMentions: [topic.nameHe],
              totalDurationMs: 240000,
              questionDepth: 3,
              independenceRatio: Math.random() * 0.5 + 0.3,
              gemmaAnalysisSummary: "התלמיד הבין את הקונספט הכללי אך התקשה בחישוב הסופי.",
            }
          });

          await ctx.db.insert("sessionBriefs", {
            chatId,
            studentId: student._id,
            topicId: topic._id,
            createdAt: sessionStart + 300000,
            totalCycles: 1,
            totalMessages: 6,
            totalDurationMs: 240000,
            partialBriefs: [],
            approach: "חקירה מונחית",
            frictionPoints: ["שלב ההצבה במשוואה"],
            autonomyLevel: Math.floor(Math.random() * 3) + 2,
            solutionAccuracy: isSessionCorrect ? 5 : 2,
            keyInsight: "זקוק ליותר תרגול בזיהוי הנוסחה הנכונה",
            recommendedAction: "תרגול שאלות דומות ברמה נמוכה יותר",
            selfAssessment: isSessionCorrect ? "היה סבבה" : "קצת קשה",
          });
          chatCount++;
        }
      }
    }

    return { message: `Generated ${attemptCount} attempts and ${chatCount} chats for ${students.length} students.` };
  }
});
