/**
 * Local AI Web Worker — MediaPipe LLM Inference (Gemma 3n E2B)
 *
 * Runs model loading and inference off the main thread.
 * Communicates via postMessage with the main thread service.
 */

import { FilesetResolver, LlmInference } from "@mediapipe/tasks-genai";

// ── Polyfill for MediaPipe Bug ──
if (typeof self !== "undefined") {
  // @ts-ignore
  self.import = async (url: string) => {
    // Instead of native import(), which isolates variables in a module scope,
    // we fetch and globally evaluate the script so that Emscripten's var declarations
    // attach to the global scope just like importScripts() would.
    const res = await fetch(url);
    const code = await res.text();
    // Indirect eval executes in the global scope
    (0, eval)(code);
  };
}

// ── Config ──
const MODEL_URL =
  "https://huggingface.co/google/gemma-3n-E2B-it-litert-lm/resolve/main/gemma-3n-E2B-it-int4-Web.litertlm";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm";
const OPFS_FILE_NAME = "gemma-3n-e2b.litertlm";

// ── State ──
let llmInference: LlmInference | null = null;
let isLoading = false;

// ── Types for messages ──
export type WorkerRequest =
  | { type: "init" }
  | { type: "generate"; prompt: string; id: string }
  | { type: "analyze"; conversationText: string; id: string }
  | { type: "summarize"; conversationText: string; id: string }
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
  | { type: "status"; status: "idle" | "loading" | "ready" | "error"; percent?: number };

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

// ── OPFS Helpers ──
async function getOPFSRoot(): Promise<FileSystemDirectoryHandle> {
  return await navigator.storage.getDirectory();
}

async function isModelCached(): Promise<boolean> {
  try {
    const root = await getOPFSRoot();
    await root.getFileHandle(OPFS_FILE_NAME);
    return true;
  } catch {
    return false;
  }
}

async function getCachedModelFile(): Promise<File> {
  const root = await getOPFSRoot();
  const handle = await root.getFileHandle(OPFS_FILE_NAME);
  return await handle.getFile();
}

// ── Download directly to OPFS ──
async function downloadAndCacheModel(): Promise<void> {
  post({ type: "init:progress", percent: 0, stage: "מוריד מודל AI..." });

  const hfToken = import.meta.env.VITE_HF_TOKEN;
  const headers = hfToken ? { Authorization: `Bearer ${hfToken}` } : undefined;

  const response = await fetch(MODEL_URL, { headers });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Access to model is restricted (401/403). Please add VITE_HF_TOKEN to your .env.local file after accepting the terms on HuggingFace."
      );
    }
    throw new Error(`Failed to download model: ${response.status}`);
  }

  const root = await getOPFSRoot();
  const handle = await root.getFileHandle(OPFS_FILE_NAME, { create: true });
  const writable = await handle.createWritable();

  const contentLength = Number(response.headers.get("content-length") || 0);
  const reader = response.body!.getReader();
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    await writable.write(value);
    received += value.length;

    if (contentLength > 0) {
      const percent = Math.round((received / contentLength) * 100);
      post({ type: "init:progress", percent, stage: "מוריד מודל AI..." });
    }
  }

  await writable.close();
}

