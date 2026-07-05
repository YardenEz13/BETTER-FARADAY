import type { AgentType, ChatMetrics, PartialBrief, CompositeBrief, Message } from "./localAI.types";
import { CONVEX_SITE_URL, GEMINI_STREAM_URL } from "./localAI.gemini";

export type { AgentType, ChatMetrics, PartialBrief, CompositeBrief, Message };

// Conversation analytics & composite briefs live in localAI.analysis.ts; the two
// Gemini vision passes (notebook check, question extraction) live in
// localAI.vision.ts. Re-exported here so the `localAI` barrel stays the single
// import surface for the rest of the app.
export {
  heuristicAnalysis,
  analyzeConversation,
  generateCompositeBrief,
} from "./localAI.analysis";
export {
  checkNotebookImage,
  extractQuestionFromMedia,
  type NotebookImage,
  type ExtractedQuestionDraft,
} from "./localAI.vision";

const PRACTICE_AGENT_PROMPT = `אתה פאראדיי — מורה פרטי חם, סבלני ותומך למתמטיקה. המטרה שלך היא שהתלמיד באמת יבין, לא רק יקבל תשובה.

עקרונות:
1. השב תמיד בעברית, בגובה העיניים, עם חום ועידוד.
2. התייחס למה שהתלמיד כתב: אם ענה נכון — אשר ושבח; אם טעה — הצבע בעדינות היכן ולמה.
3. הסבר את האינטואיציה מאחורי הרעיון, לא רק את הנוסחה היבשה.
4. פרק בעיות לצעדים קטנים, ברורים וממוספרים.
5. כתוב תמציתי (2-4 משפטים או רשימת צעדים קצרה), ורמת העזרה תיקבע לפי הנחיית ה"רמת עזרה" שתקבל בהמשך.`;

const HOMEWORK_AGENT_PROMPT = `אתה פאראדיי — עוזר שיעורי בית חם וסבלני למתמטיקה. המטרה שלך היא שהתלמיד באמת יבין את החומר.

עקרונות:
1. השב תמיד בעברית, בגובה העיניים, עם חום ועידוד.
2. התייחס למה שהתלמיד כתב: אם ענה נכון — אשר ושבח; אם טעה — הצבע בעדינות היכן ולמה.
3. הסבר את האינטואיציה מאחורי הרעיון, לא רק את הנוסחה היבשה.
4. פרק בעיות לצעדים קטנים, ברורים וממוספרים.
5. כתוב תמציתי, ורמת העזרה תיקבע לפי הנחיית ה"רמת עזרה" שתקבל בהמשך.`;

// Adaptive escalation: the client tracks how stuck the student is on the current
// question and passes a level 0-3. Each level unlocks more help. Levels 2-3 permit
// numbers/computation, so the Socratic numeric filter is bypassed for them.
export type StruggleLevel = 0 | 1 | 2 | 3;

export function escalationDirective(level: StruggleLevel): string {
  switch (level) {
    case 0:
      return `רמת עזרה — רמז: הצג את הנוסחה או הרעיון הכללי הרלוונטי (ב-$...$) ושאלה מנחה אחת. אל תבצע חישוב, אל תציב מספרים ואל תגלה את התשובה.`;
    case 1:
      return `רמת עזרה — הסבר מושג: התלמיד מתקשה. הסבר את המושג והשיטה במילים פשוטות, פרק לצעדים ממוספרים, אך השאר את החישוב הסופי לתלמיד — אל תציב את המספרים שלו עד הסוף.`;
    case 2:
      return `רמת עזרה — דוגמה: התלמיד עדיין תקוע. הדגם את השיטה מההתחלה ועד הסוף על דוגמה דומה עם מספרים אחרים משל השאלה, ואז בקש מהתלמיד ליישם את אותה שיטה על השאלה שלו. מותר להשתמש במספרים בדוגמה.`;
    default:
      return `רמת עזרה — פתרון מלא: התלמיד מתוסכל וביקש/צריך את הפתרון. פתור את השאלה שלו צעד־אחר־צעד עם כל המספרים והחישובים, הסבר כל מעבר בקצרה, ובסוף ודא שהתלמיד הבין ("איזה שלב היה הכי לא ברור?"). מותר לגלות את התשובה הסופית.`;
  }
}

