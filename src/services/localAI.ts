import type { AgentType, ChatMetrics } from "./localAI.types";
import type { WorkerRequest, WorkerResponse } from "./localAI.worker";

export type { AgentType, ChatMetrics };

export interface Message {
  role: "user" | "model" | "system";
  content: string;
}

// ── Configuration & Prompts ──

const PRACTICE_AGENT_PROMPT = `אתה מורה פרטי למתמטיקה 5 יח"ל (שאלון 581).
הוראות קריטיות:
- לעולם אל תציג את עצמך. אל תגיד "שלום, אני..." או כל הצגה עצמית.
- ענה בעברית בלבד, תמיד.
- ענה בקצרה ובדייקנות. מקסימום 3 משפטים אלא אם התלמיד מבקש הסבר מפורט.
- אל תחזור על מה שהתלמיד אמר. אל תחזור על הוראות אלו.
- אל תיתן את הפתרון. תן רמז ממוקד אחד שיכוון לכיוון הנכון.
- אם יש סיכום שיחה קודמת, השתמש בו כהקשר ואל תחזור על מה שכבר נדון.`;

const HOMEWORK_AGENT_PROMPT = `אתה מורה פרטי למתמטיקה 5 יח"ל (שאלון 581).
הוראות קריטיות:
- לעולם אל תציג את עצמך. אל תגיד "שלום, אני..." או כל הצגה עצמית.
- ענה בעברית בלבד, תמיד.
- ענה בקצרה ובדייקנות. מקסימום 3 משפטים אלא אם התלמיד מבקש הסבר מפורט.
- אל תחזור על מה שהתלמיד אמר. אל תחזור על הוראות אלו.
- הסבר צעד אחר צעד. שאל את התלמיד על מה בדיוק הוא נתקע.
- אם יש סיכום שיחה קודמת, השתמש בו כהקשר ואל תחזור על מה שכבר נדון.`;

// ── Worker Singleton ──

let worker: Worker | null = null;
let currentAgentType: AgentType | null = null;
let currentContext: string = "";

// ── Initialization Progress Event ──

type ProgressCallback = (percent: number, stage: string) => void;
let onInitProgress: ProgressCallback | null = null;
let initPromise: Promise<void> | null = null;
let isReady = false;
let isFailed = false;

export function onModelProgress(cb: ProgressCallback) {
  onInitProgress = cb;
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./localAI.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "init:progress") {
        onInitProgress?.(msg.percent, msg.stage);
      }
    };
  }
  return worker;
}

export async function isLocalAIAvailable(): Promise<boolean> {
  if (!(navigator as any).gpu || isFailed) return false;
  return true;
}

export function getAIStatus(): "unavailable" | "downloading" | "ready" {
  if (!(navigator as any).gpu || isFailed) return "unavailable";
  if (isReady) return "ready";
  return "downloading";
}

// ── Session ──

export async function preloadModel() {
  await createSession("practice");
}

export async function createSession(
  agentType: AgentType,
  questionContext?: string
): Promise<boolean> {
  if (!(navigator as any).gpu) return false;

  currentAgentType = agentType;
  currentContext = questionContext || "";

  if (isReady) return true;

  if (!initPromise) {
    initPromise = new Promise((resolve, reject) => {
      const w = getWorker();
      
      const onMessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === "init:ready") {
          isReady = true;
          w.removeEventListener("message", onMessage);
          resolve();
        } else if (msg.type === "init:error") {
          w.removeEventListener("message", onMessage);
          reject(new Error(msg.error));
        }
      };
      
      w.addEventListener("message", onMessage);
      w.postMessage({ type: "init" } as WorkerRequest);
    });
  }

  try {
    await initPromise;
    return true;
  } catch (e) {
    console.error("Failed to initialize model:", e);
    isFailed = true;
    return false;
  }
}

export function destroySession() {
  currentAgentType = null;
  currentContext = "";
}

// ── Context Compaction ──
// Gemma 3n E2B has ~4096 token context. We compact after 4 user turns to
// prevent quality degradation. Old messages are replaced with a summary.

/** Rough token estimate for Hebrew text (~0.5 tokens per character) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length * 0.5);
}

/** Check if history needs compaction (>4 user messages) */
export function needsCompaction(history: Message[]): boolean {
  const userCount = history.filter((m) => m.role === "user").length;
  return userCount > 4;
}

/** Build a heuristic summary from old messages (no GPU needed) */
export function heuristicSummary(messages: Message[]): string {
  const userMsgs = messages.filter((m) => m.role === "user");
  const modelMsgs = messages.filter((m) => m.role === "model");

  const points: string[] = [];
  for (const m of userMsgs) {
    const trimmed = m.content.slice(0, 60);
    points.push(`• שאלת התלמיד: ${trimmed}${m.content.length > 60 ? "..." : ""}`);
  }
  if (modelMsgs.length > 0) {
    const lastAnswer = modelMsgs[modelMsgs.length - 1].content.slice(0, 80);
    points.push(`• תשובה אחרונה של המורה: ${lastAnswer}...`);
  }
  return points.join("\n");
}

