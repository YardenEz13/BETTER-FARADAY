import type { AgentType, ChatMetrics, PartialBrief, CompositeBrief } from "./localAI.types";

export type { AgentType, ChatMetrics, PartialBrief, CompositeBrief };

// ── Gemini proxy ──
// All Gemini traffic goes through Convex httpActions so the API key stays on the
// server (never in the browser bundle). Convex HTTP endpoints live on the
// `.convex.site` host, which is the `.convex.cloud` deployment URL with the TLD
// swapped. See convex/http.ts.
const CONVEX_SITE_URL = ((import.meta.env.VITE_CONVEX_URL as string) || "").replace(
  /\.convex\.cloud$/,
  ".convex.site"
);
const GEMINI_STREAM_URL = `${CONVEX_SITE_URL}/gemini-stream`;
const GEMINI_GENERATE_URL = `${CONVEX_SITE_URL}/gemini-generate`;

export interface Message {
  role: "user" | "model" | "system";
  content: string;
  // Ephemeral, local-only preview for notebook-check messages. This is a
  // compressed data URL kept in React state + IndexedDB for rendering. It is
  // NEVER sent to Convex (would blow past the ~1MB document limit) and is not
  // part of the text history handed to the tutor.
  imageUrl?: string;
}

const PRACTICE_AGENT_PROMPT = `אתה פאראדיי — מורה פרטי למתמטיקה בשיטה הסוקרטית. מטרתך לעזור לתלמיד להבין ולפתור בעיות מתמטיות בעצמו.

כללים:
1. השב תמיד בעברית בלבד.
2. הצג רק את הנוסחה הכללית הרלוונטית (ב-$...$) ושאל שאלה מנחה אחת.
3. אל תציב מספרים, אל תחשב, ואל תגלה את התשובה הסופית בשום אופן.
4. אם התלמיד נתקע, פרק את הבעיה לצעדים קטנים יותר ושאל על הצעד הראשון.
5. השב ב-2-3 משפטים קצרים.`;

const HOMEWORK_AGENT_PROMPT = `אתה פאראדיי — עוזר שיעורי בית למתמטיקה בשיטה הסוקרטית. מטרתך לעזור לתלמיד להגיע לפתרון בעצמו.

כללים:
1. השב תמיד בעברית בלבד.
2. הצג רק את הנוסחה הכללית הרלוונטית (ב-$...$) ושאל שאלה מנחה אחת.
3. אל תציב מספרים, אל תחשב, ואל תגלה את התשובה הסופית בשום אופן.
4. אם התלמיד נתקע, פרק את הבעיה לצעדים קטנים יותר ושאל על הצעד הראשון.
5. השב ב-2-3 משפטים קצרים.`;

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