const PROOF_AGENT_PROMPT = `אתה פאראדיי — מנחה להוכחות גיאומטריות בשיטה הסוקרטית. מטרתך לכוון את התלמיד לכתוב את ההוכחה בעצמו.

כללים:
1. השב תמיד בעברית בלבד.
2. מותר לציין שמות משפטים (SAS, ASA, SSS, זוויות קודקוד, זוויות מתחלפות וכו׳) כרמז.
3. אסור לכתוב את הצעד השלם — כוון עם שאלה מנחה בלבד.
4. אם התלמיד נתקע: "איזה נתון כבר הוכחת?" / "איזה משפט מתחבר לנתונים האלה?".
5. השב ב-2-3 משפטים קצרים.
6. אסור לכתוב את ההוכחה המלאה או לסכם את כל הצעדים ברצף.`;

// ── State ──
let currentAgentType: AgentType | null = null;
let currentContext: string = "";

type ProgressCallback = (percent: number, stage: string) => void;
let onInitProgress: ProgressCallback | null = null;
let isReady = false;
let isFailed = false;

// ── Progress ──
export function onModelProgress(cb: ProgressCallback) {
  onInitProgress = cb;
  if (isReady) {
    setTimeout(() => cb(100, "מוכן!"), 0);
  }
}

// ── Think-block stripping ──
export function stripThinkBlock(text: string): string {
  // Remove all closed think blocks
  let stripped = text.replace(/<think>[\s\S]*?<\/think>\s*/g, "");
  // Remove any trailing unclosed think block
  const lastThinkIdx = stripped.lastIndexOf("<think>");
  if (lastThinkIdx !== -1) {
    stripped = stripped.slice(0, lastThinkIdx);
  }
  return stripped.trim();
}

// ── Socratic Rule Validation ──
export function violatesSocraticRules(text: string): boolean {
  // 1. Extract all LaTeX math blocks (content between $ or $$)
  const mathRegex = /\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;
  let match;
  while ((match = mathRegex.exec(text)) !== null) {
    const fullMathBlock = match[0];
    const mathContent = match[1] || match[2] || "";

    // If the exact math block appears in the question context, it is allowed as context repetition
    if (currentContext && (currentContext.includes(fullMathBlock) || currentContext.includes(mathContent))) {
      continue;
    }

    // Check if the math block contains active math operations/operators
    const hasOperators = /[+\-*/^]|\\[f]rac|\\cdot|\\times|\\div|\\pm|\\sqrt/g.test(mathContent);
    if (hasOperators) {
      const numbers = mathContent.match(/\d+/g);
      if (numbers) {
        for (const num of numbers) {
          // Allow isolated 1, 2, 4 (used in general formulas)
          if (num !== "1" && num !== "2" && num !== "4") {
            // Allow numbers that are part of the original question context
            const numRegex = new RegExp(`\\b${num}\\b`);
            if (currentContext && numRegex.test(currentContext)) {
              continue;
            }
            console.log("[localAI] Socratic violation: math block contains calculation with number", num);
            return true;
          }
        }
      }
    }
  }

  // 2. Check for explicit arithmetic calculations or assignments outside math blocks or across the text
  const equalsMatch = text.match(/=\s*[+-]?\s*(\d+)/g);
  if (equalsMatch) {
    for (const matchStr of equalsMatch) {
      const numMatch = matchStr.match(/\d+/);
      if (numMatch && currentContext) {
        const numRegex = new RegExp(`\\b${numMatch[0]}\\b`);
        if (numRegex.test(currentContext)) {
          continue; // Allow assignment if the number is from the context
        }
      }
      console.log("[localAI] Socratic violation: contains '=' followed by a number:", numMatch?.[0]);
      return true;
    }
  }

  // 3. Check for division of numbers (like fraction answers "17/20" or "6/36")
  if (/\b\d+\s*\/\s*\d+\b/g.test(text)) {
    console.log("[localAI] Socratic violation: contains a fraction number");
    return true;
  }

  return false;
}

// ── Availability ──
export async function isLocalAIAvailable(): Promise<boolean> {
  return !isFailed;
}