/** Request Gemma to summarize old messages, with 5s timeout to heuristic fallback */
async function gemmaSummary(oldMessages: Message[]): Promise<string> {
  if (!isReady) return heuristicSummary(oldMessages);

  const conversationText = oldMessages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "תלמיד" : "מורה"}: ${m.content}`)
    .join("\n");

  const id = Math.random().toString(36).substring(7);

  return new Promise((resolve) => {
    const w = getWorker();
    const timeout = setTimeout(() => {
      w.removeEventListener("message", onMessage);
      resolve(heuristicSummary(oldMessages));
    }, 5000);

    const onMessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "summarize:done" && msg.id === id) {
        clearTimeout(timeout);
        w.removeEventListener("message", onMessage);
        resolve(msg.text.trim());
      } else if (msg.type === "summarize:error" && msg.id === id) {
        clearTimeout(timeout);
        w.removeEventListener("message", onMessage);
        resolve(heuristicSummary(oldMessages));
      }
    };

    w.addEventListener("message", onMessage);
    w.postMessage({ type: "summarize", conversationText, id } as WorkerRequest);
  });
}

/**
 * Compact conversation history: summarize old messages, keep the most recent 4.
 * Returns a new array where the first element is a summary system message.
 */
export async function compactHistory(history: Message[]): Promise<Message[]> {
  if (!needsCompaction(history)) return history;

  // Keep the last 4 non-system messages
  const nonSystem = history.filter((m) => m.role !== "system");
  const keepCount = 4;
  const oldMessages = nonSystem.slice(0, -keepCount);
  const recentMessages = nonSystem.slice(-keepCount);

  // Get summary
  const summary = await gemmaSummary(oldMessages);

  // Build compacted history
  const summaryMsg: Message = {
    role: "system",
    content: `[סיכום שיחה קודמת]: ${summary}`,
  };

  return [summaryMsg, ...recentMessages];
}

// ── Prompt Formatting (Gemma 3n) ──

function formatGemmaPrompt(
  agentType: AgentType,
  context: string,
  userMessage: string,
  history?: Message[]
): string {
  const basePrompt =
    agentType === "practice" ? PRACTICE_AGENT_PROMPT : HOMEWORK_AGENT_PROMPT;
  const systemPrompt = context
    ? `${basePrompt}\n\nהקשר השאלה הנוכחית:\n${context}`
    : basePrompt;

  let prompt = "";

  // The very first turn should include the system instructions
  if (!history || history.length === 0) {
    prompt += `<start_of_turn>user\n${systemPrompt}\n[User]: ${userMessage}<end_of_turn>\n<start_of_turn>model\n`;
    return prompt;
  }

  // Construct history
  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    if (msg.role === "system") continue;

    const role = msg.role === "user" ? "user" : "model";
    let content = msg.content;

    if (i === 0 || (i === 1 && history[0].role === "system")) {
      content = `${systemPrompt}\n[User]: ${content}`;
    }

    prompt += `<start_of_turn>${role}\n${content}<end_of_turn>\n`;
  }

  // Add the current user turn
  prompt += `<start_of_turn>user\n${userMessage}<end_of_turn>\n<start_of_turn>model\n`;

  return prompt;
}

// ── Generation ──

export async function streamMessage(
  message: string,
  onChunk: (fullText: string) => void,
  conversationHistory?: Message[]
): Promise<string> {
  if (!isReady) return "עדיין טוען מודל עוזר... אנא המתן.";

  // Compact history if it's getting long
  let history = conversationHistory;
  if (history && needsCompaction(history)) {
    history = await compactHistory(history);
  }

  const prompt = formatGemmaPrompt(
    currentAgentType || "practice",
    currentContext,
    message,
    history
  );
  
  const id = Math.random().toString(36).substring(7);

  return new Promise((resolve, reject) => {
    const w = getWorker();
    
    const onMessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "generate:partial" && msg.id === id) {
        onChunk(msg.text);
      } else if (msg.type === "generate:done" && msg.id === id) {
        w.removeEventListener("message", onMessage);
        resolve(msg.text);
      } else if (msg.type === "generate:error" && msg.id === id) {
        w.removeEventListener("message", onMessage);
        reject(new Error(msg.error));
      }
    };
    
    w.addEventListener("message", onMessage);
    w.postMessage({ type: "generate", prompt, id } as WorkerRequest);
  });
}

// ── Analysis ──

/** Heuristic fallback analysis (no GPU needed) */
export function heuristicAnalysis(messages: Message[]): ChatMetrics {
  const userMessages = messages.filter((m) => m.role === "user");
  const questionsAsked = userMessages.filter((m) => m.content.includes("?")).length;
  const frustrationKeywords = ["לא מבין", "קשה", "בלבול", "אוף", "תסכול", "נתקעתי"];
  const isFrustrated = userMessages.some((m) =>
    frustrationKeywords.some((k) => m.content.includes(k))
  );
  const independenceKeywords = ["ניסיתי", "חשבתי", "לפי דעתי", "אולי", "אני חושב"];
  const independenceRatio =
    userMessages.length > 0
      ? userMessages.filter((m) =>
          independenceKeywords.some((k) => m.content.includes(k))
        ).length / userMessages.length
      : 0;

  const timestamps = messages
    .filter((m) => (m as any).timestamp)
    .map((m) => (m as any).timestamp as number);
  const totalDurationMs =
    timestamps.length >= 2
      ? timestamps[timestamps.length - 1] - timestamps[0]
      : 0;

  return {
    confusionScore: isFrustrated ? 80 : Math.max(20, questionsAsked * 10),
    topicsCovered: [],
    questionsAsked: userMessages.length,
    avgResponseLength: Math.round(
      userMessages.reduce((s, m) => s + m.content.split(" ").length, 0) /
        Math.max(1, userMessages.length)
    ),
    sentiment: isFrustrated ? "frustrated" : "neutral",
    keyStrugglePoints: [],
    engagementScore: Math.min(100, userMessages.length * 10),
    progressionSignal: "stuck",
    conceptMentions: [],
    totalDurationMs,
    questionDepth: Math.min(5, Math.max(1, questionsAsked)),
    independenceRatio,
  };
}

/** Format messages as readable conversation text for the analysis prompt */
function formatConversationForAnalysis(messages: Message[]): string {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "תלמיד" : "AI"}: ${m.content}`)
    .join("\n");
}

