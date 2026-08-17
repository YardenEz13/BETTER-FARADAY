// ── Conversation analysis & composite briefs ──
// Heuristic-first analytics over a tutor chat: each async entry point computes a
// deterministic fallback locally, then tries to enrich it via a single Gemini
// pass (JSON mode). If Gemini fails or times out, the heuristic result stands.
import type { Message, ChatMetrics, PartialBrief, CompositeBrief } from "./localAI.types";
import { geminiGenerateContent, getActiveStudentId } from "./localAI.gemini";
import { countOf, questionCount } from "../lib/hebrew";

// Gemini's JSON mode still occasionally emits invalid JSON: literal newlines
// inside string values (→ "Unterminated string"), trailing commas, code fences,
// or prose around the object. Parse defensively rather than trusting JSON.parse.
function parseGeminiJson(raw: string): any {
  let s = (raw ?? "").trim();
  // Drop markdown code fences if present.
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // Isolate the outermost JSON object (strips any leading/trailing prose).
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last > first) s = s.slice(first, last + 1);

  const attempts = [
    s,
    // Collapse raw control chars (literal newlines/tabs inside strings) to spaces.
    // eslint-disable-next-line no-control-regex
    s.replace(/[\x00-\x1f]+/g, " "),
    // ...and strip trailing commas before } or ].
    // eslint-disable-next-line no-control-regex
    s.replace(/[\x00-\x1f]+/g, " ").replace(/,\s*([}\]])/g, "$1"),
  ];
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      /* try the next, more aggressive, sanitization */
    }
  }
  throw new SyntaxError(
    `parseGeminiJson: no attempt yielded valid JSON (len=${s.length}, head=${JSON.stringify(s.slice(0, 120))})`
  );
}

// Schema-constrained JSON: Gemini guarantees the output matches this shape, so it
// can't emit the truncated / unescaped-quote garbage that broke plain JSON mode.
const STR = { type: "STRING" } as const;
const STR_ARR = { type: "ARRAY", items: { type: "STRING" } } as const;
const NUM = { type: "NUMBER" } as const;

const ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    sentiment: { type: "STRING", enum: ["frustrated", "neutral", "confident"] },
    confusionScore: NUM,
    engagementScore: NUM,
    progressionSignal: { type: "STRING", enum: ["improving", "stuck", "declining"] },
    questionDepth: NUM,
    independenceRatio: NUM,
    conceptMentions: STR_ARR,
    keyStrugglePoints: STR_ARR,
    topicsCovered: STR_ARR,
    missingKnowledge: STR_ARR,
    teacherActionItem: STR,
    gemmaAnalysisSummary: STR,
  },
} as const;

const BRIEF_SCHEMA = {
  type: "OBJECT",
  properties: {
    approach: STR,
    frictionPoints: STR_ARR,
    autonomyLevel: NUM,
    solutionAccuracy: NUM,
    keyInsight: STR,
    missingConcepts: STR_ARR,
    teacherActionItem: STR,
    detailedStruggleAnalysis: STR,
    nextSteps: STR_ARR,
    studentQuotes: STR_ARR,
  },
} as const;

// ── Analysis ──

/**
 * Frustration signals, shared by both analysers so a fix lands in one place.
 * Hebrew words are not \w, so \b never matches — each token is guarded by a
 * lookbehind instead. Without it "קשה" matches inside "בבקשה" and every polite
 * student reads as frustrated. "עזרה" is deliberately absent: asking for help
 * is what the tutor is for, not a complaint.
 */
const FRUSTRATION_RE = /(?<![א-ת])(לא מבין|לא הבנתי|קשה|בלבול|מבולבל|נתקעתי|תסכול|אוף)/g;
const frustrationHits = (msgs: Message[]) =>
  msgs.reduce((n, m) => n + (m.content.match(FRUSTRATION_RE)?.length ?? 0), 0);