// ── Initialize ──
async function initModel() {
  if (llmInference) {
    post({ type: "init:ready" });
    return;
  }

  if (isLoading) return;
  isLoading = true;

  try {
    // Step 1: Resolve WASM fileset
    post({ type: "init:progress", percent: 0, stage: "טוען רכיבי AI..." });
    const genai = await FilesetResolver.forGenAiTasks(WASM_URL);

    // Step 2: Get or download model
    let modelPath: string;

    if (await isModelCached()) {
      post({ type: "init:progress", percent: 95, stage: "טוען מודל מהמטמון..." });
      const file = await getCachedModelFile();
      modelPath = URL.createObjectURL(file);
    } else {
      await downloadAndCacheModel();
      post({ type: "init:progress", percent: 95, stage: "טוען מודל מקומי..." });
      const file = await getCachedModelFile();
      modelPath = URL.createObjectURL(file);
    }

    // Step 3: Create LLM Inference
    post({ type: "init:progress", percent: 96, stage: "מאתחל מודל..." });
    llmInference = await LlmInference.createFromOptions(genai, {
      baseOptions: {
        modelAssetPath: modelPath,
      },
      maxTokens: 1024,
      temperature: 0.5,
      topK: 40,
      randomSeed: Math.floor(Math.random() * 1000000),
    });

    isLoading = false;
    post({ type: "init:ready" });
  } catch (e) {
    isLoading = false;
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Worker: model init failed:", msg);
    post({ type: "init:error", error: msg });
  }
}

// ── Generate ──
function generate(prompt: string, id: string) {
  if (!llmInference) {
    post({ type: "generate:error", id, error: "Model not loaded" });
    return;
  }

  try {
    let fullText = "";
    llmInference.generateResponse(prompt, (partialResult: string, done: boolean) => {
      fullText += partialResult;
      if (done) {
        post({ type: "generate:done", id, text: fullText });
      } else {
        post({ type: "generate:partial", id, text: fullText });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    post({ type: "generate:error", id, error: msg });
  }
}

// ── Analyze ──
function analyze(conversationText: string, id: string) {
  if (!llmInference) {
    post({ type: "analyze:error", id, error: "Model not loaded" });
    return;
  }

  const prompt = `<start_of_turn>user
You are an educational analytics engine. Analyze this Hebrew math tutoring conversation and respond ONLY with a valid JSON object (no markdown, no explanation).

Conversation:
${conversationText}

Respond with this exact JSON structure:
{
  "sentiment": "frustrated" | "neutral" | "confident",
  "confusionScore": <0-100>,
  "engagementScore": <0-100>,
  "progressionSignal": "improving" | "stuck" | "declining",
  "questionDepth": <1-5>,
  "independenceRatio": <0.0-1.0>,
  "conceptMentions": [<list of Hebrew math topic strings detected>],
  "keyStrugglePoints": [<list of specific struggle descriptions in Hebrew>],
  "topicsCovered": [<list of math topic names in Hebrew>],
  "gemmaAnalysisSummary": <one sentence Hebrew summary of the student's understanding level>
}<end_of_turn>
<start_of_turn>model
`;

  try {
    let fullText = "";
    llmInference.generateResponse(prompt, (partial: string, done: boolean) => {
      fullText += partial;
      if (done) {
        post({ type: "analyze:done", id, json: fullText.trim() });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    post({ type: "analyze:error", id, error: msg });
  }
}

// ── Summarize ──
function summarize(conversationText: string, id: string) {
  if (!llmInference) {
    post({ type: "summarize:error", id, error: "Model not loaded" });
    return;
  }

  const prompt = `<start_of_turn>user
סכם את השיחה הבאה בין תלמיד למורה מתמטיקה בפסקה אחת קצרה בעברית.
ציין: מה התלמיד שאל, על מה הוא נתקע, ומה הוסבר לו.

שיחה:
${conversationText}

סיכום:<end_of_turn>
<start_of_turn>model
`;

  try {
    let fullText = "";
    llmInference.generateResponse(prompt, (partial: string, done: boolean) => {
      fullText += partial;
      if (done) {
        post({ type: "summarize:done", id, text: fullText.trim() });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    post({ type: "summarize:error", id, error: msg });
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
      generate(msg.prompt, msg.id);
      break;

    case "analyze":
      analyze(msg.conversationText, msg.id);
      break;

    case "summarize":
      summarize(msg.conversationText, msg.id);
      break;

    case "status":
      post({
        type: "status",
        status: llmInference ? "ready" : isLoading ? "loading" : "idle",
      });
      break;

    case "destroy":
      if (llmInference) {
        llmInference.close();
        llmInference = null;
      }
      break;
  }
};