export function getAIStatus(): "unavailable" | "downloading" | "ready" {
  if (isFailed) return "unavailable";
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
  currentAgentType = agentType;
  currentContext = questionContext || "";
  isReady = true;
  isFailed = false;
  setTimeout(() => onInitProgress?.(100, "מוכן!"), 0);
  return true;
}

export function handleAICrash(error: unknown) {
  console.error("[localAI] AI System error. Error:", error);
  isReady = false;
  isFailed = false;
}

export async function reinitSession(
  agentType: AgentType,
  questionContext?: string
): Promise<boolean> {
  return createSession(agentType, questionContext);
}

export function isGPUMode(): boolean {
  return false;
}

export function destroySession() {
  currentAgentType = null;
  currentContext = "";
}

// ── Context Compaction ──
export function estimateTokens(text: string): number {
  return Math.ceil(text.length * 0.5);
}

export function needsCompaction(history: Message[]): boolean {
  return history.filter((m) => m.role === "user").length > 4;
}

export function heuristicSummary(messages: Message[]): string {
  const userMsgs = messages.filter((m) => m.role === "user");
  const modelMsgs = messages.filter((m) => m.role === "model" || (m as { role: string }).role === "assistant");
  const points: string[] = [];
  for (const m of userMsgs) {
    const trimmed = m.content.slice(0, 60);
    points.push(`• שאלת התלמיד: ${trimmed}${m.content.length > 60 ? "..." : ""}`);
  }
  if (modelMsgs.length > 0) {
    const lastAnswer = modelMsgs[modelMsgs.length - 1].content.slice(0, 80);
    points.push(`• תשובה אחרונה: ${lastAnswer}...`);
  }
  return points.join("\n");
}

export async function compactHistory(history: Message[]): Promise<Message[]> {
  if (!needsCompaction(history)) return history;
  const nonSystem = history.filter((m) => m.role !== "system");
  const keepCount = 4;
  const oldMessages = nonSystem.slice(0, -keepCount);
  const recentMessages = nonSystem.slice(-keepCount);
  const summary = heuristicSummary(oldMessages);
  return [{ role: "system", content: `[סיכום שיחה קודמת]: ${summary}` }, ...recentMessages];
}

// ── Debug State ──
export interface AIDebugState {
  promptMessages: { role: string; content: string }[] | null;
  promptTokenEstimate: number;
  historyLength: number;
  wasCompacted: boolean;
  rawStream: string;
  thinkBlock: string;
  visibleResponse: string;
  isGenerating: boolean;
  chunkCount: number;
  generationParams: {
    temperature: number;
    max_tokens: number;
  } | null;
  gpuMode: boolean;
  modelUrl: string;
  lastUpdateMs: number;
}

const _debugState: AIDebugState = {
  promptMessages: null,
  promptTokenEstimate: 0,
  historyLength: 0,
  wasCompacted: false,
  rawStream: "",
  thinkBlock: "",
  visibleResponse: "",
  isGenerating: false,
  chunkCount: 0,
  generationParams: null,
  gpuMode: false,
  modelUrl: "Google Gemini 2.5 Flash",
  lastUpdateMs: 0,
};

const _debugListeners: Array<(state: AIDebugState) => void> = [];

export function onDebugUpdate(cb: (state: AIDebugState) => void): () => void {
  _debugListeners.push(cb);
  return () => {
    const idx = _debugListeners.indexOf(cb);
    if (idx >= 0) _debugListeners.splice(idx, 1);
  };
}

export function getDebugState(): Readonly<AIDebugState> {
  return _debugState;
}

function _notifyDebug(): void {
  _debugState.lastUpdateMs = Date.now();
  const snapshot: AIDebugState = {
    ..._debugState,
    promptMessages: _debugState.promptMessages ? [..._debugState.promptMessages] : null,
  };
  for (const cb of _debugListeners) {
    try { cb(snapshot); } catch { /* ignore listener errors */ }
  }
}

function _extractThinkContent(rawText: string): string {
  const start = rawText.indexOf("<think>");
  if (start === -1) return "";
  const end = rawText.indexOf("</think>");
  if (end === -1) return rawText.slice(start + 7);
  return rawText.slice(start + 7, end);
}

