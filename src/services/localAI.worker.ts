/**
 * Local AI Web Worker — DictaLM-3.0-1.7B-Thinking via Wllama (GGUF)
 *
 * Runs model loading and inference off the main thread.
 * Communicates via postMessage with the main thread service.
 */

import { Wllama, LoggerWithoutDebug } from "@wllama/wllama";

// ── Config ──
const MODEL_URL =
  "https://huggingface.co/VRDate/DictaLM-3.0-1.7B-Thinking-Q4_K_M-GGUF/resolve/main/dictalm-3.0-1.7b-thinking-q4_k_m.gguf";

const CONFIG_PATHS = {
  "default":
    "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.1.1/esm/wasm/multi-thread/wllama.wasm",
  "single-thread/wllama.wasm":
    "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.1.1/esm/wasm/single-thread/wllama.wasm",
  "multi-thread/wllama.wasm":
    "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.1.1/esm/wasm/multi-thread/wllama.wasm",
};

// ── State ──
let wllama: Wllama | null = null;
let isLoading = false;

// ── Types for messages ──
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type WorkerRequest =
  | { type: "init" }
  | { type: "generate"; messages: ChatMessage[]; id: string }
  | { type: "analyze"; conversationText: string; id: string }
  | { type: "summarize"; conversationText: string; id: string }
  | { type: "brief"; conversationText: string; id: string }
  | { type: "status" }
  | { type: "destroy" };

export type WorkerResponse =
  | { type: "init:progress"; percent: number; stage: string }
  | { type: "init:ready" }
  | { type: "init:error"; error: string }
  | { type: "generate:partial"; id: string; text: string }
  | { type: "generate:done"; id: string; text: string }
  | { type: "generate:error"; id: string; error: string }
  | { type: "analyze:done"; id: string; json: string }
  | { type: "analyze:error"; id: string; error: string }
  | { type: "summarize:done"; id: string; text: string }
  | { type: "summarize:error"; id: string; error: string }
  | { type: "brief:done"; id: string; json: string }
  | { type: "brief:error"; id: string; error: string }
  | { type: "status"; status: "idle" | "loading" | "ready" | "error"; percent?: number };

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

// ── Think-block stripping ──
// DictaLM-Thinking outputs <think>...</think> before the actual answer.
// We strip the think block and only show the clean response.
function stripThinkBlock(text: string): string {
  // Remove everything between <think> and </think> (inclusive)
  const stripped = text.replace(/<think>[\s\S]*?<\/think>\s*/g, "");
  // If we're still inside an unclosed think block, return empty
  if (stripped.includes("<think>")) return "";
  return stripped.trim();
}

// ── Initialize ──
async function initModel() {
  if (wllama?.isModelLoaded()) {
    post({ type: "init:ready" });
    return;
  }

  if (isLoading) return;
  isLoading = true;

  try {
    post({ type: "init:progress", percent: 0, stage: "טוען רכיבי AI..." });

    wllama = new Wllama(CONFIG_PATHS, {
      logger: LoggerWithoutDebug,
    });

    post({ type: "init:progress", percent: 5, stage: "מוריד מודל DictaLM..." });

    await wllama.loadModelFromUrl(MODEL_URL, {
      n_ctx: 4096,
      n_batch: 512,
      progressCallback: ({ loaded, total }) => {
        if (total > 0) {
          const percent = Math.min(90, Math.round((loaded / total) * 90));
          post({ type: "init:progress", percent, stage: "מוריד מודל DictaLM..." });
        }
      },
    });

    post({ type: "init:progress", percent: 95, stage: "מאתחל מודל..." });

    isLoading = false;
    post({ type: "init:ready" });
  } catch (e) {
    isLoading = false;
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Worker: model init failed:", msg);
    post({ type: "init:error", error: msg });
  }
}

// ── Generate (Chat Completion with streaming) ──
async function generate(messages: ChatMessage[], id: string) {
  if (!wllama?.isModelLoaded()) {
    post({ type: "generate:error", id, error: "Model not loaded" });
    return;
  }

  try {
    let rawText = "";
    let lastVisibleText = "";

    const stream = await wllama.createChatCompletion({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: 0.6,
      top_k: 40,
      top_p: 0.9,
      max_tokens: 1024,
      onData: (chunk) => {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          rawText += delta;
          // Strip think blocks and emit visible text
          const visible = stripThinkBlock(rawText);
          if (visible && visible !== lastVisibleText) {
            lastVisibleText = visible;
            post({ type: "generate:partial", id, text: visible });
          }
        }
      },
    });

    // Consume the async iterator to completion
    if (stream && Symbol.asyncIterator in Object(stream)) {
      for await (const _chunk of stream as AsyncIterable<unknown>) {
        // Already handled via onData callback
      }
    }

    const finalText = stripThinkBlock(rawText) || rawText.trim();
    post({ type: "generate:done", id, text: finalText });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    post({ type: "generate:error", id, error: msg });
  }
}

