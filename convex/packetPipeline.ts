"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { geminiJson, type GeminiPart } from "./geminiServer";
import { salvageJsonArray, stripFences, normalizeDraft } from "./packetParse";
import { buildTopicList, inventoryPrompt, solvePrompt, structurePrompt, verifyPrompt } from "./packetPrompts";

// ── Full-PDF packet import: Gemini-calling actions (Node runtime) ──
// Kept separate from packetImport.ts because "use node" cannot coexist with
// queries/mutations. Every DB write is delegated back to internal mutations.

const KIND_VALUES = ["simple", "compound", "proof"];

// Read the source PDF from storage and base64-encode it for Gemini inlineData.
// Re-read per call (never passed as an action arg) to stay under payload limits.
async function loadPdfBase64(
  ctx: { storage: { get: (id: Id<"_storage">) => Promise<Blob | null> } },
  storageId: Id<"_storage">,
): Promise<string> {
  const blob = await ctx.storage.get(storageId);
  if (!blob) throw new Error("PDF missing from storage");
  const buf = await blob.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

function asRecord(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" ? (x as Record<string, unknown>) : {};
}

// ── Pass A: inventory the packet (list every question, solve nothing) ──
export const runInventory = internalAction({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => {
    const packet = await ctx.runQuery(internal.packetImport.getPacketInternal, { packetId });
    if (!packet || packet.status === "cancelled") return;

    const topics = await ctx.runQuery(internal.packetImport.getTopicsInternal, {});
    let pdf: string;
    try {
      pdf = await loadPdfBase64(ctx, packet.pdfStorageId);
    } catch {
      await ctx.runMutation(internal.packetImport.failPacket, { packetId, error: "טעינת ה-PDF נכשלה." });
      return;
    }

    let text: string;
    try {
      const r = await geminiJson({
        parts: [
          { inlineData: { mimeType: "application/pdf", data: pdf } },
          { text: inventoryPrompt(buildTopicList(topics)) },
        ],
        maxOutputTokens: 8000,
      });
      text = r.text;
    } catch {
      await ctx.runMutation(internal.packetImport.failPacket, { packetId, error: "חילוץ רשימת השאלות נכשל." });
      return;
    }

    const items = salvageJsonArray(text).map((raw, i) => {
      const o = asRecord(raw);
      const pageStart = Number(o.pageStart);
      const pageEnd = Number(o.pageEnd);
      const kind = typeof o.kind === "string" && KIND_VALUES.includes(o.kind) ? o.kind : "simple";
      return {
        sourceLabelRaw: String(o.sourceLabel ?? `${i + 1}`),
        pageStart: Number.isFinite(pageStart) ? pageStart : 1,
        pageEnd: Number.isFinite(pageEnd) ? pageEnd : Number.isFinite(pageStart) ? pageStart : 1,
        kind,
        topicHe: String(o.topicHe ?? ""),
      };
    });

    await ctx.runMutation(internal.packetImport.writeInventory, { packetId, items });
  },
});

// ── Pass B: solve one label-scoped chunk (self-chaining via writeChunkResults) ──
export const runChunk = internalAction({
  args: { packetId: v.id("packetImports"), labels: v.array(v.string()) },
  handler: async (ctx, { packetId, labels }) => {
    const packet = await ctx.runQuery(internal.packetImport.getPacketInternal, { packetId });
    if (!packet || packet.status === "cancelled") return;

    // Empty batch (shouldn't happen) → let the mutation advance state.
    if (labels.length === 0) {
      await ctx.runMutation(internal.packetImport.writeChunkResults, {
        packetId,
        requestedLabelsRaw: [],
        results: [],
      });
      return;
    }

    const topics = await ctx.runQuery(internal.packetImport.getTopicsInternal, {});
    let pdf: string;
    try {
      pdf = await loadPdfBase64(ctx, packet.pdfStorageId);
    } catch {
      await ctx.runMutation(internal.packetImport.failPacket, { packetId, error: "טעינת ה-PDF נכשלה." });
      return;
    }

    let result;
    try {
      result = await geminiJson({
        parts: [
          { inlineData: { mimeType: "application/pdf", data: pdf } },
          { text: solvePrompt(buildTopicList(topics), labels, labels.length) },
        ],
        maxOutputTokens: 32000,
      });
    } catch {
      // Whole-chunk failure → mark exactly these labels failed (via the mutation).
      await ctx.runMutation(internal.packetImport.writeChunkResults, {
        packetId,
        requestedLabelsRaw: labels,
        results: [],
      });
      return;
    }

    // Truncated output: retry with the first half; the remaining labels stay
    // "pending" and are picked up by the next batch. Terminates at size 1.
    if (result.finishReason === "MAX_TOKENS" && labels.length > 1) {
      const half = Math.ceil(labels.length / 2);
      await ctx.scheduler.runAfter(0, internal.packetPipeline.runChunk, {
        packetId,
        labels: labels.slice(0, half),
      });
      return;
    }

    const results = salvageJsonArray(result.text)
      .map((raw) => {
        const o = asRecord(raw);
        return {
          sourceLabel: String(o.sourceLabel ?? ""),
          topicHe: String(o.topicHe ?? ""),
          draft: normalizeDraft(o),
        };
      })
      .filter((r) => r.sourceLabel);

    await ctx.runMutation(internal.packetImport.writeChunkResults, {
      packetId,
      requestedLabelsRaw: labels,
      results,
    });
  },
});

// ── Crop mode: ONE Gemini call structures all teacher-cropped Q/A pairs ──
// The teacher isolated every question (and usually its answer-key snippet), so
// this pass transcribes + classifies + splits סעיפים — answers are copied from
// the answer crops, never re-solved. `questionIds` narrows a retry to a subset.
export const runStructure = internalAction({
  args: {
    packetId: v.id("packetImports"),
    questionIds: v.optional(v.array(v.id("packetImportQuestions"))),
  },
  handler: async (ctx, { packetId, questionIds }) => {
    const packet = await ctx.runQuery(internal.packetImport.getPacketInternal, { packetId });
    if (!packet || packet.status === "cancelled") return;

    // Ordered pending rows (or the requested subset), images pulled row-by-row
    // to stay under query result-size limits.
    let rowRefs = await ctx.runQuery(internal.packetImport.getCropRowIds, {
      packetId,
      onlyPending: true,
    });
    if (questionIds) {
      const wanted = new Set<string>(questionIds);
      rowRefs = rowRefs.filter((r) => wanted.has(r.id));
    }
    if (rowRefs.length === 0) {
      await ctx.runMutation(internal.packetImport.finalizePacket, { packetId });
      return;
    }

    const parts: GeminiPart[] = [];
    const rowByIndex = new Map<number, (typeof rowRefs)[number]>();
    for (let i = 0; i < rowRefs.length; i++) {
      const ref = rowRefs[i];
      const n = i + 1; // 1-based marker index within THIS request
      rowByIndex.set(n, ref);
      const images = await ctx.runQuery(internal.packetImport.getRowImagesInternal, {
        questionId: ref.id,
      });
      if (!images?.questionImageBase64) continue;
      parts.push({ text: `### שאלה ${n}` });
      parts.push({ inlineData: { mimeType: "image/jpeg", data: images.questionImageBase64 } });
      if (images.answerImageBase64) {
        parts.push({ text: `### תשובה לשאלה ${n}` });
        parts.push({ inlineData: { mimeType: "image/jpeg", data: images.answerImageBase64 } });
      }
    }
    const topics = await ctx.runQuery(internal.packetImport.getTopicsInternal, {});
    parts.push({ text: structurePrompt(buildTopicList(topics), rowRefs.length) });

    let result;
    try {
      result = await geminiJson({ parts, maxOutputTokens: 60000 });
    } catch {
      await ctx.runMutation(internal.packetImport.markRowsFailed, {
        questionIds: rowRefs.map((r) => r.id),
        message: "עיבוד השאלות נכשל.",
      });
      await ctx.runMutation(internal.packetImport.finalizePacket, { packetId });
      return;
    }

    // Salvage what parsed; anything unmatched below falls out as "failed".
    const matched = new Set<string>();
    for (const raw of salvageJsonArray(result.text)) {
      const o = asRecord(raw);
      const idx = Number(o.index);
      const ref = Number.isFinite(idx) ? rowByIndex.get(idx) : undefined;
      if (!ref) continue;
      matched.add(ref.id);
      await ctx.runMutation(internal.packetImport.writeStructureResult, {
        questionId: ref.id,
        topicHe: String(o.topicHe ?? ""),
        draft: normalizeDraft(o),
      });
    }
    const unmatched = rowRefs.filter((r) => !matched.has(r.id)).map((r) => r.id);
    if (unmatched.length > 0) {
      await ctx.runMutation(internal.packetImport.markRowsFailed, {
        questionIds: unmatched,
        message:
          result.finishReason === "MAX_TOKENS"
            ? "התשובה נחתכה — נסה שוב שאלה זו."
            : "המודל לא החזיר מבנה לשאלה זו.",
      });
    }
    await ctx.runMutation(internal.packetImport.finalizePacket, { packetId });
  },
});

// ── Pass C (optional): independently re-solve numeric/expression/MC answers ──
export const runVerify = internalAction({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => {
    const packet = await ctx.runQuery(internal.packetImport.getPacketInternal, { packetId });
    if (!packet || packet.status === "cancelled") return;

    const rows = await ctx.runQuery(internal.packetImport.getVerifiableQuestions, { packetId });
    for (const row of rows) {
      let mismatch: string | null = null;
      for (const chk of row.checks) {
        try {
          const r = await geminiJson({
            parts: [{ text: verifyPrompt(chk.stem, chk.answerType, chk.answer) }],
            temperature: 0,
            maxOutputTokens: 2048,
          });
          const o = asRecord(JSON.parse(stripFences(r.text)));
          if (o.agrees === false) {
            mismatch = String(o.note || o.correctedAnswer || "אי-התאמה בבדיקת התשובה.");
            break;
          }
        } catch {
          // A single check failing is non-fatal — treat as inconclusive.
        }
      }
      await ctx.runMutation(internal.packetImport.writeVerification, {
        questionId: row.id as Id<"packetImportQuestions">,
        verdict: mismatch ? "mismatch" : "match",
        ...(mismatch ? { detail: mismatch } : {}),
      });
    }

    await ctx.runMutation(internal.packetImport.finalizePacket, { packetId });
  },
});