function buildSystemPrompt(agentType: AgentType, context: string, struggleLevel: StruggleLevel = 0): string {
  const base = agentType === "proof"
    ? PROOF_AGENT_PROMPT
    : agentType === "practice"
    ? PRACTICE_AGENT_PROMPT
    : HOMEWORK_AGENT_PROMPT;
  // Proof mode has its own (non-numeric) pedagogy; only inject escalation for practice/homework.
  const escalation = agentType === "proof" ? "" : `\n\n${escalationDirective(struggleLevel)}`;
  if (!context) return base + escalation;
  // Put the active question AFTER the rules and examples with explicit emphasis
  // so the model doesn't confuse it with the few-shot examples that follow.
  return `${base}

<examples>
דוגמה 1:
תלמיד: "מה המחזור של f(x)=cos(3x)?"
מורה: "כדי למצוא את המחזור של פונקציית קוסינוס מהצורה $\\cos(kx)$, משתמשים בנוסחה $T=\\frac{2\\pi}{k}$. מה הוא הערך של $k$ בפונקציה שלך?"
תלמיד: "אני לא יודע, תעזור לי"
מורה: "בפונקציה שלך, $f(x)=\\cos(3x)$, המקדם של $x$ בתוך הקוסינוס הוא ה-$k$ שלנו. לפי זה, מהו הערך של $k$?"

דוגמה 2:
תלמיד: "מה סכום 10 האיברים הראשונים בסדרה 3,7,11...?"
מורה: "הנוסחה לסכום $n$ איברים בסדרה חשבונית היא $S_n=\\frac{n}{2}(a_1+a_n)$. מה הם $n$ ו-$a_1$ לפי הנתונים שלך?"
תלמיד: "תעזור לי בבקשה, לא הבנתי"
מורה: "בסדרה שלך, $3,7,11,\\dots$, האיבר הראשון בסדרה הוא $a_1$ ומספר האיברים שרוצים לסכם הוא $n$. לפי הנתונים האלו, מהו האיבר הראשון ומהו מספר האיברים?"
</examples>

=== שאלה פעילה (התייחס לזו בלבד — ספק הדרכה לשאלה זו ולא לדוגמאות לעיל) ===
${context}
=== סוף שאלה פעילה ===${escalation}`;
}

function buildGeminiPayload(
  agentType: AgentType,
  context: string,
  userMessage: string,
  history?: Message[],
  struggleLevel: StruggleLevel = 0
) {
  let systemContent = buildSystemPrompt(agentType, context, struggleLevel);
  const historyToUse = history ? [...history] : [];
  if (historyToUse.length > 0 && historyToUse[0].role === "system") {
    systemContent += `\n\n${historyToUse[0].content}`;
    historyToUse.shift();
  }

  const contents: Array<{ role: string; parts: { text: string }[] }> = [];

  // Clear few-shot examples from here. They are now safely isolated in the system prompt.

  // Add history
  for (const msg of historyToUse) {
    if (msg.role === "system") continue;
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }]
    });
  }

  // Current message with a trailing constraint that matches the current help level.
  // Levels 0-1 stay Socratic (no numbers); levels 2-3 allow worked numbers.
  const TRAILING_CONSTRAINT = struggleLevel <= 1
    ? "\n\n[הנחיית מערכת: ענה בעברית בלבד. אל תגלה את התשובה הסופית ואל תבצע את החישוב הסופי עבור התלמיד. פעל לפי רמת העזרה שהוגדרה.]"
    : "\n\n[הנחיית מערכת: ענה בעברית בלבד. פעל לפי רמת העזרה שהוגדרה — מותר להשתמש במספרים ובחישובים כדי לעזור לתלמיד באמת.]";
  contents.push({
    role: "user",
    parts: [{ text: userMessage + TRAILING_CONSTRAINT }]
  });

  // Track in debug state
  const promptMessagesForDebug: { role: string; content: string }[] = [];
  promptMessagesForDebug.push({ role: "system", content: systemContent });
  for (const item of contents) {
    promptMessagesForDebug.push({
      role: item.role,
      content: item.parts[0].text
    });
  }
  _debugState.promptMessages = promptMessagesForDebug;
  _debugState.promptTokenEstimate = promptMessagesForDebug.reduce((acc, m) => acc + estimateTokens(m.content), 0);
  _notifyDebug();

  return {
    contents,
    systemInstruction: {
      parts: [{ text: systemContent }]
    },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024
    }
  };
}

