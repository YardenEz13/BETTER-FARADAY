// ── Gemini vision passes ──
// Two image/PDF entry points: a Socratic notebook-check hint for students, and a
// question-extraction pass for teachers importing from textbook photos/PDFs.
import { geminiGenerateContent } from "./localAI.gemini";

// ── Notebook Vision Hint ──
// The student photographs their handwritten work so Faraday can see where they
// are and nudge them forward. This path is intentionally Socratic: it must NOT
// reveal the final answer or a full corrected solution — only the single next
// step or one guiding hint. The prompt itself is the guardrail here (the regex
// violatesSocraticRules() would over-strip legitimate hints that mention a
// number), so keep the prompt strict.
export interface NotebookImage {
  mimeType: string; // "image/jpeg" | "image/png" | "image/webp"
  data: string; // base64, no "data:" prefix
}

const NOTEBOOK_CHECKER_PROMPT = `אתה פאראדיי — מורה מנחה למתמטיקה. התלמיד צילם את המחברת שלו כדי שתעזור לו להתקדם. אתה רואה את מה שכתב עד עכשיו.

המטרה שלך: לעזור לתלמיד להתקדם בכוחות עצמו — לא לפתור עבורו ולא לחשוף את התשובה.

כללים:
1. השב תמיד בעברית בלבד.
2. עבור על מה שהתלמיד כתב והבן היכן הוא נמצא בפתרון.
3. אסור לחשוף את התשובה הסופית, ואסור לכתוב את הפתרון המלא או את השלב המתוקן עבורו.
4. תן רק את הצעד הבא האחד שכדאי לעשות, או רמז מנחה אחד — בלי לבצע את הצעד במקומו.
5. אם זיהית טעות — אל תתקן אותה ישירות. כוון את התלמיד אל האזור שבו כדאי לבדוק שוב, ושאל שאלה מנחה שתעזור לו לגלות אותה בעצמו.
6. אם מה שכתב נראה נכון עד כה — עודד אותו והצע מהו הצעד הבא להמשך.
7. אם התמונה מטושטשת, חתוכה או אינה מכילה פתרון מתמטי — אמור זאת בנימוס ובקש תמונה ברורה יותר.
8. השתמש ב-LaTeX (בין $...$) רק לביטוי מתמטי קצר בתוך רמז, ולעולם לא כדי לחשוף את התשובה.
9. שמור על תשובה קצרה (1-3 משפטים), תומכת ומעודדת.`;

export async function checkNotebookImage(
  image: NotebookImage,
  userQuestion: string,
  questionContext?: string,
  signal?: AbortSignal
): Promise<string> {
  let systemContent = NOTEBOOK_CHECKER_PROMPT;
  if (questionContext) {
    systemContent += `\n\n=== השאלה שעליה התלמיד עובד (להקשר בלבד) ===\n${questionContext}\n=== סוף ההקשר ===`;
  }

  const promptText = userQuestion && userQuestion.trim()
    ? userQuestion.trim()
    : "הסתכל בבקשה על מה שכתבתי עד עכשיו. מה הצעד הבא שכדאי לי לעשות? תן לי רמז אחד בלי לפתור או לחשוף את התשובה.";

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: image.mimeType, data: image.data } },
          { text: promptText },
        ],
      },
    ],
    systemInstruction: { parts: [{ text: systemContent }] },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1500,
    },
  };

  const data = await geminiGenerateContent(payload, signal, "vision");
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text.trim();
}

// ── Teacher Question Import (vision extraction) ──
// One Gemini pass over a textbook photo/PDF: read the question AND decide the
// best format (multiple-choice vs fill-in-the-blank), returning an editable
// draft. `topicId` is intentionally absent — the teacher picks the topic in the
// review UI before publishing.
export interface ExtractedQuestionDraft {
  format: "multiple_choice" | "fill_blank";
  difficulty: number; // 1-5
  stem: string;
  choices: string[]; // multiple_choice only ([] for fill_blank)
  correctIndex?: number; // multiple_choice
  correctAnswer?: string; // fill_blank
  solutionSteps: string[];
  hint: string;
  explanation: string;
}

const QUESTION_EXTRACT_PROMPT = `אתה עוזר למורה למתמטיקה. לפניך תמונה או PDF של שאלה מספר לימוד בעברית. חלץ את השאלה והחזר JSON בלבד (ללא markdown, ללא תגיות \`\`\`) במבנה הבא:
{
  "format": "multiple_choice" או "fill_blank",
  "stem": "ניסוח השאלה המלא בעברית, עם נוסחאות ב-LaTeX בין $...$",
  "choices": ["אפשרות 1", "אפשרות 2", "אפשרות 3", "אפשרות 4"],
  "correctIndex": 0,
  "correctAnswer": "",
  "difficulty": 3,
  "solutionSteps": ["שלב 1", "שלב 2"],
  "hint": "רמז מנחה אחד",
  "explanation": "הסבר קצר לפתרון",
  "rawText": "כל הטקסט שזיהית בתמונה"
}

כללים:
- בחר "multiple_choice" אם לשאלה יש תשובה אחת נכונה שניתן להציג כבחירה מרובה; אחרת בחר "fill_blank".
- עבור multiple_choice: מלא 4 אפשרויות (כולל הסחות דעת סבירות), קבע "correctIndex" (0-3), והשאר "correctAnswer" ריק.
- עבור fill_blank: מלא "correctAnswer" עם התשובה הנכונה, והשאר "choices" כמערך ריק [].
- "difficulty" הוא הערכה 1-5.
- אם התמונה אינה ברורה או אינה מכילה שאלה מתמטית — החזר "stem" ריק.`;

export async function extractQuestionFromMedia(
  media: { mimeType: string; data: string },
  signal?: AbortSignal
): Promise<{ rawText: string; draft: ExtractedQuestionDraft }> {
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: media.mimeType, data: media.data } },
          { text: QUESTION_EXTRACT_PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  };

  const data = await geminiGenerateContent(payload, signal, "vision");
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const clean = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(clean);

  const format: ExtractedQuestionDraft["format"] =
    parsed.format === "multiple_choice" ? "multiple_choice" : "fill_blank";

  const draft: ExtractedQuestionDraft = {
    format,
    difficulty: Math.max(1, Math.min(5, Number(parsed.difficulty) || 3)),
    stem: String(parsed.stem || ""),
    choices: Array.isArray(parsed.choices) ? parsed.choices.map((c: unknown) => String(c)) : [],
    correctIndex:
      typeof parsed.correctIndex === "number"
        ? parsed.correctIndex
        : format === "multiple_choice" ? 0 : undefined,
    correctAnswer: parsed.correctAnswer ? String(parsed.correctAnswer) : format === "fill_blank" ? "" : undefined,
    solutionSteps: Array.isArray(parsed.solutionSteps) ? parsed.solutionSteps.map((s: unknown) => String(s)) : [],
    hint: String(parsed.hint || ""),
    explanation: String(parsed.explanation || ""),
  };

  if (!draft.stem.trim()) {
    throw new Error("לא זוהתה שאלה מתמטית בתמונה. נסה קובץ ברור יותר.");
  }

  const rawText = String(parsed.rawText || draft.stem);
  return { rawText, draft };
}