// ── Analyze ──
async function analyze(conversationText: string, id: string) {
  if (!wllama?.isModelLoaded()) {
    post({ type: "analyze:error", id, error: "Model not loaded" });
    return;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `אתה מנוע ניתוח פדגוגי. נתח שיחת תרגול מתמטיקה בעברית והחזר JSON בלבד.`
    },
    {
      role: "user",
      content: `נתח את השיחה הבאה והחזר JSON בפורמט הזה בלבד (ללא markdown):
{
  "sentiment": "frustrated" | "neutral" | "confident",
  "confusionScore": <0-100>,
  "engagementScore": <0-100>,
  "progressionSignal": "improving" | "stuck" | "declining",
  "questionDepth": <1-5>,
  "independenceRatio": <0.0-1.0>,
  "conceptMentions": [<רשימת נושאים מתמטיים בעברית>],
  "keyStrugglePoints": [<תיאורי קושי ספציפיים בעברית>],
  "topicsCovered": [<שמות נושאים מתמטיים בעברית>],
  "missingKnowledge": [<חוקים/מושגים שחסרים לתלמיד>],
  "teacherActionItem": "<המלצה ספציפית אחת למורה>",
  "gemmaAnalysisSummary": "<משפט אחד בעברית שמסכם את רמת ההבנה>"
}

שיחה:
${conversationText}`
    }
  ];

  try {
    const result = await wllama.createChatCompletion({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.3,
      max_tokens: 512,
    });
    const text = result.choices?.[0]?.message?.content || "";
    post({ type: "analyze:done", id, json: stripThinkBlock(text) || text.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    post({ type: "analyze:error", id, error: msg });
  }
}

// ── Summarize ──
async function summarize(conversationText: string, id: string) {
  if (!wllama?.isModelLoaded()) {
    post({ type: "summarize:error", id, error: "Model not loaded" });
    return;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "סכם שיחות תרגול מתמטיקה בפסקה אחת קצרה בעברית."
    },
    {
      role: "user",
      content: `סכם את השיחה הבאה בפסקה אחת קצרה. ציין: מה התלמיד שאל, על מה הוא נתקע, ומה הוסבר לו.

שיחה:
${conversationText}`
    }
  ];

  try {
    const result = await wllama.createChatCompletion({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.3,
      max_tokens: 256,
    });
    const text = result.choices?.[0]?.message?.content || "";
    post({ type: "summarize:done", id, text: stripThinkBlock(text) || text.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    post({ type: "summarize:error", id, error: msg });
  }
}

// ── Brief (Composite Pedagogical Summary) ──
async function brief(conversationText: string, id: string) {
  if (!wllama?.isModelLoaded()) {
    post({ type: "brief:error", id, error: "Model not loaded" });
    return;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "אתה מנתח פדגוגי. החזר JSON בלבד."
    },
    {
      role: "user",
      content: `נתח את שיחת התרגול הבאה והחזר JSON בפורמט הזה בלבד:
{
  "approach": "תיאור קצר של גישת התלמיד",
  "frictionPoints": ["נקודת חיכוך 1", "נקודת חיכוך 2"],
  "autonomyLevel": 1-5,
  "solutionAccuracy": 1-5,
  "keyInsight": "תובנה מרכזית למורה",
  "missingConcepts": ["מושג חסר 1", "מושג חסר 2"],
  "teacherActionItem": "המלצה ספציפית למורה",
  "recommendedAction": "פעולה מומלצת"
}

${conversationText}`
    }
  ];

  try {
    const result = await wllama.createChatCompletion({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.3,
      max_tokens: 512,
    });
    const text = result.choices?.[0]?.message?.content || "";
    post({ type: "brief:done", id, json: stripThinkBlock(text) || text.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    post({ type: "brief:error", id, error: msg });
  }
}

// ── Message handler ──
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  switch (msg.type) {
    case "init":
      initModel();
      break;

    case "generate":
      generate(msg.messages, msg.id);
      break;

    case "analyze":
      analyze(msg.conversationText, msg.id);
      break;

    case "summarize":
      summarize(msg.conversationText, msg.id);
      break;

    case "brief":
      brief(msg.conversationText, msg.id);
      break;

    case "status":
      post({
        type: "status",
        status: wllama?.isModelLoaded() ? "ready" : isLoading ? "loading" : "idle",
      });
      break;

    case "destroy":
      if (wllama) {
        wllama.exit();
        wllama = null;
      }
      break;
  }
};