// ── Generation ──
export async function streamMessage(
  message: string,
  onChunk: (fullText: string) => void,
  conversationHistory?: Message[],
  abortSignal?: AbortSignal,
  contextOverride?: { agentType?: AgentType; questionContext?: string; struggleLevel?: StruggleLevel }
): Promise<string> {
  console.log("[localAI] streamMessage called. isReady:", isReady);

  if (!CONVEX_SITE_URL) {
    console.warn("[localAI] VITE_CONVEX_URL is not defined — cannot reach the Gemini proxy.");
    return "שגיאה: כתובת השרת (VITE_CONVEX_URL) אינה מוגדרת.";
  }

  const wasCompacted = !!(conversationHistory && needsCompaction(conversationHistory));
  let history = conversationHistory;
  if (wasCompacted) {
    console.log("[localAI] streamMessage: history needs compaction, compacting...");
    history = await compactHistory(history!);
  }

  // contextOverride lets the caller pass fresh context even if the module state is stale
  const effectiveAgentType = contextOverride?.agentType ?? currentAgentType ?? "practice";
  const effectiveContext = contextOverride?.questionContext ?? currentContext;
  const struggleLevel = (contextOverride?.struggleLevel ?? 0) as StruggleLevel;
  // The numeric Socratic filter must be skipped when numbers are legitimately allowed:
  // proof mode (theorem "= <name>" hints) and help levels 2-3 (worked example / full
  // solution), where the student is stuck enough to warrant real computation.
  const isProofMode = effectiveAgentType === "proof";
  const allowNumbers = isProofMode || struggleLevel >= 2;

  const payload = buildGeminiPayload(
    effectiveAgentType,
    effectiveContext,
    message,
    history,
    struggleLevel
  );

  // ── Initialize debug state for this generation ──
  _debugState.rawStream = "";
  _debugState.thinkBlock = "";
  _debugState.visibleResponse = "";
  _debugState.isGenerating = true;
  _debugState.chunkCount = 0;
  _debugState.wasCompacted = wasCompacted;
  _debugState.historyLength = conversationHistory?.filter(m => m.role !== "system").length ?? 0;
  _debugState.gpuMode = false;
  _debugState.generationParams = {
    temperature: 0.3,
    max_tokens: 1024,
  };
  _notifyDebug();

  let rawText = "";
  let lastVisible = "";

  // Chat task tier: quality model first, fall back on rate-limit (429) through
  // cheaper/older models — each is a separate free-tier quota bucket, so keeping
  // all of them maximizes total free throughput. Must match convex/geminiModels.ts
  // GEMINI_MODELS.chat.
  const MODELS = [
    "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3-flash",
    "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash",
  ];
  const MAX_RETRIES = 2; // per model

  async function fetchWithRetry(modelName: string, signal?: AbortSignal): Promise<Response> {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 2s, 4s — longer waits help with 429 rate limits
        const delay = 2000 * Math.pow(2, attempt - 1);
        console.log(`[localAI] Retry ${attempt}/${MAX_RETRIES - 1} for ${modelName} after ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
      }
      // POST to the Convex proxy (server adds the key) — same payload as before,
      // now tagged with the model so the proxy knows which Gemini model to call.
      const res = await fetch(GEMINI_STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName, payload }),
        signal,
      });
      if (res.ok) return res;
      if (res.status === 429) {
        lastErr = new Error(`Gemini streaming API error: ${res.status} ${res.statusText}`);
        console.warn(`[localAI] ${modelName} rate limited (429). attempt=${attempt}`);
        continue; // retry same model
      }
      // Other errors — throw immediately
      throw new Error(`Gemini streaming API error: ${res.status} ${res.statusText}`);
    }
    throw lastErr!;
  }

  async function tryModels(signal?: AbortSignal): Promise<Response> {
    let lastErr: Error | null = null;
    for (const model of MODELS) {
      try {
        console.log(`[localAI] streamMessage: trying model ${model}...`);
        return await fetchWithRetry(model, signal);
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (lastErr.message.includes("429")) {
          console.warn(`[localAI] ${model} exhausted retries, trying next model...`);
          continue;
        }
        throw e; // non-429 error, propagate immediately
      }
    }
    throw lastErr!;
  }

  try {
    console.log("[localAI] streamMessage: fetching Gemini streaming API...");
    const response = await tryModels(abortSignal);

    if (!response.ok) {
      throw new Error(`Gemini streaming API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body is not readable");

    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let chunkCount = 0;
    let socraticViolation = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last partial line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;

        if (cleanLine.startsWith("data: ")) {
          const jsonStr = cleanLine.substring(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const data = JSON.parse(jsonStr);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              chunkCount++;
              rawText += text;
              const visible = stripThinkBlock(rawText);
              if (!allowNumbers && visible && violatesSocraticRules(visible)) {
                console.log("[localAI] streamMessage: detected Socratic rule violation during stream, breaking.");
                rawText = "";
                socraticViolation = true;
                break;
              }
              // Live debug tracking on every chunk
              _debugState.rawStream = rawText;
              _debugState.thinkBlock = _extractThinkContent(rawText);
              _debugState.visibleResponse = visible;
              _debugState.chunkCount = chunkCount;
              _notifyDebug();
              if (visible && visible !== lastVisible) {
                lastVisible = visible;
                onChunk(visible);
              }
            }
          } catch (e) {
            console.error("Error parsing Gemini SSE chunk:", e, jsonStr);
          }
        }
      }
      // A Socratic violation means we discard the answer and fall back — stop
      // pulling (and paying for) the rest of the stream instead of looping on.
      if (socraticViolation) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
    console.log("[localAI] streamMessage: stream complete. Total chunks:", chunkCount);
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted"))) {
      console.log("[localAI] streamMessage was intentionally aborted.");
      throw error;
    }
    console.error("[localAI] streamMessage failed:", error);
    throw new Error("פנייה לשרת Gemini נכשלה. אנא בדוק את החיבור לרשת ומפתח ה-API.");
  }

  const finalVisible = stripThinkBlock(rawText);
  _debugState.isGenerating = false;

  if (!finalVisible || (!allowNumbers && violatesSocraticRules(finalVisible))) {
    console.log("[localAI] streamMessage: finalVisible is empty or violates Socratic rules, returning pedagogical fallback.");
    const fallbackResponse = "אני כאן כדי לעזור לך לפתור את התרגיל צעד אחר צעד. מהו השלב הראשון שבו נתקעת?";
    _debugState.visibleResponse = fallbackResponse;
    _notifyDebug();
    return fallbackResponse;
  }

  console.log("[localAI] streamMessage completed. final rawText length:", rawText.length, "final visible response:", JSON.stringify(finalVisible));
  _debugState.visibleResponse = finalVisible;
  _notifyDebug();
  return finalVisible;
}

// ── Mock fallback ──
export function getMockResponse(userMessage: string, conversationHistory?: Message[]): string {
  const msg = userMessage.toLowerCase();
  const msgCount = conversationHistory?.filter((m) => m.role === "user").length ?? 0;

  if (msg.match(/^(היי|הי|שלום|בוקר טוב|ערב טוב|מה נשמע|אהלן)/))
    return "איך אפשר לעזור? 😊 (מצב הדגמה)";
  if (msg.match(/(לא מבין|לא הבנתי|לא ברור|מבולבל|קשה לי|עזרה)/))
    return "נסה לפרק את השאלה לחלקים. מה הנתון הראשון שאתה מזהה? (מצב הדגמה)";
  if (msg.match(/(סדר|סדרות|סכום|חשבוני|הנדסי)/))
    return `בסדרות: חשבונית=הפרש קבוע, הנדסית=מנה קבועה (מצב הדגמה)`;
  if (msgCount >= 3) return "אתה מתקדם יפה! על מה תרצה לעבוד עכשיו? (מצב הדגמה)";
  return `שאלה טובה! "${userMessage.slice(0, 30)}..." — מצב הדגמה.`;
}
