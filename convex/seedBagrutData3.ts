// ── Bagrut-style question bank: גיאומטריה + שאלות מורכבות (רב-סעיפיות) ──
// Original questions written in the style of Israeli bagrut exams.
// Inserted idempotently by seedBagrut:seedBagrutQuestions (dedup by stem/preamble).

import type { SimpleQuestionSeed } from "./seedBagrutData1";

export const GEOMETRY_QUESTIONS: SimpleQuestionSeed[] = [
  {
    topicHe: "גיאומטריה",
    difficulty: 1,
    stem: "במשולש, שתי זוויות הן 50° ו-60°. מהי הזווית השלישית?",
    choices: ["70°", "80°", "60°", "110°"],
    correctIndex: 0,
    solutionSteps: [
      "סכום הזוויות במשולש הוא 180°",
      "$180° - 50° - 60° = 70°$",
    ],
    hint: "סכום הזוויות במשולש הוא 180°.",
    explanation: "הזווית השלישית היא $180° - 110° = 70°$.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 1,
    stem: "במקבילית, אחת הזוויות היא 110°. מהי הזווית הסמוכה לה?",
    choices: ["70°", "110°", "80°", "90°"],
    correctIndex: 0,
    solutionSteps: [
      "במקבילית, זוויות סמוכות משלימות ל-180°",
      "$180° - 110° = 70°$",
    ],
    hint: "זוויות סמוכות במקבילית משלימות זו את זו ל-180°.",
    explanation: "הזווית הסמוכה היא $180° - 110° = 70°$.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 1,
    stem: "במשולש ישר זווית, אורכי הניצבים הם 5 ס\"מ ו-12 ס\"מ. מהו אורך היתר?",
    choices: ["13 ס\"מ", "17 ס\"מ", "11 ס\"מ", "15 ס\"מ"],
    correctIndex: 0,
    solutionSteps: [
      "משפט פיתגורס: $c^2 = 5^2 + 12^2 = 25 + 144 = 169$",
      "$c = \\sqrt{169} = 13$",
    ],
    hint: "השתמש במשפט פיתגורס.",
    explanation: "$\\sqrt{25 + 144} = 13$ ס\"מ.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 1,
    stem: "מהו היקף מעגל שרדיוסו 7 ס\"מ? (הבע באמצעות $\\pi$)",
    choices: ["$14\\pi$ ס\"מ", "$7\\pi$ ס\"מ", "$49\\pi$ ס\"מ", "$28\\pi$ ס\"מ"],
    correctIndex: 0,
    solutionSteps: [
      "היקף מעגל: $P = 2\\pi r$",
      "$P = 2\\pi \\cdot 7 = 14\\pi$",
    ],
    hint: "נוסחת ההיקף היא $P = 2\\pi r$.",
    explanation: "$P = 2 \\cdot 7 \\cdot \\pi = 14\\pi$ ס\"מ.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 2,
    stem: "במעוין, אורכי האלכסונים הם 6 ס\"מ ו-8 ס\"מ. מהו שטח המעוין?",
    choices: ["24 סמ\"ר", "48 סמ\"ר", "14 סמ\"ר", "12 סמ\"ר"],
    correctIndex: 0,
    solutionSteps: [
      "שטח מעוין: מכפלת האלכסונים חלקי 2",
      "$S = \\frac{6 \\cdot 8}{2} = 24$",
    ],
    hint: "שטח מעוין שווה למחצית מכפלת האלכסונים.",
    explanation: "$S = \\frac{6 \\cdot 8}{2} = 24$ סמ\"ר.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 2,
    stem: "בטרפז, אורכי הבסיסים הם 6 ס\"מ ו-10 ס\"מ, והגובה 4 ס\"מ. מהו שטח הטרפז?",
    choices: ["32 סמ\"ר", "40 סמ\"ר", "24 סמ\"ר", "64 סמ\"ר"],
    correctIndex: 0,
    solutionSteps: [
      "שטח טרפז: $S = \\frac{(a+b) \\cdot h}{2}$",
      "$S = \\frac{(6+10) \\cdot 4}{2} = \\frac{64}{2} = 32$",
    ],
    hint: "שטח טרפז = סכום הבסיסים כפול הגובה, חלקי 2.",
    explanation: "$S = \\frac{16 \\cdot 4}{2} = 32$ סמ\"ר.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 2,
    stem: "קטע אמצעים במשולש מקביל לצלע שאורכה 12 ס\"מ. מהו אורך קטע האמצעים?",
    choices: ["6 ס\"מ", "12 ס\"מ", "24 ס\"מ", "8 ס\"מ"],
    correctIndex: 0,
    solutionSteps: [
      "קטע אמצעים במשולש שווה למחצית הצלע השלישית",
      "$\\frac{12}{2} = 6$",
    ],
    hint: "קטע אמצעים שווה למחצית הצלע שהוא מקביל לה.",
    explanation: "קטע האמצעים שווה למחצית הצלע: 6 ס\"מ.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 2,
    stem: "במשולש, שתי זוויות פנימיות הן 40° ו-70°. מהי הזווית החיצונית שליד הקודקוד השלישי?",
    choices: ["110°", "70°", "180°", "120°"],
    correctIndex: 0,
    solutionSteps: [
      "זווית חיצונית שווה לסכום שתי הזוויות הפנימיות שאינן צמודות לה",
      "$40° + 70° = 110°$",
    ],
    hint: "השתמש במשפט הזווית החיצונית.",
    explanation: "הזווית החיצונית שווה ל-$40° + 70° = 110°$.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 2,
    stem: "זווית היקפית נשענת על קוטר המעגל. מה גודלה?",
    choices: ["90°", "180°", "45°", "60°"],
    correctIndex: 0,
    solutionSteps: [
      "זווית היקפית הנשענת על קוטר היא זווית ישרה",
      "גודלה 90°",
    ],
    hint: "זהו משפט מפורסם על זווית היקפית הנשענת על קוטר.",
    explanation: "זווית היקפית הנשענת על קוטר שווה תמיד ל-90°.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 2,
    stem: "שני משולשים דומים ביחס 2:5. היקף המשולש הקטן הוא 12 ס\"מ. מהו היקף המשולש הגדול?",
    choices: ["30 ס\"מ", "24 ס\"מ", "60 ס\"מ", "25 ס\"מ"],
    correctIndex: 0,
    solutionSteps: [
      "יחס ההיקפים שווה ליחס הדמיון",
      "$12 \\cdot \\frac{5}{2} = 30$",
    ],
    hint: "יחס ההיקפים במשולשים דומים שווה ליחס הדמיון (לא לריבועו).",
    explanation: "ההיקף הגדול: $12 \\cdot \\frac{5}{2} = 30$ ס\"מ.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 2,
    stem: "במשולש שווה שוקיים, זווית הבסיס היא 65°. מהי זווית הראש?",
    choices: ["50°", "65°", "115°", "40°"],
    correctIndex: 0,
    solutionSteps: [
      "שתי זוויות הבסיס שוות: $65° + 65° = 130°$",
      "זווית הראש: $180° - 130° = 50°$",
    ],
    hint: "שתי זוויות הבסיס שוות, וסכום כל הזוויות 180°.",
    explanation: "זווית הראש היא $180° - 2 \\cdot 65° = 50°$.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 2,
    stem: "יחס השטחים של שני משולשים דומים הוא 4:9. מהו יחס הדמיון (יחס הצלעות)?",
    choices: ["2:3", "4:9", "16:81", "1:2"],
    correctIndex: 0,
    solutionSteps: [
      "יחס השטחים שווה לריבוע יחס הדמיון",
      "$\\sqrt{\\frac{4}{9}} = \\frac{2}{3}$",
    ],
    hint: "יחס הדמיון הוא השורש הריבועי של יחס השטחים.",
    explanation: "יחס הצלעות הוא $\\sqrt{4}:\\sqrt{9} = 2:3$.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 2,
    stem: "מהו המרחק בין הנקודות $A(1,\\ 2)$ ו-$B(4,\\ 6)$?",
    choices: ["5", "7", "$\\sqrt{7}$", "25"],
    correctIndex: 0,
    solutionSteps: [
      "נוסחת המרחק: $d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$",
      "$d = \\sqrt{3^2 + 4^2} = \\sqrt{25} = 5$",
    ],
    hint: "השתמש בנוסחת המרחק בין שתי נקודות.",
    explanation: "$d = \\sqrt{9 + 16} = 5$.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 3,
    stem: "זווית מרכזית במעגל היא 80°. מה גודלה של זווית היקפית הנשענת על אותה קשת?",
    choices: ["40°", "80°", "160°", "100°"],
    correctIndex: 0,
    solutionSteps: [
      "זווית היקפית שווה למחצית הזווית המרכזית הנשענת על אותה קשת",
      "$\\frac{80°}{2} = 40°$",
    ],
    hint: "זווית היקפית שווה למחצית הזווית המרכזית על אותה קשת.",
    explanation: "הזווית ההיקפית היא $\\frac{80°}{2} = 40°$.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 3,
    stem: "מהו שטח משולש שווה צלעות שאורך צלעו 6 ס\"מ?",
    choices: ["$9\\sqrt{3}$ סמ\"ר", "$18\\sqrt{3}$ סמ\"ר", "18 סמ\"ר", "$6\\sqrt{3}$ סמ\"ר"],
    correctIndex: 0,
    solutionSteps: [
      "שטח משולש שווה צלעות: $S = \\frac{\\sqrt{3}}{4}a^2$",
      "$S = \\frac{\\sqrt{3}}{4} \\cdot 36 = 9\\sqrt{3}$",
    ],
    hint: "השתמש בנוסחה $S = \\frac{\\sqrt{3}}{4}a^2$.",
    explanation: "$S = \\frac{\\sqrt{3}}{4} \\cdot 6^2 = 9\\sqrt{3}$ סמ\"ר.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 3,
    stem: "במשולש ישר זווית, הניצבים הם 6 ס\"מ ו-8 ס\"מ. מהו אורך הגובה ליתר?",
    choices: ["4.8 ס\"מ", "5 ס\"מ", "4 ס\"מ", "6 ס\"מ"],
    correctIndex: 0,
    solutionSteps: [
      "היתר: $\\sqrt{36+64} = 10$",
      "שטח המשולש: $\\frac{6 \\cdot 8}{2} = 24$",
      "הגובה ליתר: $h = \\frac{2 \\cdot 24}{10} = 4.8$",
    ],
    hint: "חשב את השטח בשתי דרכים: פעם עם הניצבים ופעם עם היתר והגובה אליו.",
    explanation: "מהשוואת שטחים: $h = \\frac{48}{10} = 4.8$ ס\"מ.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 3,
    stem: "מנקודה שמרחקה ממרכז המעגל 10 ס\"מ יוצא משיק למעגל שרדיוסו 6 ס\"מ. מהו אורך המשיק?",
    choices: ["8 ס\"מ", "4 ס\"מ", "$\\sqrt{136}$ ס\"מ", "16 ס\"מ"],
    correctIndex: 0,
    solutionSteps: [
      "המשיק מאונך לרדיוס בנקודת ההשקה",
      "נוצר משולש ישר זווית: $t^2 + 6^2 = 10^2$",
      "$t = \\sqrt{100 - 36} = \\sqrt{64} = 8$",
    ],
    hint: "המשיק מאונך לרדיוס — השתמש במשפט פיתגורס.",
    explanation: "$t = \\sqrt{100 - 36} = 8$ ס\"מ.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 3,
    stem: "במשולש $ABC$, הנקודה $D$ על $AB$ והנקודה $E$ על $AC$ כך ש-$DE \\parallel BC$. נתון: $AD = 2$, $DB = 4$, $AE = 3$. מהו אורך $EC$?",
    choices: ["6", "4", "9", "5"],
    correctIndex: 0,
    solutionSteps: [
      "לפי משפט תאלס: $\\frac{AD}{DB} = \\frac{AE}{EC}$",
      "$\\frac{2}{4} = \\frac{3}{EC}$",
      "$EC = 6$",
    ],
    hint: "השתמש במשפט תאלס: ישר מקביל לצלע מחלק את שתי הצלעות האחרות באותו יחס.",
    explanation: "$\\frac{2}{4} = \\frac{3}{EC}$ נותן $EC = 6$.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 3,
    stem: "מרובע חסום במעגל. אחת מזוויותיו היא 95°. מהי הזווית שמולה?",
    choices: ["85°", "95°", "265°", "90°"],
    correctIndex: 0,
    solutionSteps: [
      "במרובע חסום במעגל, סכום זוויות נגדיות הוא 180°",
      "$180° - 95° = 85°$",
    ],
    hint: "במרובע חסום במעגל, זוויות נגדיות משלימות ל-180°.",
    explanation: "הזווית הנגדית היא $180° - 95° = 85°$.",
  },
  {
    topicHe: "גיאומטריה",
    difficulty: 3,
    stem: "במשולש ישר זווית, אורך היתר 14 ס\"מ. מהו אורך התיכון ליתר?",
    choices: ["7 ס\"מ", "14 ס\"מ", "10 ס\"מ", "אי אפשר לדעת"],
    correctIndex: 0,
    solutionSteps: [
      "התיכון ליתר במשולש ישר זווית שווה למחצית היתר",
      "$\\frac{14}{2} = 7$",
    ],
    hint: "יש משפט מיוחד על התיכון ליתר במשולש ישר זווית.",
    explanation: "התיכון ליתר שווה למחצית היתר: 7 ס\"מ.",
  },
];