/** Analyze conversation using Gemma for rich insights, with heuristic fallback */
export async function analyzeConversation(messages: Message[]): Promise<ChatMetrics> {
  const fallback = heuristicAnalysis(messages);

  if (!isReady) return fallback;

  const conversationText = formatConversationForAnalysis(messages);
  if (!conversationText.trim()) return fallback;

  const id = Math.random().toString(36).substring(7);

  return new Promise((resolve) => {
    const w = getWorker();
    const timeout = setTimeout(() => {
      w.removeEventListener("message", onMessage);
      resolve(fallback);
    }, 15000);

    const onMessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "analyze:done" && msg.id === id) {
        clearTimeout(timeout);
        w.removeEventListener("message", onMessage);
        try {
          const clean = msg.json.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
          const parsed = JSON.parse(clean);
          resolve({
            ...fallback,
            ...parsed,
            confusionScore: Math.max(0, Math.min(100, parsed.confusionScore ?? fallback.confusionScore)),
            engagementScore: Math.max(0, Math.min(100, parsed.engagementScore ?? fallback.engagementScore)),
            questionDepth: Math.max(1, Math.min(5, parsed.questionDepth ?? fallback.questionDepth)),
            independenceRatio: Math.max(0, Math.min(1, parsed.independenceRatio ?? fallback.independenceRatio)),
          });
        } catch {
          resolve({ ...fallback, gemmaAnalysisSummary: msg.json.slice(0, 200) });
        }
      } else if (msg.type === "analyze:error" && msg.id === id) {
        clearTimeout(timeout);
        w.removeEventListener("message", onMessage);
        resolve(fallback);
      }
    };

    w.addEventListener("message", onMessage);
    w.postMessage({ type: "analyze", conversationText, id } as WorkerRequest);
  });
}


// ── Fallback mock for browsers without WebGPU ──

export function getMockResponse(
  userMessage: string,
  conversationHistory?: Message[]
): string {
  const msg = userMessage.toLowerCase();
  const msgCount = conversationHistory?.filter((m) => m.role === "user").length ?? 0;

  if (msg.match(/^(היי|הי|שלום|בוקר טוב|ערב טוב|מה נשמע|אהלן)/)) {
    return "איך אפשר לעזור? 😊 (מצב הדגמה — הדפדפן לא תומך במודל AI מלא)";
  }

  if (msg.match(/(לא מבין|לא הבנתי|לא ברור|מבולבל|קשה לי|עזרה)/)) {
    return "נסה לפרק את השאלה לחלקים. מה הנתון הראשון שאתה מזהה? (מצב הדגמה)";
  }

  if (msg.match(/(סדר|סדרות|סכום|חשבוני|הנדסי)/)) {
    return `בסדרות חשוב לזכור:\n• חשבונית: הפרש קבוע d\n• הנדסית: מנה קבועה q\n(מצב הדגמה)`;
  }

  if (msgCount >= 3) {
    return "אתה מתקדם יפה! על מה תרצה לעבוד עכשיו? (מצב הדגמה)";
  }

  return `שאלה טובה! "${userMessage.slice(0, 30)}..." — הדפדפן לא תומך במודל AI מלא, אז זה מענה מדומה.`;
}