export function heuristicAnalysis(messages: Message[]): ChatMetrics {
  const userMessages = messages.filter((m) => m.role === "user");
  const questionsAsked = userMessages.filter((m) => m.content.includes("?")).length;

  // Success/resolution signals — a student who solved it and thanked us is NOT
  // frustrated, even if they opened with "לא הבנתי". "(?<!לא )הבנתי" matches
  // "הבנתי" (I understood) but not "לא הבנתי" (I didn't understand).
  const SUCCESS_RE = /הצלחתי|פיצחתי|(?<!לא )הבנתי|סוף סוף|עכשיו ברור|ברור לי|תודה|יש!|כן,? הבנתי/;
  // A terse, non-question reply that carries a number/math token reads as an
  // independent answer attempt (e.g. "π/4"), even without hedging words.
  const looksLikeAnswer = (c: string) =>
    !c.includes("?") && (/[0-9π√°∞=]/.test(c) || c.trim().split(/\s+/).length <= 3);
  const lastUserMsg = userMessages[userMessages.length - 1]?.content ?? "";
  const showedSuccess = userMessages.some((m) => SUCCESS_RE.test(m.content));
  const endedPositively = SUCCESS_RE.test(lastUserMsg);

  const frustration = frustrationHits(userMessages);
  // Confusion that was resolved by the end is not lingering frustration.
  const isFrustrated = frustration > 0 && !endedPositively && !showedSuccess;

  const independenceKeywords = ["ניסיתי", "חשבתי", "לפי דעתי", "אולי", "אני חושב", "הגעתי ל", "נראה לי", "חישבתי"];
  const independenceRatio =
    userMessages.length > 0
      ? userMessages.filter((m) =>
          independenceKeywords.some((k) => m.content.includes(k)) || looksLikeAnswer(m.content)
        ).length / userMessages.length
      : 0;

  const timestamps = messages
    .filter((m) => (m as Message & { timestamp?: number }).timestamp)
    .map((m) => (m as Message & { timestamp?: number }).timestamp as number);
  const totalDurationMs =
    timestamps.length >= 2 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;

  // Detect math topics from conversation
  const allText = userMessages.map(m => m.content).join(" ");
  const topicDetectors: [RegExp, string][] = [
    [/סדר|סדרות|חשבונית|הנדסית|a_n|a_1|הפרש/, "סדרות"],
    [/הסתברות|הסתברו|כדור|קלפ|הטלת|מטבע|קובי/, "הסתברות"],
    [/נגזרת|גזירה|פונקצי|שיפוע|משיק/, "חדו\"א - נגזרות"],
    [/אינטגרל|שטח|אנטי/, "חדו\"א - אינטגרלים"],
    [/טריגו|sin|cos|tan|זווית/, "טריגונומטריה"],
    [/וקטור|ישר|מישור|נקודה/, "גיאומטריה אנליטית"],
    [/לוגריתם|log|ln|מעריכ/, "לוגריתמים ומעריכים"],
  ];
  const detectedTopics = topicDetectors
    .filter(([re]) => re.test(allText))
    .map(([, name]) => name);

  // Detect struggle points
  const strugglePoints: string[] = [];
  if (isFrustrated) strugglePoints.push("ביטא תסכול או בלבול");
  if (questionsAsked > 3) strugglePoints.push("שאל הרבה שאלות — ייתכן שלא מבין את הבסיס");
  if (independenceRatio < 0.2 && userMessages.length > 2) strugglePoints.push("לא הציג עבודה עצמית");

  // Extract key student quotes that reveal confusion or understanding
  const revealingPatterns = [
    /לא מבין|לא הבנתי|מבולבל|נתקעתי|קשה לי/,
    /אני חושב|נראה לי|הגעתי ל|ניסיתי/,
    /למה|איך|מה זה|מתי|מה ההבדל/,
    /טעיתי|טעות|לא נכון/,
  ];
  const studentQuotes: string[] = [];
  for (const msg of userMessages) {
    if (revealingPatterns.some(p => p.test(msg.content)) && msg.content.length > 5) {
      studentQuotes.push(msg.content.slice(0, 100));
      if (studentQuotes.length >= 5) break;
    }
  }

  // Detect missing knowledge from repeated questions about same topic
  const missingKnowledge: string[] = [];
  const knowledgeDetectors: [RegExp, string][] = [
    [/מה (זה|היא|הם)?\s*נוסח/, "לא מכיר את הנוסחה הרלוונטית"],
    [/איך מציב|מה מציבים|להציב/, "קושי בהצבה בנוסחה"],
    [/מה (ה)?הפרש|מה (ה)?d\b/, "לא מבין מושג הפרש בסדרה"],
    [/מה (ה)?הסתברות|מה הסיכוי/, "לא מבין חישוב הסתברות"],
    [/נגזרת של|איך גוזרים/, "לא שולט בכללי גזירה"],
    [/לא מבין.*(נוסח|שאל|תרגיל)/, "קושי בהבנת השאלה"],
  ];
  for (const [re, label] of knowledgeDetectors) {
    if (re.test(allText)) missingKnowledge.push(label);
  }

  // Generate teacher action item based on analysis
  let teacherActionItem = "";
  if (endedPositively && !isFrustrated) {
    teacherActionItem = "התלמיד הגיע לפתרון בעצמו עם הכוונה — אפשר להעלות את רמת הקושי או לעבור לנושא הבא";
  } else if (isFrustrated && independenceRatio < 0.2) {
    teacherActionItem = "התלמיד מתוסכל ולא מנסה לבד — מומלץ שיחה אישית ותרגול מודרך על הבסיס";
  } else if (independenceRatio < 0.2) {
    teacherActionItem = "התלמיד לא מציג עבודה עצמית — מומלץ לתת תרגילים עם שלבי ביניים";
  } else if (isFrustrated) {
    teacherActionItem = "התלמיד מנסה אבל מתוסכל — מומלץ לחזור על הנושא בשיעור";
  }

  // A session that opened confused and closed successful is improvement, not "stuck".
  const progressionSignal: ChatMetrics["progressionSignal"] = endedPositively
    ? "improving"
    : isFrustrated
      ? "stuck"
      : "stuck";
  const sentiment: ChatMetrics["sentiment"] = endedPositively
    ? "confident"
    : isFrustrated
      ? "frustrated"
      : "neutral";

  return {
    // One stray "קשה" is mild confusion, not an 80% crisis — scale with how
    // many times the student actually said it.
    confusionScore: endedPositively
      ? Math.min(25, questionsAsked * 8)
      : isFrustrated
        ? Math.min(80, 20 + frustration * 30)
        : Math.max(20, questionsAsked * 10),
    topicsCovered: detectedTopics,
    questionsAsked: userMessages.length,
    avgResponseLength: Math.round(
      userMessages.reduce((s, m) => s + m.content.split(" ").length, 0) /
        Math.max(1, userMessages.length)
    ),
    sentiment,
    keyStrugglePoints: strugglePoints,
    engagementScore: Math.min(100, userMessages.length * 10),
    progressionSignal,
    conceptMentions: detectedTopics,
    totalDurationMs,
    questionDepth: Math.min(5, Math.max(1, questionsAsked)),
    independenceRatio,
    missingKnowledge,
    teacherActionItem: teacherActionItem || undefined,
  };
}

