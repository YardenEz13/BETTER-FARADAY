import { mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const seedCompoundQuestions = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing compound questions
    const existing = await ctx.db.query("compoundQuestions").collect();
    for (const d of existing) await ctx.db.delete(d._id);

    // Get topic IDs
    const topics = await ctx.db.query("topics").collect();
    const topicByName: Record<string, Id<"topics">> = {};
    for (const t of topics) {
      topicByName[t.name] = t._id;
    }

    const ratId = topicByName["Rational Functions"];
    const trigId = topicByName["Trigonometric Functions"];
    const seqId = topicByName["Sequences & Series"];

    if (!ratId || !trigId || !seqId) {
      return { message: "Missing topics. Run seedDatabase first." };
    }

    // ══════════════════════════════════════════════════════════════
    // Question 1: Rational Function with Parameter (difficulty 4)
    // ══════════════════════════════════════════════════════════════
    await ctx.db.insert("compoundQuestions", {
      topicIds: [ratId],
      difficulty: 4,
      tags: ["פרמטר", "אסימפטוטה משופעת", "נקודות קיצון", "חקירת פונקציה"],
      bagrutYear: "שאלון 581 — סגנון בגרות",
      sourceBook: "בהשראת יואל גבע — פונקציות רציונליות",
      preamble: "נתונה הפונקציה:\n\nf(x) = (x² + ax - 6) / (x - 1)\n\nידוע כי הישר y = x + 3 הוא אסימפטוטה אלכסונית (משופעת) של f.",
      preambleParams: [
        { symbol: "a", displayHe: "הפרמטר a", type: "find" },
      ],
      sections: [
        {
          label: "א",
          prompt: "מצאו את ערך הפרמטר a.",
          answerType: "numeric",
          correctAnswer: "a = 2",
          solutionSteps: [
            "נבצע חילוק פולינומים של x² + ax - 6 ב-(x - 1):",
            "x² + ax - 6 = (x - 1)(x + (a+1)) + (a - 5)",
            "לכן: f(x) = x + (a+1) + (a - 5)/(x - 1)",
            "האסימפטוטה המשופעת היא y = x + (a+1).",
            "נתון שהאסימפטוטה היא y = x + 3, לכן a + 1 = 3",
            "a = 2",
          ],
          hints: [
            "מהי אסימפטוטה משופעת? איך מוצאים אותה מחילוק פולינומים?",
            "בצעו חילוק ארוך של המונה ב-(x-1). המנה היא האסימפטוטה.",
            "השוו את המנה x + (a+1) לאסימפטוטה הנתונה y = x + 3.",
          ],
          points: 8,
          skillsTested: ["חילוק פולינומים", "אסימפטוטה משופעת"],
        },
        {
          label: "ב",
          prompt: "עבור הערך שמצאתם בסעיף א׳:\n1. מצאו את תחום ההגדרה של f.\n2. מצאו את נקודות הקיצון המקומיות של f וקבעו את סוגן.",
          dependsOn: ["א"],
          answerType: "expression",
          correctAnswer: "תחום הגדרה: ℝ \\ {1}. אין נקודות קיצון — f'(x) > 0 לכל x ≠ 1.",
          solutionSteps: [
            "עם a = 2: f(x) = (x² + 2x - 6) / (x - 1)",
            "תחום הגדרה: x ≠ 1, כלומר ℝ \\ {1}",
            "נגזרת בעזרת כלל המנה:",
            "f'(x) = [(2x+2)(x-1) - (x²+2x-6)] / (x-1)²",
            "= [2x² - 2 - x² - 2x + 6] / (x-1)²",
            "= (x² - 2x + 4) / (x-1)²",
            "דיסקרימיננטה של המונה: Δ = 4 - 16 = -12 < 0",
            "המונה x² - 2x + 4 > 0 תמיד (מקדם חיובי, אין שורשים)",
            "לכן f'(x) > 0 לכל x ≠ 1 → אין נקודות קיצון",
          ],
          hints: [
            "הציבו a = 2 ומצאו את f'(x) בעזרת כלל המנה.",
            "בדקו את הדיסקרימיננטה של המונה בנגזרת. מה זה אומר על הסימן?",
          ],
          points: 12,
          skillsTested: ["גזירה", "כלל המנה", "דיסקרימיננטה", "טבלת סימנים"],
        },
        {
          label: "ג",
          prompt: "מצאו את נקודות החיתוך של גרף f עם האסימפטוטה המשופעת y = x + 3.",
          dependsOn: ["א"],
          answerType: "proof",
          correctAnswer: "אין נקודות חיתוך עם האסימפטוטה.",
          solutionSteps: [
            "נשווה: (x² + 2x - 6)/(x-1) = x + 3",
            "x² + 2x - 6 = (x+3)(x-1) = x² + 2x - 3",
            "-6 = -3 → סתירה!",
            "אין נקודות חיתוך עם האסימפטוטה.",
          ],
          hints: [
            "השוו את f(x) לביטוי האסימפטוטה. פשטו ובדקו אם יש פתרון.",
          ],
          points: 10,
          skillsTested: ["השוואת ביטויים", "פתרון משוואות"],
        },
        {
          label: "ד",
          prompt: "נתונה המשפחה g_m(x) = f(x) - m כאשר m פרמטר ממשי.\nמצאו עבור אילו ערכי m למשוואה g_m(x) = 0 יש בדיוק פתרון אחד.",
          dependsOn: ["א", "ב"],
          answerType: "range",
          correctAnswer: "אין ערך m שנותן בדיוק פתרון אחד.",
          solutionSteps: [
            "g_m(x) = 0 ⇒ f(x) = m, כלומר: (x²+2x-6)/(x-1) = m",
            "x² + 2x - 6 = m(x-1) = mx - m",
            "x² + (2-m)x + (m-6) = 0",
            "לפתרון יחיד: Δ = 0 או ששורש אחד הוא x = 1 (מחוץ לתחום)",
            "Δ = (2-m)² - 4(m-6) = m² - 8m + 28 = 0",
            "Δ_m = 64 - 112 = -48 < 0 → אין פתרון ממשי",
            "בדיקת x = 1: 1 + (2-m) + (m-6) = -3 ≠ 0",
            "מסקנה: אין ערך m שנותן בדיוק פתרון אחד",
          ],
          hints: [
            "פתרו f(x) = m כמשוואה ריבועית ב-x. מתי למשוואה ריבועית יש פתרון יחיד?",
            "זכרו: גם אם Δ = 0, צריך לוודא שהפתרון בתחום ההגדרה (x ≠ 1).",
          ],
          points: 12,
          skillsTested: ["פרמטר", "דיסקרימיננטה", "תחום הגדרה", "משוואה ריבועית"],
        },
      ],
      fullSolution: "סעיף א׳: חילוק פולינומים → a = 2.\nסעיף ב׳: f'(x) = (x²-2x+4)/(x-1)² > 0 תמיד → אין נקודות קיצון.\nסעיף ג׳: השוואה מובילה ל -6 = -3 (סתירה) → אין חיתוך.\nסעיף ד׳: Δ_m = -48 < 0 → אין ערך m שנותן פתרון יחיד.",
    });

    // ══════════════════════════════════════════════════════════════
    // Question 2: Trigonometric Function (difficulty 3)
    // ══════════════════════════════════════════════════════════════
    await ctx.db.insert("compoundQuestions", {
      topicIds: [trigId],
      difficulty: 3,
      tags: ["טריגונומטריה", "משוואות טריגונומטריות", "מחזור", "משרעת"],
      preamble: "נתונה הפונקציה:\n\nf(x) = 2sin(2x - π/3) + 1\n\nבתחום [0, 2π].",
      preambleParams: [],
      sections: [
        {
          label: "א",
          prompt: "מצאו את המחזור, המשרעת, וההזזה האופקית של f.",
          answerType: "expression",
          correctAnswer: "מחזור = π, משרעת = 2, הזזה אופקית = π/6 ימינה",
          solutionSteps: [
            "f(x) = A·sin(Bx - C) + D כאשר A=2, B=2, C=π/3, D=1",
            "משרעת = |A| = 2",
            "מחזור = 2π/|B| = 2π/2 = π",
            "הזזה אופקית = C/B = (π/3)/2 = π/6 ימינה",
          ],
          hints: [
            "זהו את A, B, C, D בצורה f(x) = A·sin(Bx - C) + D.",
            "המחזור הוא 2π/B. ההזזה האופקית היא C/B.",
          ],
          points: 8,
          skillsTested: ["משרעת", "מחזור", "הזזה אופקית"],
        },
        {
          label: "ב",
          prompt: "מצאו את נקודות המקסימום והמינימום של f בתחום [0, 2π].",
          dependsOn: ["א"],
          answerType: "coordinates",
          correctAnswer: "מקסימום: f = 3 כאשר sin(2x - π/3) = 1. מינימום: f = -1 כאשר sin(2x - π/3) = -1.",
          solutionSteps: [
            "ערך מקסימום: D + A = 1 + 2 = 3, כאשר sin(2x - π/3) = 1",
            "2x - π/3 = π/2 → x = 5π/12",
            "גם: 2x - π/3 = π/2 + 2π → x = 5π/12 + π = 17π/12",
            "ערך מינימום: D - A = 1 - 2 = -1, כאשר sin(2x - π/3) = -1",
            "2x - π/3 = 3π/2 → x = 11π/12",
            "גם: 2x - π/3 = 3π/2 + 2π → x = 11π/12 + π = 23π/12",
          ],
          hints: [
            "מקסימום של sin הוא 1, מינימום הוא -1. הציבו בביטוי.",
            "פתרו 2x - π/3 = π/2 עבור מקסימום, ו-2x - π/3 = 3π/2 עבור מינימום.",
          ],
          points: 10,
          skillsTested: ["ערכי קיצון", "פתרון משוואות טריגונומטריות"],
        },
        {
          label: "ג",
          prompt: "פתרו את המשוואה f(x) = 2 בתחום [0, 2π].",
          dependsOn: ["א"],
          answerType: "expression",
          correctAnswer: "x = π/4, x = π/12, x = π/4 + π = 5π/4, x = π/12 + π = 13π/12",
          solutionSteps: [
            "2sin(2x - π/3) + 1 = 2",
            "2sin(2x - π/3) = 1",
            "sin(2x - π/3) = 1/2",
            "2x - π/3 = π/6 + 2kπ או 2x - π/3 = 5π/6 + 2kπ",
            "מקרה 1: 2x = π/6 + π/3 = π/2 → x = π/4",
            "מקרה 2: 2x = 5π/6 + π/3 = 7π/6 → x = 7π/12",
            "ועוד פתרונות עם k=1 בתחום [0, 2π]",
          ],
          hints: [
            "בודדו את sin(2x - π/3). לאיזה ערך הוא שווה?",
            "זכרו: sin(θ) = 1/2 כאשר θ = π/6 או θ = 5π/6 (+ מחזורים).",
          ],
          points: 12,
          skillsTested: ["משוואות טריגונומטריות", "פתרון בתחום"],
        },
      ],
      fullSolution: "סעיף א׳: מחזור=π, משרעת=2, הזזה=π/6.\nסעיף ב׳: מקס=3 ב-x=5π/12, מינ=-1 ב-x=11π/12.\nסעיף ג׳: sin(2x-π/3)=1/2 → x=π/4, 7π/12 + מחזורים בתחום.",
    });

    // ══════════════════════════════════════════════════════════════
    // Question 3: Sequences with Parameter (difficulty 5)
    // ══════════════════════════════════════════════════════════════
    await ctx.db.insert("compoundQuestions", {
      topicIds: [seqId],
      difficulty: 5,
      tags: ["סדרות", "סדרה הנדסית", "התכנסות", "פרמטר", "סכום אינסופי"],
      preamble: "נתונה הסדרה ההנדסית {aₙ} המוגדרת:\n\naₙ = 3 · qⁿ⁻¹\n\nכאשר q פרמטר ממשי, q ≠ 0.",
      preambleParams: [
        { symbol: "q", displayHe: "המנה q", type: "range" },
      ],
      sections: [
        {
          label: "א",
          prompt: "מצאו עבור אילו ערכי q הסדרה מתכנסת.",
          answerType: "range",
          correctAnswer: "-1 < q < 1, q ≠ 0",
          solutionSteps: [
            "סדרה הנדסית מתכנסת אם ורק אם |q| < 1",
            "בתוספת התנאי q ≠ 0, מקבלים: -1 < q < 1, q ≠ 0",
          ],
          hints: [
            "מהו תנאי ההתכנסות של סדרה הנדסית?",
            "הסדרה מתכנסת כאשר |q| < 1. אל תשכחו ש-q ≠ 0.",
          ],
          points: 6,
          skillsTested: ["תנאי התכנסות", "סדרה הנדסית"],
        },
        {
          label: "ב",
          prompt: "עבור הערכים שמצאתם בסעיף א׳, מצאו את סכום הסדרה האינסופית כפונקציה של q.",
          dependsOn: ["א"],
          answerType: "expression",
          correctAnswer: "S∞ = 3 / (1 - q)",
          solutionSteps: [
            "S∞ = a₁ / (1 - q) = 3 / (1 - q)",
            "תקף עבור |q| < 1, q ≠ 0",
          ],
          hints: [
            "הנוסחה לסכום סדרה הנדסית אינסופית מתכנסת היא S∞ = a₁/(1-q).",
          ],
          points: 6,
          skillsTested: ["סכום אינסופי", "נוסחת סכום"],
        },
        {
          label: "ג",
          prompt: "מצאו את ערך q כך שסכום הסדרה האינסופית שווה ל-12.",
          dependsOn: ["ב"],
          answerType: "numeric",
          correctAnswer: "q = 3/4",
          solutionSteps: [
            "3/(1-q) = 12",
            "3 = 12(1-q)",
            "3 = 12 - 12q",
            "12q = 9",
            "q = 3/4",
            "בדיקה: |3/4| < 1 ✓",
          ],
          hints: [
            "הציבו S∞ = 12 בנוסחה שמצאתם בסעיף ב׳ ופתרו עבור q.",
            "3/(1-q) = 12. כפלו בשני האגפים ב-(1-q).",
          ],
          points: 8,
          skillsTested: ["פתרון משוואות", "הצבה"],
        },
        {
          label: "ד",
          prompt: "מצאו את טווח הערכים של סכום הסדרה האינסופית S∞ עבור כל ערכי q המותרים.",
          dependsOn: ["א", "ב"],
          answerType: "range",
          correctAnswer: "S∞ ∈ (-∞, 0) ∪ (3/2, +∞)  ,  S∞ ≠ 3",
          solutionSteps: [
            "S∞ = 3/(1-q) כאשר -1 < q < 1, q ≠ 0",
            "כאשר q → 1⁻: S∞ → +∞",
            "כאשר q = 0: S∞ = 3 (אך q ≠ 0, לכן S∞ ≠ 3 בדיוק)",
            "כאשר q → -1⁺: S∞ → 3/2",
            "כאשר q → 0⁺: S∞ → 3⁺",
            "כאשר q → 0⁻: S∞ → 3⁻ (קטן מ-3)",
            "עבור q ∈ (0, 1): S∞ ∈ (3, +∞)",
            "עבור q ∈ (-1, 0): S∞ ∈ (3/2, 3)",
            "טווח כולל: S∞ ∈ (3/2, +∞), S∞ ≠ 3",
          ],
          hints: [
            "בדקו מה קורה ל-S∞ = 3/(1-q) כאשר q מתקרב ל-1, ל-(-1), ול-0.",
            "שרטטו את הפונקציה S(q) = 3/(1-q) וחפשו את הטווח.",
          ],
          points: 12,
          skillsTested: ["חקירת פונקציה", "טווח", "התנהגות בקצוות"],
        },
      ],
      fullSolution: "א׳: |q|<1, q≠0.\nב׳: S∞=3/(1-q).\nג׳: q=3/4.\nד׳: S∞ ∈ (3/2, +∞), S∞≠3.",
    });

    return { message: "Seeded 3 compound 581-style questions successfully." };
  },
});