function buildSystemPrompt(agentType: AgentType, context: string): string {
  const base = agentType === "proof"
    ? PROOF_AGENT_PROMPT
    : agentType === "practice"
    ? PRACTICE_AGENT_PROMPT
    : HOMEWORK_AGENT_PROMPT;
  if (!context) return base;
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
=== סוף שאלה פעילה ===`;
}

function buildGeminiPayload(
  agentType: AgentType,
  context: string,
  userMessage: string,
  history?: Message[]
) {
  let systemContent = buildSystemPrompt(agentType, context);
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

  // Current message with trailing constraints
  const TRAILING_CONSTRAINT = "\n\n[הנחיית מערכת: ענה בעברית בלבד. הצג נוסחה כללית אחת ב-$...$ ושאלה מנחה אחת בלבד. אסור בהחלט: חישובים, הצבת מספרים, תוצאות ביניים, תשובה סופית.]";
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
  contextOverride?: { agentType?: AgentType; questionContext?: string }
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
  // Proof context: geometry theorem hints legitimately contain "= <name>" patterns
  // that the numeric Socratic filter would incorrectly block. Skip the filter for proof mode.
  const isProofMode = effectiveAgentType === "proof";

  const payload = buildGeminiPayload(
    effectiveAgentType,
    effectiveContext,
    message,
    history
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
              if (!isProofMode && visible && violatesSocraticRules(visible)) {
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

  if (!finalVisible || (!isProofMode && violatesSocraticRules(finalVisible))) {
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

// ── Shared non-streaming Gemini helper with retry + model fallback ──
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

async function geminiGenerateContent(
  payload: object,
  signal?: AbortSignal
): Promise<GeminiResponse> {
  if (!CONVEX_SITE_URL) throw new Error("Missing VITE_CONVEX_URL");
  // The Convex proxy does the model-fallback loop server-side and returns the
  // raw Gemini JSON. The key never reaches the browser.
  const res = await fetch(GEMINI_GENERATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
    signal,
  });
  if (!res.ok) throw new Error(`Gemini proxy error: ${res.status} ${res.statusText}`);
  return await res.json();
}

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

  const data = await geminiGenerateContent(payload, signal);
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

  const data = await geminiGenerateContent(payload, signal);
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

// ── Analysis ──
export function heuristicAnalysis(messages: Message[]): ChatMetrics {
  const userMessages = messages.filter((m) => m.role === "user");
  const questionsAsked = userMessages.filter((m) => m.content.includes("?")).length;
  const frustrationKeywords = ["לא מבין", "קשה", "בלבול", "אוף", "תסכול", "נתקעתי", "לא הבנתי", "מבולבל", "עזרה"];
  const isFrustrated = userMessages.some((m) =>
    frustrationKeywords.some((k) => m.content.includes(k))
  );
  const independenceKeywords = ["ניסיתי", "חשבתי", "לפי דעתי", "אולי", "אני חושב", "הגעתי ל", "נראה לי", "חישבתי"];
  const independenceRatio =
    userMessages.length > 0
      ? userMessages.filter((m) =>
          independenceKeywords.some((k) => m.content.includes(k))
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
  if (isFrustrated && independenceRatio < 0.2) {
    teacherActionItem = "התלמיד מתוסכל ולא מנסה לבד — מומלץ שיחה אישית ותרגול מודרך על הבסיס";
  } else if (independenceRatio < 0.2) {
    teacherActionItem = "התלמיד לא מציג עבודה עצמית — מומלץ לתת תרגילים עם שלבי ביניים";
  } else if (isFrustrated) {
    teacherActionItem = "התלמיד מנסה אבל מתוסכל — מומלץ לחזור על הנושא בשיעור";
  }

  return {
    confusionScore: isFrustrated ? 80 : Math.max(20, questionsAsked * 10),
    topicsCovered: detectedTopics,
    questionsAsked: userMessages.length,
    avgResponseLength: Math.round(
      userMessages.reduce((s, m) => s + m.content.split(" ").length, 0) /
        Math.max(1, userMessages.length)
    ),
    sentiment: isFrustrated ? "frustrated" : "neutral",
    keyStrugglePoints: strugglePoints,
    engagementScore: Math.min(100, userMessages.length * 10),
    progressionSignal: "stuck",
    conceptMentions: detectedTopics,
    totalDurationMs,
    questionDepth: Math.min(5, Math.max(1, questionsAsked)),
    independenceRatio,
    missingKnowledge,
    teacherActionItem: teacherActionItem || undefined,
  };
}

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
  }, 15000);

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
        maxOutputTokens: 1024,
        responseMimeType: "application/json"
      }
    };

    const data = await geminiGenerateContent(payload, controller.signal);
    clearTimeout(timeoutId);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(clean);
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
function heuristicBrief(
  messages: Message[],
  partialBriefs: PartialBrief[],
  selfAssessment: string
): CompositeBrief {
  const userMsgs = messages.filter((m) => m.role === "user");
  const hasOwnWork = userMsgs.some((m) => /ניסיתי|חשבתי|הגעתי ל|לדעתי|אני חושב/.test(m.content));
  const hasFrustration = userMsgs.some((m) => /לא מבין|קשה|נתקעתי|בלבול|לא הבנתי/.test(m.content));
  const hasQuestions = userMsgs.filter((m) => m.content.includes("?")).length;
  const totalMessages = partialBriefs.reduce((s, b) => s + b.messageCount, 0) + messages.length;
  const totalDuration = partialBriefs.reduce((s, b) => s + b.durationMs, 0);

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

  return {
    totalCycles: partialBriefs.length + 1,
    totalMessages,
    totalDurationMs: totalDuration,
    partialBriefs,
    approach: hasOwnWork ? "הציג עבודה עצמית" : "שאל שאלות ישירות",
    frictionPoints: hasFrustration ? ["ביטא תסכול או בלבול"] : [],
    autonomyLevel: hasOwnWork ? 4 : hasQuestions > 3 ? 2 : 3,
    solutionAccuracy: 3,
    keyInsight: `${totalMessages} הודעות, ${hasQuestions} שאלות, ${partialBriefs.length} סבבים`,
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
  selfAssessment: string
): Promise<CompositeBrief> {
  const fallback = heuristicBrief(finalSessionMessages, partialBriefs, selfAssessment);

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
  }, 15000);

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
        maxOutputTokens: 1024,
        responseMimeType: "application/json"
      }
    };

    const data = await geminiGenerateContent(payload, controller.signal);
    clearTimeout(timeoutId);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(clean);
    return {
      ...fallback,
      ...parsed,
      partialBriefs,
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