/**
 * Independence for ONE round, 1-5, reused from the heuristic analyser's
 * independenceRatio. Runs at cycle time (no network) so a round keeps its own
 * score even when the composite brief later averages them away.
 */
export function roundAutonomy(messages: Message[]): number {
  const a = heuristicAnalysis(messages);
  const ratio = a.independenceRatio ?? 0;
  // A single-exchange round is one message of evidence: too thin to earn a 1 or
  // a 5, but "tried something" / "just asked" / "stuck" is a real difference.
  // Without this every question-only exchange would score 1 and the whole
  // rounds column would read as one long break point.
  if (messages.filter((m) => m.role === "user").length === 1) {
    return ratio > 0 ? 4 : a.sentiment === "frustrated" ? 2 : 3;
  }
  return clampInt(Math.round(ratio * 4) + 1);
}
const clampInt = (n: number) => Math.max(1, Math.min(5, n));

export async function analyzeConversation(messages: Message[]): Promise<ChatMetrics> {
  const fallback = heuristicAnalysis(messages);

  const conversationText = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "תלמיד" : "AI"}: ${m.content}`)
    .join("\n");
  if (!conversationText.trim()) return fallback;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn("[localAI] analyzeConversation operation timed out, aborting...");
    controller.abort();
  }, 25000);

  try {
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `נתח שיחת תלמיד-מורה והחזר JSON בלבד ללא טקסט נוסף וללא markdown (בלי תגיות \`\`\`json):
{"sentiment":"frustrated"|"neutral"|"confident","confusionScore":0-100,"engagementScore":0-100,"progressionSignal":"improving"|"stuck"|"declining","questionDepth":1-5,"independenceRatio":0.0-1.0,"conceptMentions":["נושאים מתמטיים שהוזכרו"],"keyStrugglePoints":["קשיים ספציפיים: מה בדיוק לא הבין?"],"topicsCovered":["נושאים"],"missingKnowledge":["מושגים/חוקים שהתלמיד לא מכיר וצריך לתרגל"],"teacherActionItem":"המלצה מעשית אחת למורה: מה לעשות בשיעור הבא?","gemmaAnalysisSummary":"סיכום קצר: האם התלמיד התקדם? מה למד? מה עדיין חסר?"}

שיחה:
${conversationText}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA
      }
    };

    const data = await geminiGenerateContent(payload, controller.signal, "analysis", getActiveStudentId());
    clearTimeout(timeoutId);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = parseGeminiJson(text);
    return {
      ...fallback,
      ...parsed,
      confusionScore: Math.max(0, Math.min(100, parsed.confusionScore ?? fallback.confusionScore)),
      engagementScore: Math.max(0, Math.min(100, parsed.engagementScore ?? fallback.engagementScore)),
      questionDepth: Math.max(1, Math.min(5, parsed.questionDepth ?? fallback.questionDepth)),
      independenceRatio: Math.max(0, Math.min(1, parsed.independenceRatio ?? fallback.independenceRatio)),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[localAI] analyzeConversation failed, using fallback:", error);
    return fallback;
  }
}

// ── Composite Brief Generation ──

/** One-line gist of a round, from what the student actually wrote. Local (not
 *  localAI.ts's heuristicSummary) to keep this module free of a cycle. */
function heuristicRoundSummary(messages: Message[]): string {
  const user = messages.filter((m) => m.role === "user");
  const last = user[user.length - 1]?.content?.trim();
  if (!last) return "הסבב האחרון — ללא הודעות מהתלמיד";
  return last.length > 120 ? `${last.slice(0, 120)}…` : last;
}

/**
 * The rounds the teacher reads: ONE EXCHANGE each — the student's message plus
 * Faraday's reply to it. Session cycling is a token-budget mechanism (it fires
 * every 8 messages / 15 min), so a cycle is not what "סבב" means on the
 * analysis screen; using it there collapsed a whole conversation into one row.
 */
function exchangeRounds(
  messages: Message[],
  startIndex: number,
  durationMs: number
): PartialBrief[] {
  const convo = messages.filter((m) => m.role !== "system");
  const rounds: PartialBrief[] = [];
  for (const m of convo) {
    if (m.role === "user") {
      rounds.push({
        sessionIndex: startIndex + rounds.length,
        messageCount: 1,
        durationMs: 0,
        summary: heuristicRoundSummary([m]),
        triggerReason: "question_change",
        autonomyLevel: roundAutonomy([m]),
      });
    } else if (rounds.length) {
      rounds[rounds.length - 1].messageCount++; // the reply belongs to the round it answers
    }
  }
  if (rounds.length === 0) {
    return [{
      sessionIndex: startIndex,
      messageCount: convo.length,
      durationMs,
      summary: heuristicRoundSummary(messages),
      triggerReason: "question_change",
      autonomyLevel: roundAutonomy(messages),
    }];
  }
  // ponytail: no per-message timestamps, so the session's wall-clock is split
  // evenly across its exchanges. Persist message timestamps if a teacher ever
  // needs the real window of a single round.
  const each = Math.round(durationMs / rounds.length);
  return rounds.map((r) => ({ ...r, durationMs: each }));
}

function heuristicBrief(
  messages: Message[],
  partialBriefs: PartialBrief[],
  selfAssessment: string,
  finalRoundDurationMs = 0
): CompositeBrief {
  const userMsgs = messages.filter((m) => m.role === "user");
  const looksLikeAnswer = (c: string) =>
    !c.includes("?") && (/[0-9π√°∞=]/.test(c) || c.trim().split(/\s+/).length <= 3);
  const hasOwnWork = userMsgs.some((m) => /ניסיתי|חשבתי|הגעתי ל|לדעתי|אני חושב/.test(m.content) || looksLikeAnswer(m.content));
  const SUCCESS_RE = /הצלחתי|פיצחתי|(?<!לא )הבנתי|סוף סוף|עכשיו ברור|ברור לי|תודה|יש!|כן,? הבנתי/;
  const showedSuccess = userMsgs.some((m) => SUCCESS_RE.test(m.content));
  const endedPositively = SUCCESS_RE.test(userMsgs[userMsgs.length - 1]?.content ?? "");
  // Confusion resolved by the end is not a lingering friction point.
  const hasFrustration = frustrationHits(userMsgs) > 0 && !endedPositively && !showedSuccess;
  const hasQuestions = userMsgs.filter((m) => m.content.includes("?")).length;

  const revealingPatterns = [
    /לא מבין|לא הבנתי|מבולבל|נתקעתי|קשה לי/,
    /אני חושב|נראה לי|הגעתי ל|ניסיתי/,
    /טעיתי|טעות|לא נכון/,
  ];
  const studentQuotes: string[] = [];
  for (const msg of userMsgs) {
    if (revealingPatterns.some(p => p.test(msg.content)) && msg.content.length > 5) {
      studentQuotes.push(`"${msg.content.slice(0, 80)}${msg.content.length > 80 ? "..." : ""}"`);
      if (studentQuotes.length >= 4) break;
    }
  }

  // Detect missing concepts heuristically
  const allText = userMsgs.map(m => m.content).join(" ");
  const missingConcepts: string[] = [];
  if (/מה (זה|היא)?\s*נוסח|לא יודע.*נוסח/.test(allText)) missingConcepts.push("לא מכיר את הנוסחה");
  if (/איך מציב|מה מציבים/.test(allText)) missingConcepts.push("קושי בהצבה");
  if (/לא מבין.*(שאל|תרגיל|בעי)/.test(allText)) missingConcepts.push("קושי בהבנת השאלה");

  // Generate struggle analysis
  const struggleParts: string[] = [];
  if (hasFrustration) struggleParts.push("התלמיד ביטא תסכול או בלבול במהלך השיחה");
  if (!hasOwnWork && userMsgs.length > 2) struggleParts.push("לא הציג ניסיון עצמאי לפתרון");
  if (hasQuestions > 3) struggleParts.push("שאל שאלות רבות — ייתכן שחסר ידע בסיסי");
  const detailedStruggleAnalysis = struggleParts.length > 0 ? struggleParts.join(". ") + "." : "";

  // Generate next steps
  const nextSteps: string[] = [];
  if (!hasOwnWork) nextSteps.push("לתת תרגילים עם שלבי ביניים מפורטים");
  if (hasFrustration) nextSteps.push("לחזור על הנושא הבסיסי בשיעור");
  if (hasQuestions > 3) nextSteps.push("לבדוק הבנה של המושגים הבסיסיים לפני המשך");

  // The final (still-active) session never went through a cycle, so it has no
  // partial brief of its own — yet its exchanges are the rounds the teacher
  // needs to see, and usually the most telling ones. Earlier cycles keep their
  // one-row-per-block shape: their raw messages are gone by then, only summaries
  // survive, so they cannot be split into exchanges after the fact.
  const allRounds: PartialBrief[] = [
    ...partialBriefs,
    ...exchangeRounds(messages, partialBriefs.length, finalRoundDurationMs),
  ];
  // Totals are the sum over ALL rounds, final one included — otherwise a chat
  // that never cycled reports 0 דק׳ and the teacher's round windows read 0:00.
  const totalMessages = allRounds.reduce((s, b) => s + b.messageCount, 0);
  const totalDuration = allRounds.reduce((s, b) => s + b.durationMs, 0);

  return {
    totalCycles: allRounds.length,
    totalMessages,
    totalDurationMs: totalDuration,
    partialBriefs: allRounds,
    approach: hasOwnWork ? "הציג עבודה עצמית" : "שאל שאלות ישירות",
    frictionPoints: hasFrustration ? ["ביטא תסכול או בלבול"] : [],
    autonomyLevel: hasOwnWork ? 4 : hasQuestions > 3 ? 2 : 3,
    solutionAccuracy: endedPositively ? 4 : showedSuccess ? 4 : 3,
    keyInsight: [
      countOf(totalMessages, "הודעה אחת", "שתי הודעות", "הודעות"),
      questionCount(hasQuestions),
      countOf(allRounds.length, "סבב אחד", "שני סבבים", "סבבים"),
    ].join(", "),
    selfAssessment,
    studentQuotes: studentQuotes.length > 0 ? studentQuotes : undefined,
    missingConcepts: missingConcepts.length > 0 ? missingConcepts : undefined,
    detailedStruggleAnalysis: detailedStruggleAnalysis || undefined,
    nextSteps: nextSteps.length > 0 ? nextSteps : undefined,
  };
}

export async function generateCompositeBrief(
  partialBriefs: PartialBrief[],
  finalSessionMessages: Message[],
  selfAssessment: string,
  /** Wall-clock of the still-active round; only the caller knows when it started. */
  finalRoundDurationMs = 0
): Promise<CompositeBrief> {
  const fallback = heuristicBrief(finalSessionMessages, partialBriefs, selfAssessment, finalRoundDurationMs);

  const partialSummaries = partialBriefs.map((b, i) => `סבב ${i + 1}: ${b.summary}`).join("\n");
  const finalConvo = finalSessionMessages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "תלמיד" : "מורה"}: ${m.content}`)
    .join("\n");
  const analysisText = [
    partialSummaries ? `סיכומי סבבים:\n${partialSummaries}` : "",
    `שיחה אחרונה:\n${finalConvo}`,
    `הערכה עצמית:\n"${selfAssessment}"`,
  ].filter(Boolean).join("\n---\n");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn("[localAI] generateCompositeBrief operation timed out, aborting...");
    controller.abort();
  }, 25000);

  try {
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `נתח שיחת תרגול והחזר JSON בלבד ללא טקסט נוסף וללא markdown (בלי תגיות \`\`\`json):
{"approach":"גישת התלמיד: ניסה לבד? שאל? חיפש פתרון מהיר?","frictionPoints":["נקודות שנתקע"],"autonomyLevel":1-5,"solutionAccuracy":1-5,"keyInsight":"תובנה אחת שהמורה חייב לדעת","missingConcepts":["מושגים/נוסחאות שהתלמיד לא שולט בהם"],"teacherActionItem":"המלצה מעשית: מה לעשות בשיעור הבא","detailedStruggleAnalysis":"תאר בפירוט איפה התלמיד נתקע ולמה","nextSteps":["תרגילים/נושאים ספציפיים שהתלמיד צריך לעבוד עליהם"],"studentQuotes":["ציטוטים חשובים מהתלמיד שחושפים הבנה/בלבול"]}

נתונים:
${analysisText}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: BRIEF_SCHEMA
      }
    };

    const data = await geminiGenerateContent(payload, controller.signal, "analysis", getActiveStudentId());
    clearTimeout(timeoutId);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = parseGeminiJson(text);
    return {
      ...fallback,
      ...parsed,
      // fallback's list, not the raw input — it carries the appended final round.
      partialBriefs: fallback.partialBriefs,
      selfAssessment,
      autonomyLevel: Math.max(1, Math.min(5, parsed.autonomyLevel ?? fallback.autonomyLevel)),
      solutionAccuracy: Math.max(1, Math.min(5, parsed.solutionAccuracy ?? fallback.solutionAccuracy)),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[localAI] generateCompositeBrief failed, using fallback:", error);
    return fallback;
  }
}