// ── Compound (multi-section, bagrut-format) questions ──
export type CompoundQuestionSeed = {
  topicsHe: string[];
  difficulty: number;
  tags: string[];
  preamble: string;
  sections: {
    label: string;
    prompt: string;
    dependsOn?: string[];
    answerType: string;
    correctAnswer: string;
    solutionSteps: string[];
    hints: string[];
    points: number;
    skillsTested: string[];
  }[];
  fullSolution: string;
};

export const COMPOUND_QUESTIONS: CompoundQuestionSeed[] = [
  {
    topicsHe: ["סדרות"],
    difficulty: 3,
    tags: ["סדרה חשבונית", "סכום סדרה", "איבר כללי"],
    preamble:
      "בסדרה חשבונית נתון: $a_4 = 14$ ו-$a_9 = 29$.",
    sections: [
      {
        label: "א",
        prompt: "מצא את הפרש הסדרה $d$.",
        answerType: "numeric",
        correctAnswer: "3",
        solutionSteps: [
          "$a_9 - a_4 = 5d$",
          "$29 - 14 = 15 = 5d$",
          "$d = 3$",
        ],
        hints: [
          "כמה 'קפיצות' של $d$ יש בין האיבר הרביעי לאיבר התשיעי?",
          "$a_9 - a_4 = 5d$. הצב את הנתונים.",
        ],
        points: 25,
        skillsTested: ["סדרה חשבונית", "פתרון משוואה"],
      },
      {
        label: "ב",
        prompt: "מצא את האיבר הראשון $a_1$.",
        dependsOn: ["א"],
        answerType: "numeric",
        correctAnswer: "5",
        solutionSteps: [
          "$a_4 = a_1 + 3d$",
          "$14 = a_1 + 9$",
          "$a_1 = 5$",
        ],
        hints: [
          "הבע את $a_4$ באמצעות $a_1$ ו-$d$.",
          "$14 = a_1 + 3 \\cdot 3$.",
        ],
        points: 25,
        skillsTested: ["איבר כללי", "הצבה"],
      },
      {
        label: "ג",
        prompt: "חשב את סכום 20 האיברים הראשונים של הסדרה.",
        dependsOn: ["א", "ב"],
        answerType: "numeric",
        correctAnswer: "670",
        solutionSteps: [
          "$S_{20} = \\frac{20}{2}(2a_1 + 19d)$",
          "$S_{20} = 10(10 + 57)$",
          "$S_{20} = 670$",
        ],
        hints: [
          "השתמש בנוסחה $S_n = \\frac{n}{2}(2a_1 + (n-1)d)$.",
          "$S_{20} = 10(2 \\cdot 5 + 19 \\cdot 3)$.",
        ],
        points: 25,
        skillsTested: ["סכום סדרה חשבונית"],
      },
      {
        label: "ד",
        prompt: "איזה איבר בסדרה שווה 92? (רשום את מספר האיבר $n$)",
        dependsOn: ["א", "ב"],
        answerType: "numeric",
        correctAnswer: "30",
        solutionSteps: [
          "$a_n = 5 + 3(n-1) = 92$",
          "$3(n-1) = 87$",
          "$n - 1 = 29 \\Rightarrow n = 30$",
        ],
        hints: [
          "הצב $a_n = 92$ בנוסחת האיבר הכללי.",
          "$3(n-1) = 87$ — פתור עבור $n$.",
        ],
        points: 25,
        skillsTested: ["איבר כללי", "פתרון משוואה"],
      },
    ],
    fullSolution:
      "מ-$a_9 - a_4 = 5d = 15$ נובע $d = 3$. מ-$a_4 = a_1 + 3d$ נובע $a_1 = 14 - 9 = 5$. סכום 20 האיברים: $S_{20} = 10(2 \\cdot 5 + 19 \\cdot 3) = 10 \\cdot 67 = 670$. האיבר ששווה 92: $5 + 3(n-1) = 92$ נותן $n = 30$.",
  },
  {
    topicsHe: ["הסתברות"],
    difficulty: 4,
    tags: ["הסתברות שלמה", "נוסחת בייס", "דיאגרמת עץ"],
    preamble:
      "במפעל שתי מכונות. מכונה A מייצרת 60% מהמוצרים, ומכונה B מייצרת 40% מהמוצרים. 5% מהמוצרים של מכונה A פגומים, ו-10% מהמוצרים של מכונה B פגומים. בוחרים מוצר באקראי.",
    sections: [
      {
        label: "א",
        prompt: "מה ההסתברות שהמוצר שנבחר פגום? (רשום כמספר עשרוני)",
        answerType: "numeric",
        correctAnswer: "0.07",
        solutionSteps: [
          "נוסחת ההסתברות השלמה:",
          "$P(פגום) = 0.6 \\cdot 0.05 + 0.4 \\cdot 0.1$",
          "$P(פגום) = 0.03 + 0.04 = 0.07$",
        ],
        hints: [
          "צייר דיאגרמת עץ: קודם בוחרים מכונה, ואז בודקים אם המוצר פגום.",
          "חבר את שני המסלולים שמובילים למוצר פגום.",
        ],
        points: 50,
        skillsTested: ["הסתברות שלמה", "דיאגרמת עץ"],
      },
      {
        label: "ב",
        prompt: "ידוע שהמוצר שנבחר פגום. מה ההסתברות שהוא יוצר במכונה B? (רשום כשבר)",
        dependsOn: ["א"],
        answerType: "expression",
        correctAnswer: "4/7",
        solutionSteps: [
          "נוסחת בייס: $P(B|פגום) = \\frac{P(B \\cap פגום)}{P(פגום)}$",
          "$P(B \\cap פגום) = 0.4 \\cdot 0.1 = 0.04$",
          "$P(B|פגום) = \\frac{0.04}{0.07} = \\frac{4}{7}$",
        ],
        hints: [
          "זו הסתברות מותנית 'הפוכה' — השתמש בנוסחת בייס.",
          "חלק את המסלול של מכונה B בהסתברות הכוללת שחישבת בסעיף א.",
        ],
        points: 50,
        skillsTested: ["הסתברות מותנית", "נוסחת בייס"],
      },
    ],
    fullSolution:
      "לפי נוסחת ההסתברות השלמה: $P(פגום) = 0.6 \\cdot 0.05 + 0.4 \\cdot 0.1 = 0.07$. לפי נוסחת בייס: $P(B|פגום) = \\frac{0.04}{0.07} = \\frac{4}{7}$.",
  },
  {
    topicsHe: ["פונקציות רציונליות"],
    difficulty: 4,
    tags: ["חקירת פונקציה", "נקודות קיצון", "אסימפטוטות", "נגזרת מנה"],
    preamble:
      "נתונה הפונקציה $f(x) = \\dfrac{x^2}{x-2}$.",
    sections: [
      {
        label: "א",
        prompt: "מצא את תחום ההגדרה של הפונקציה.",
        answerType: "expression",
        correctAnswer: "x ≠ 2",
        solutionSteps: [
          "המכנה חייב להיות שונה מאפס",
          "$x - 2 \\ne 0 \\Rightarrow x \\ne 2$",
        ],
        hints: ["מתי המכנה מתאפס?"],
        points: 15,
        skillsTested: ["תחום הגדרה"],
      },
      {
        label: "ב",
        prompt: "מצא את שיעורי נקודת המקסימום המקומי של הפונקציה.",
        answerType: "coordinates",
        correctAnswer: "(0, 0)",
        solutionSteps: [
          "כלל המנה: $f'(x) = \\frac{2x(x-2) - x^2}{(x-2)^2} = \\frac{x^2 - 4x}{(x-2)^2}$",
          "$f'(x) = 0 \\Rightarrow x(x-4) = 0 \\Rightarrow x = 0$ או $x = 4$",
          "בדיקת סימני הנגזרת: ב-$x = 0$ הנגזרת מחליפה סימן מ-+ ל-− — מקסימום",
          "$f(0) = 0$, ולכן נקודת המקסימום היא $(0, 0)$",
        ],
        hints: [
          "גזור לפי כלל המנה והשווה את המונה לאפס.",
          "המונה של הנגזרת הוא $x^2 - 4x = x(x-4)$.",
          "בדוק את סימן הנגזרת משני צידי כל נקודה חשודה.",
        ],
        points: 30,
        skillsTested: ["נגזרת מנה", "נקודות קיצון", "טבלת סימנים"],
      },
      {
        label: "ג",
        prompt: "מצא את שיעורי נקודת המינימום המקומי של הפונקציה.",
        dependsOn: ["ב"],
        answerType: "coordinates",
        correctAnswer: "(4, 8)",
        solutionSteps: [
          "הנקודה החשודה השנייה: $x = 4$",
          "ב-$x = 4$ הנגזרת מחליפה סימן מ-− ל-+ — מינימום",
          "$f(4) = \\frac{16}{2} = 8$, ולכן נקודת המינימום היא $(4, 8)$",
        ],
        hints: [
          "השתמש בנקודות החשודות שמצאת בסעיף ב.",
          "חשב את $f(4)$.",
        ],
        points: 30,
        skillsTested: ["נקודות קיצון", "הצבה"],
      },
      {
        label: "ד",
        prompt: "מהי משוואת האסימפטוטה האנכית של הפונקציה?",
        answerType: "expression",
        correctAnswer: "x = 2",
        solutionSteps: [
          "המכנה מתאפס ב-$x = 2$ והמונה שם שונה מאפס ($4 \\ne 0$)",
          "לכן $x = 2$ היא אסימפטוטה אנכית",
        ],
        hints: ["איפה הפונקציה אינה מוגדרת?"],
        points: 25,
        skillsTested: ["אסימפטוטות"],
      },
    ],
    fullSolution:
      "תחום ההגדרה: $x \\ne 2$. הנגזרת: $f'(x) = \\frac{x(x-4)}{(x-2)^2}$, המתאפסת ב-$x = 0$ וב-$x = 4$. לפי טבלת סימנים: $(0, 0)$ מקסימום מקומי ו-$(4, 8)$ מינימום מקומי. האסימפטוטה האנכית: $x = 2$.",
  },
  {
    topicsHe: ["פונקציות טריגונומטריות"],
    difficulty: 4,
    tags: ["חקירת פונקציה", "נגזרת", "נקודות קיצון", "משוואה טריגונומטרית"],
    preamble:
      "נתונה הפונקציה $f(x) = \\sin x + \\cos x$ בתחום $0 \\le x \\le 2\\pi$.",
    sections: [
      {
        label: "א",
        prompt: "חשב את $f(0)$.",
        answerType: "numeric",
        correctAnswer: "1",
        solutionSteps: [
          "$f(0) = \\sin 0 + \\cos 0$",
          "$f(0) = 0 + 1 = 1$",
        ],
        hints: ["מהם $\\sin 0$ ו-$\\cos 0$?"],
        points: 20,
        skillsTested: ["הצבה", "ערכים מיוחדים"],
      },
      {
        label: "ב",
        prompt: "מצא את כל הפתרונות של $f'(x) = 0$ בתחום הנתון.",
        answerType: "expression",
        correctAnswer: "x = π/4, x = 5π/4",
        solutionSteps: [
          "$f'(x) = \\cos x - \\sin x$",
          "$\\cos x - \\sin x = 0 \\Rightarrow \\tan x = 1$",
          "בתחום $[0, 2\\pi]$: $x = \\frac{\\pi}{4}$ וגם $x = \\frac{5\\pi}{4}$",
        ],
        hints: [
          "גזור: הנגזרת של $\\sin x$ היא $\\cos x$, והנגזרת של $\\cos x$ היא $-\\sin x$.",
          "חלק את המשוואה ב-$\\cos x$ כדי לקבל משוואה בטנגנס.",
          "לטנגנס יש מחזור של $\\pi$ — אל תשכח את הפתרון השני.",
        ],
        points: 40,
        skillsTested: ["נגזרת טריגונומטרית", "משוואה טריגונומטרית"],
      },
      {
        label: "ג",
        prompt: "מהו הערך המקסימלי של הפונקציה בתחום הנתון?",
        dependsOn: ["ב"],
        answerType: "expression",
        correctAnswer: "√2",
        solutionSteps: [
          "$f\\left(\\frac{\\pi}{4}\\right) = \\frac{\\sqrt{2}}{2} + \\frac{\\sqrt{2}}{2} = \\sqrt{2}$",
          "$f\\left(\\frac{5\\pi}{4}\\right) = -\\sqrt{2}$ — מינימום",
          "הערך המקסימלי הוא $\\sqrt{2}$",
        ],
        hints: [
          "הצב את הנקודות החשודות מסעיף ב בפונקציה המקורית.",
          "$\\sin\\frac{\\pi}{4} = \\cos\\frac{\\pi}{4} = \\frac{\\sqrt{2}}{2}$.",
        ],
        points: 40,
        skillsTested: ["נקודות קיצון", "ערכים מיוחדים"],
      },
    ],
    fullSolution:
      "$f(0) = 1$. הנגזרת $f'(x) = \\cos x - \\sin x$ מתאפסת כאשר $\\tan x = 1$, כלומר $x = \\frac{\\pi}{4}$ ו-$x = \\frac{5\\pi}{4}$. הערך המקסימלי מתקבל ב-$x = \\frac{\\pi}{4}$: $f = \\sqrt{2}$.",
  },
  {
    topicsHe: ["גיאומטריה"],
    difficulty: 3,
    tags: ["משפט פיתגורס", "שטח משולש", "גובה ליתר"],
    preamble:
      "במשולש ישר זווית $ABC$ ($\\angle C = 90°$) נתון: $AC = 9$ ס\"מ, $BC = 12$ ס\"מ.",
    sections: [
      {
        label: "א",
        prompt: "חשב את אורך היתר $AB$ (בס\"מ).",
        answerType: "numeric",
        correctAnswer: "15",
        solutionSteps: [
          "משפט פיתגורס: $AB^2 = AC^2 + BC^2$",
          "$AB^2 = 81 + 144 = 225$",
          "$AB = 15$",
        ],
        hints: ["השתמש במשפט פיתגורס."],
        points: 30,
        skillsTested: ["משפט פיתגורס"],
      },
      {
        label: "ב",
        prompt: "חשב את שטח המשולש (בסמ\"ר).",
        answerType: "numeric",
        correctAnswer: "54",
        solutionSteps: [
          "הניצבים מאונכים זה לזה, ולכן: $S = \\frac{AC \\cdot BC}{2}$",
          "$S = \\frac{9 \\cdot 12}{2} = 54$",
        ],
        hints: ["במשולש ישר זווית, הניצבים הם בסיס וגובה."],
        points: 30,
        skillsTested: ["שטח משולש"],
      },
      {
        label: "ג",
        prompt: "חשב את אורך הגובה מהקודקוד $C$ אל היתר $AB$ (בס\"מ).",
        dependsOn: ["א", "ב"],
        answerType: "numeric",
        correctAnswer: "7.2",
        solutionSteps: [
          "השטח בעזרת היתר: $S = \\frac{AB \\cdot h}{2}$",
          "$54 = \\frac{15 \\cdot h}{2}$",
          "$h = \\frac{108}{15} = 7.2$",
        ],
        hints: [
          "בטא את השטח בשתי דרכים: פעם עם הניצבים ופעם עם היתר והגובה אליו.",
          "$54 = \\frac{15h}{2}$ — פתור עבור $h$.",
        ],
        points: 40,
        skillsTested: ["שטח משולש", "השוואת שטחים"],
      },
    ],
    fullSolution:
      "לפי פיתגורס: $AB = \\sqrt{81+144} = 15$ ס\"מ. השטח: $\\frac{9 \\cdot 12}{2} = 54$ סמ\"ר. מהשוואת שטחים: $h = \\frac{2 \\cdot 54}{15} = 7.2$ ס\"מ.",
  },
];
