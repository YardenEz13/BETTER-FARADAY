import { mutation, query, internalMutation, internalQuery, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { packetDraft } from "./packetValidators";
import { normalizeLabel, pickBatch, matchTopic, indexBySourceLabel } from "./packetParse";
import { isStalePending } from "./packetWatchdog";
import { publishRow } from "./packetPublish";

// Re-exported so existing import paths (`./packetImport`) and their test suites
// keep working after the watchdog + publish logic moved into focused modules.
export { STALE_PENDING_MS, isStalePending } from "./packetWatchdog";
export { publishRow } from "./packetPublish";

// ── Full-PDF packet import: mutations & queries (default Convex runtime) ──
// The Gemini-calling actions live in convex/packetPipeline.ts ("use node").
// This file owns all DB writes + the client-facing queries. Progress is always
// derived from packetImportQuestions status counts, never a chunk counter.

// ── Client entry: create the packet row and kick off the pipeline ──
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const start = mutation({
  args: {
    classroomId: v.id("classrooms"),
    sourceName: v.string(),
    pdfStorageId: v.id("_storage"),
    verifyEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const packetId = await ctx.db.insert("packetImports", {
      classroomId: args.classroomId,
      sourceName: args.sourceName,
      pdfStorageId: args.pdfStorageId,
      status: "inventory",
      verifyEnabled: !!args.verifyEnabled,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.packetPipeline.runInventory, { packetId });
    return packetId;
  },
});

export const cancel = mutation({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => {
    const p = await ctx.db.get(packetId);
    if (!p) return;
    // Only stop a still-running packet; leave a finished one alone.
    if (["inventory", "solving", "verifying"].includes(p.status)) {
      await ctx.db.patch(packetId, { status: "cancelled" });
    }
  },
});

// ── Client-facing reads ──
// All packet imports for a classroom, newest first, with per-status row counts —
// powers the "packets in review / in progress" resume list so a teacher who
// navigated away can find a packet again (there's no other way back to one).
export const listPackets = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    const packets = await ctx.db
      .query("packetImports")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();
    packets.sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(
      packets.map(async (p) => {
        const rows = await ctx.db
          .query("packetImportQuestions")
          .withIndex("by_packet", (q) => q.eq("packetId", p._id))
          .collect();
        const counts: Record<string, number> = {};
        for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
        return {
          _id: p._id,
          sourceName: p.sourceName,
          status: p.status,
          mode: p.mode ?? "auto",
          createdAt: p.createdAt,
          total: rows.length,
          approved: counts.approved ?? 0,
          counts,
        };
      }),
    );
  },
});

export const getPacket = query({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => {
    const p = await ctx.db.get(packetId);
    if (!p) return null;
    const rows = await ctx.db
      .query("packetImportQuestions")
      .withIndex("by_packet", (q) => q.eq("packetId", packetId))
      .collect();
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    const resolved = rows.filter((r) => r.status !== "pending").length;
    return { ...p, counts, total: rows.length, resolved };
  },
});

export const listPacketQuestions = query({
  args: { packetId: v.id("packetImports"), status: v.optional(v.string()) },
  handler: async (ctx, { packetId, status }) => {
    const rows = status
      ? await ctx.db
          .query("packetImportQuestions")
          .withIndex("by_packet_status", (q) => q.eq("packetId", packetId).eq("status", status))
          .collect()
      : await ctx.db
          .query("packetImportQuestions")
          .withIndex("by_packet", (q) => q.eq("packetId", packetId))
          .collect();
    rows.sort((a, b) => a.orderIndex - b.orderIndex);
    // Strip crop images — dozens of rows × base64 JPEGs would blow the query
    // size limit. The editor fetches a single row's images on demand.
    return rows.map((r) => {
      const { questionImageBase64, answerImageBase64, ...rest } = r;
      return { ...rest, hasImages: !!questionImageBase64 || !!answerImageBase64 };
    });
  },
});

// Single row's crop images, fetched on demand by the editor drawer.
export const getQuestionImages = query({
  args: { questionId: v.id("packetImportQuestions") },
  handler: async (ctx, { questionId }) => {
    const row = await ctx.db.get(questionId);
    if (!row) return null;
    return {
      questionImageBase64: row.questionImageBase64 ?? null,
      answerImageBase64: row.answerImageBase64 ?? null,
    };
  },
});

export const getPdfUrl = query({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => {
    const p = await ctx.db.get(packetId);
    if (!p) return null;
    return await ctx.storage.getUrl(p.pdfStorageId);
  },
});

// ── Crop mode: teacher crops question+answer pairs, one AI call structures ──
export const startCropPacket = mutation({
  args: {
    classroomId: v.id("classrooms"),
    sourceName: v.string(),
    pdfStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("packetImports", {
      classroomId: args.classroomId,
      sourceName: args.sourceName,
      pdfStorageId: args.pdfStorageId,
      mode: "crops",
      status: "cropping",
      verifyEnabled: false, // answers come from the teacher's answer-key crops
      createdAt: Date.now(),
    });
  },
});

export const addCroppedQuestion = mutation({
  args: {
    packetId: v.id("packetImports"),
    orderIndex: v.number(),
    questionImageBase64: v.string(),
    answerImageBase64: v.optional(v.string()),
    pageStart: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const packet = await ctx.db.get(args.packetId);
    if (!packet || packet.status !== "cropping") throw new Error("החבילה אינה במצב חיתוך");
    return await ctx.db.insert("packetImportQuestions", {
      packetId: args.packetId,
      classroomId: packet.classroomId,
      sourceLabel: normalizeLabel(String(args.orderIndex + 1)),
      sourceLabelRaw: `שאלה ${args.orderIndex + 1}`,
      orderIndex: args.orderIndex,
      pageStart: args.pageStart ?? 1,
      pageEnd: args.pageStart ?? 1,
      kind: "simple", // provisional — the structuring pass reclassifies
      status: "pending",
      topicHe: "",
      questionImageBase64: args.questionImageBase64,
      answerImageBase64: args.answerImageBase64,
      createdAt: Date.now(),
    });
  },
});

export const submitCropPacket = mutation({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => {
    const packet = await ctx.db.get(packetId);
    if (!packet || packet.status !== "cropping") throw new Error("החבילה אינה במצב חיתוך");
    const rows = await ctx.db
      .query("packetImportQuestions")
      .withIndex("by_packet", (q) => q.eq("packetId", packetId))
      .collect();
    if (rows.length === 0) throw new Error("לא נחתכו שאלות");
    await ctx.db.patch(packetId, { status: "solving", totalQuestions: rows.length });
    await armWatchdog(ctx, packetId);
    await ctx.scheduler.runAfter(0, internal.packetPipeline.runStructure, { packetId });
  },
});

// ── Internal reads used by the pipeline actions ──
export const getPacketInternal = internalQuery({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => await ctx.db.get(packetId),
});

// Crop-row ids in order, WITHOUT images (size). The action then pulls each
// row's images one query at a time to stay under result-size limits.
export const getCropRowIds = internalQuery({
  args: { packetId: v.id("packetImports"), onlyPending: v.optional(v.boolean()) },
  handler: async (ctx, { packetId, onlyPending }) => {
    const rows = await ctx.db
      .query("packetImportQuestions")
      .withIndex("by_packet", (q) => q.eq("packetId", packetId))
      .collect();
    return rows
      .filter((r) => (onlyPending ? r.status === "pending" : true))
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((r) => ({ id: r._id, orderIndex: r.orderIndex }));
  },
});

// Record the Gemini Files API handle for a packet's PDF so later solve calls
// reference it by URI instead of re-uploading the base64 PDF each time.
export const setPacketPdfFile = internalMutation({
  args: {
    packetId: v.id("packetImports"),
    uri: v.string(),
    name: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { packetId, uri, name, expiresAt }) => {
    const p = await ctx.db.get(packetId);
    if (!p || p.status === "cancelled") return;
    await ctx.db.patch(packetId, {
      pdfFileUri: uri,
      pdfFileName: name,
      pdfFileExpiresAt: expiresAt,
    });
  },
});

export const getRowImagesInternal = internalQuery({
  args: { questionId: v.id("packetImportQuestions") },
  handler: async (ctx, { questionId }) => {
    const row = await ctx.db.get(questionId);
    if (!row) return null;
    return {
      questionImageBase64: row.questionImageBase64 ?? null,
      answerImageBase64: row.answerImageBase64 ?? null,
    };
  },
});

// Write one structured result onto its row (patched only while still pending —
// same edit-race guard as writeChunkResults).
export const writeStructureResult = internalMutation({
  args: {
    questionId: v.id("packetImportQuestions"),
    topicHe: v.string(),
    draft: packetDraft,
  },
  handler: async (ctx, { questionId, topicHe, draft }) => {
    const row = await ctx.db.get(questionId);
    if (!row || row.status !== "pending") return;
    const topics = (await ctx.db.query("topics").collect()).map((t) => ({ _id: t._id, nameHe: t.nameHe }));
    const topic = matchTopic(topicHe, topics);
    const isProof = draft.kind === "compound" && draft.sections.some((s) => s.answerType === "proof");
    await ctx.db.patch(questionId, {
      draft,
      topicHe: topicHe || row.topicHe,
      topicId: topic?._id,
      status: isProof ? "proof_unverified" : "review",
    });
  },
});

// Heartbeat: a pipeline action stamps every pending row of its packet when it
// starts, proving something is still in flight. See sweepStalePacket.
export const touchPendingRows = internalMutation({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("packetImportQuestions")
      .withIndex("by_packet_status", (q) => q.eq("packetId", packetId).eq("status", "pending"))
      .collect();
    for (const row of pending) {
      await ctx.db.patch(row._id, { pendingSince: now });
    }
  },
});

// Per-packet watchdog (replaces the old every-5-min full-table cron): fail
// orphaned pending rows so the teacher sees a retry button instead of a
// progress bar frozen forever. Scheduled when a packet enters "solving";
// reschedules itself only while the packet is still solving, so idle
// deployments run zero watchdog work. Overlapping instances are harmless —
// every step is an idempotent status check.
const WATCHDOG_INTERVAL_MS = 5 * 60 * 1000;

export const sweepStalePacket = internalMutation({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => {
    const packet = await ctx.db.get(packetId);
    if (!packet || packet.status !== "solving") return; // done — stop the loop

    const now = Date.now();
    const pending = await ctx.db
      .query("packetImportQuestions")
      .withIndex("by_packet_status", (q) => q.eq("packetId", packetId).eq("status", "pending"))
      .collect();

    let stillPending = 0;
    for (const row of pending) {
      if (isStalePending(row, now)) {
        await ctx.db.patch(row._id, {
          status: "failed",
          errorMessage: "העיבוד נתקע ולא הסתיים — נסה שוב שאלה זו.",
        });
      } else {
        stillPending++;
      }
    }

    if (pending.length > 0 && stillPending === 0) {
      await ctx.db.patch(packetId, { status: "review" });
      return;
    }

    await ctx.scheduler.runAfter(WATCHDOG_INTERVAL_MS, internal.packetImport.sweepStalePacket, {
      packetId,
    });
  },
});

// Arm the watchdog for a packet that just entered (or re-entered) "solving".
async function armWatchdog(ctx: MutationCtx, packetId: Id<"packetImports">) {
  await ctx.scheduler.runAfter(WATCHDOG_INTERVAL_MS, internal.packetImport.sweepStalePacket, {
    packetId,
  });
}

export const markRowsFailed = internalMutation({
  args: { questionIds: v.array(v.id("packetImportQuestions")), message: v.string() },
  handler: async (ctx, { questionIds, message }) => {
    for (const id of questionIds) {
      const row = await ctx.db.get(id);
      if (row && row.status === "pending") {
        await ctx.db.patch(id, { status: "failed", errorMessage: message });
      }
    }
  },
});

export const getTopicsInternal = internalQuery({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("topics").collect()).map((t) => ({ _id: t._id, nameHe: t.nameHe })),
});

export const getVerifiableQuestions = internalQuery({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => {
    const rows = await ctx.db
      .query("packetImportQuestions")
      .withIndex("by_packet_status", (q) => q.eq("packetId", packetId).eq("status", "review"))
      .collect();
    const out: { id: string; checks: { stem: string; answerType: string; answer: string }[] }[] = [];
    for (const r of rows) {
      const d = r.draft;
      if (!d) continue;
      const checks: { stem: string; answerType: string; answer: string }[] = [];
      if (d.kind === "simple") {
        if (d.format === "fill_blank" && d.correctAnswer) {
          checks.push({ stem: d.stem, answerType: "numeric", answer: d.correctAnswer });
        } else if (d.format === "multiple_choice" && typeof d.correctIndex === "number" && d.choices[d.correctIndex]) {
          checks.push({ stem: d.stem, answerType: "multiple_choice", answer: d.choices[d.correctIndex] });
        }
      } else {
        for (const s of d.sections) {
          if ((s.answerType === "numeric" || s.answerType === "expression") && s.correctAnswer) {
            checks.push({ stem: `${d.preamble}\n${s.prompt}`, answerType: s.answerType, answer: s.correctAnswer });
          }
        }
      }
      if (checks.length) out.push({ id: r._id, checks });
    }
    return out;
  },
});

// ── Internal writes ──
export const failPacket = internalMutation({
  args: { packetId: v.id("packetImports"), error: v.string() },
  handler: async (ctx, { packetId, error }) => {
    const p = await ctx.db.get(packetId);
    if (!p || p.status === "cancelled") return;
    await ctx.db.patch(packetId, { status: "failed", error });
  },
});

export const writeInventory = internalMutation({
  args: {
    packetId: v.id("packetImports"),
    items: v.array(
      v.object({
        sourceLabelRaw: v.string(),
        pageStart: v.number(),
        pageEnd: v.number(),
        kind: v.string(),
        topicHe: v.string(),
      }),
    ),
  },
  handler: async (ctx, { packetId, items }) => {
    const packet = await ctx.db.get(packetId);
    if (!packet || packet.status === "cancelled") return;
    if (items.length === 0) {
      await ctx.db.patch(packetId, { status: "failed", error: "לא זוהו שאלות בקובץ." });
      return;
    }
    const now = Date.now();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await ctx.db.insert("packetImportQuestions", {
        packetId,
        classroomId: packet.classroomId,
        sourceLabel: normalizeLabel(it.sourceLabelRaw),
        sourceLabelRaw: it.sourceLabelRaw,
        orderIndex: i,
        pageStart: it.pageStart,
        pageEnd: it.pageEnd,
        kind: it.kind,
        status: "pending",
        topicHe: it.topicHe,
        createdAt: now,
      });
    }
    const pageCount = items.reduce((m, it) => Math.max(m, it.pageEnd), 0) || undefined;
    await ctx.db.patch(packetId, { status: "solving", totalQuestions: items.length, pageCount });
    await armWatchdog(ctx, packetId);

    const labels = pickBatch(items.map((it) => ({ sourceLabelRaw: it.sourceLabelRaw, kind: it.kind })));
    await ctx.scheduler.runAfter(0, internal.packetPipeline.runChunk, { packetId, labels });
  },
});

export const writeChunkResults = internalMutation({
  args: {
    packetId: v.id("packetImports"),
    requestedLabelsRaw: v.array(v.string()),
    results: v.array(v.object({ sourceLabel: v.string(), topicHe: v.string(), draft: packetDraft })),
  },
  handler: async (ctx, { packetId, requestedLabelsRaw, results }) => {
    const packet = await ctx.db.get(packetId);
    if (!packet || packet.status === "cancelled") return;

    const topics = (await ctx.db.query("topics").collect()).map((t) => ({ _id: t._id, nameHe: t.nameHe }));
    const pending = await ctx.db
      .query("packetImportQuestions")
      .withIndex("by_packet_status", (q) => q.eq("packetId", packetId).eq("status", "pending"))
      .collect();
    const pendingByLabel = new Map(pending.map((r) => [r.sourceLabel, r]));
    const resultsByLabel = indexBySourceLabel(results);

    for (const raw of requestedLabelsRaw) {
      const key = normalizeLabel(raw);
      const row = pendingByLabel.get(key);
      if (!row || row.status !== "pending") continue; // edit-race / already resolved
      const res = resultsByLabel.get(key);
      if (res) {
        const topic = matchTopic(res.topicHe, topics);
        const isProof =
          res.draft.kind === "compound" && res.draft.sections.some((s) => s.answerType === "proof");
        await ctx.db.patch(row._id, {
          draft: res.draft,
          topicHe: res.topicHe || row.topicHe,
          topicId: topic?._id,
          status: isProof ? "proof_unverified" : "review",
        });
      } else {
        await ctx.db.patch(row._id, {
          status: "failed",
          errorMessage: "המודל לא החזיר פתרון לשאלה זו.",
        });
      }
    }

    // Advance: next greedy batch from remaining pending rows, else verify/finalize.
    const stillPending = await ctx.db
      .query("packetImportQuestions")
      .withIndex("by_packet_status", (q) => q.eq("packetId", packetId).eq("status", "pending"))
      .collect();
    if (stillPending.length > 0) {
      stillPending.sort((a, b) => a.orderIndex - b.orderIndex);
      const labels = pickBatch(stillPending.map((r) => ({ sourceLabelRaw: r.sourceLabelRaw, kind: r.kind })));
      await ctx.scheduler.runAfter(0, internal.packetPipeline.runChunk, { packetId, labels });
    } else if (packet.verifyEnabled) {
      await ctx.db.patch(packetId, { status: "verifying" });
      await ctx.scheduler.runAfter(0, internal.packetPipeline.runVerify, { packetId });
    } else {
      await ctx.db.patch(packetId, { status: "review" });
    }
  },
});

export const writeVerification = internalMutation({
  args: {
    questionId: v.id("packetImportQuestions"),
    verdict: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { questionId, verdict, detail }) => {
    const row = await ctx.db.get(questionId);
    // Never clobber a row the teacher already edited/approved mid-verify.
    if (!row || row.status !== "review" || row.editedByTeacher) return;
    await ctx.db.patch(questionId, {
      verification: { verdict, ...(detail ? { detail } : {}) },
      status: verdict === "mismatch" ? "flagged" : "review",
    });
  },
});

export const finalizePacket = internalMutation({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => {
    const p = await ctx.db.get(packetId);
    if (!p || p.status === "cancelled") return;
    // Split retries run in parallel — don't declare "review" while a sibling
    // batch still has pending rows.
    const pending = await ctx.db
      .query("packetImportQuestions")
      .withIndex("by_packet_status", (q) => q.eq("packetId", packetId).eq("status", "pending"))
      .first();
    if (pending) return;
    await ctx.db.patch(packetId, { status: "review" });
  },
});

// Attaches a figure image (uploaded by packetPipeline.uploadFigureImage) to
// its published compoundQuestions doc, once the storage write completes.
export const patchFigureImage = internalMutation({
  args: { compoundId: v.id("compoundQuestions"), storageId: v.id("_storage") },
  handler: async (ctx, { compoundId, storageId }) => {
    const q = await ctx.db.get(compoundId);
    if (!q) return;
    await ctx.db.patch(compoundId, { figureImageStorageId: storageId });
  },
});

// Reset every failed row in a packet and re-run the structuring pass over all
// of them at once (crop mode) — one click instead of per-question retries.
export const retryAllFailed = mutation({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => {
    const packet = await ctx.db.get(packetId);
    if (!packet) throw new Error("החבילה לא נמצאה");
    const failed = await ctx.db
      .query("packetImportQuestions")
      .withIndex("by_packet_status", (q) => q.eq("packetId", packetId).eq("status", "failed"))
      .collect();
    if (failed.length === 0) return { retried: 0 };
    for (const row of failed) {
      await ctx.db.patch(row._id, { status: "pending", errorMessage: undefined });
    }
    await ctx.db.patch(packetId, { status: "solving" });
    await armWatchdog(ctx, packetId);
    if (packet.mode === "crops") {
      await ctx.scheduler.runAfter(0, internal.packetPipeline.runStructure, {
        packetId,
        questionIds: failed.map((r) => r._id),
      });
    } else {
      failed.sort((a, b) => a.orderIndex - b.orderIndex);
      const labels = pickBatch(failed.map((r) => ({ sourceLabelRaw: r.sourceLabelRaw, kind: r.kind })));
      await ctx.scheduler.runAfter(0, internal.packetPipeline.runChunk, { packetId, labels });
    }
    return { retried: failed.length };
  },
});

// ── Teacher review edits ──
export const updateQuestionDraft = mutation({
  args: { questionId: v.id("packetImportQuestions"), draft: packetDraft },
  handler: async (ctx, { questionId, draft }) => {
    const row = await ctx.db.get(questionId);
    if (!row) throw new Error("שאלה לא נמצאה");
    if (row.status === "approved") throw new Error("השאלה כבר פורסמה");
    // Editing a proof invalidates any prior confirmation of its steps.
    const wasProof = row.draft?.kind === "compound" && row.draft.sections.some((s) => s.answerType === "proof");
    await ctx.db.patch(questionId, {
      draft,
      editedByTeacher: true,
      ...(wasProof ? { proofReviewedAt: undefined } : {}),
    });
  },
});

export const setQuestionTopic = mutation({
  args: { questionId: v.id("packetImportQuestions"), topicId: v.id("topics") },
  handler: async (ctx, { questionId, topicId }) => {
    const row = await ctx.db.get(questionId);
    if (!row) throw new Error("שאלה לא נמצאה");
    await ctx.db.patch(questionId, { topicId, editedByTeacher: true });
  },
});

// Teacher confirms an extracted proof's claim/reason chain — required before a
// proof question can be published (its steps become auto-grading ground truth).
export const confirmProofSteps = mutation({
  args: { questionId: v.id("packetImportQuestions") },
  handler: async (ctx, { questionId }) => {
    const row = await ctx.db.get(questionId);
    if (!row) throw new Error("שאלה לא נמצאה");
    await ctx.db.patch(questionId, {
      proofReviewedAt: Date.now(),
      // Clearing a "flagged"/"proof_unverified" state moves it into review.
      status: row.status === "approved" ? row.status : "review",
    });
  },
});

export const discardQuestion = mutation({
  args: { questionId: v.id("packetImportQuestions") },
  handler: async (ctx, { questionId }) => {
    const row = await ctx.db.get(questionId);
    if (!row || row.status === "approved") return;
    await ctx.db.patch(questionId, { status: "discarded" });
  },
});

// Re-solve a single failed question without redoing the whole packet.
export const retryQuestion = mutation({
  args: { questionId: v.id("packetImportQuestions") },
  handler: async (ctx, { questionId }) => {
    const row = await ctx.db.get(questionId);
    if (!row || row.status !== "failed") return;
    await ctx.db.patch(questionId, { status: "pending", errorMessage: undefined });
    const packet = await ctx.db.get(row.packetId);
    if (packet && ["solving", "verifying", "review"].includes(packet.status)) {
      if (packet.status !== "solving") await ctx.db.patch(row.packetId, { status: "solving" });
      await armWatchdog(ctx, row.packetId);
      if (packet.mode === "crops") {
        // Crop mode: re-structure just this row from its own crops.
        await ctx.scheduler.runAfter(0, internal.packetPipeline.runStructure, {
          packetId: row.packetId,
          questionIds: [questionId],
        });
      } else {
        await ctx.scheduler.runAfter(0, internal.packetPipeline.runChunk, {
          packetId: row.packetId,
          labels: [row.sourceLabelRaw],
        });
      }
    }
  },
});

// ── Publish ──
// publishRow (shared publish logic) now lives in ./packetPublish and is
// re-exported at the top of this file for backward-compatible import paths.

export const approveQuestion = mutation({
  args: { questionId: v.id("packetImportQuestions") },
  handler: async (ctx, { questionId }) => {
    const row = await ctx.db.get(questionId);
    if (!row) throw new Error("שאלה לא נמצאה");
    return await publishRow(ctx, row);
  },
});

export const bulkApprove = mutation({
  args: { questionIds: v.array(v.id("packetImportQuestions")) },
  handler: async (ctx, { questionIds }) => {
    let approved = 0;
    const errors: { id: Id<"packetImportQuestions">; message: string }[] = [];
    for (const id of questionIds) {
      const row = await ctx.db.get(id);
      if (!row) {
        errors.push({ id, message: "שאלה לא נמצאה" });
        continue;
      }
      try {
        await publishRow(ctx, row);
        approved++;
      } catch (e) {
        errors.push({ id, message: e instanceof Error ? e.message : "פרסום נכשל" });
      }
    }
    return { approved, errors };
  },
});

export const createHomeworkFromPacket = mutation({
  args: {
    packetId: v.id("packetImports"),
    title: v.string(),
    deadline: v.number(),
    topicIds: v.array(v.id("topics")),
    questionIds: v.optional(v.array(v.id("packetImportQuestions"))),
  },
  handler: async (ctx, { packetId, title, deadline, topicIds, questionIds }) => {
    const packet = await ctx.db.get(packetId);
    if (!packet) throw new Error("החבילה לא נמצאה");

    // Default to every reviewable/already-approved question in the packet.
    let rows: Doc<"packetImportQuestions">[];
    if (questionIds) {
      rows = [];
      for (const id of questionIds) {
        const r = await ctx.db.get(id);
        if (r) rows.push(r);
      }
    } else {
      rows = (
        await ctx.db
          .query("packetImportQuestions")
          .withIndex("by_packet", (q) => q.eq("packetId", packetId))
          .collect()
      ).filter((r) => ["review", "flagged", "approved"].includes(r.status));
    }

    const qIds: Id<"questions">[] = [];
    const cIds: Id<"compoundQuestions">[] = [];
    const errors: { id: Id<"packetImportQuestions">; message: string }[] = [];
    for (const row of rows) {
      try {
        const ref = await publishRow(ctx, row);
        if (ref.questionId) qIds.push(ref.questionId);
        if (ref.compoundId) cIds.push(ref.compoundId);
      } catch (e) {
        errors.push({ id: row._id, message: e instanceof Error ? e.message : "פרסום נכשל" });
      }
    }

    const questionCount = qIds.length + cIds.length;
    const homeworkId = await ctx.db.insert("homework", {
      classroomId: packet.classroomId,
      title,
      topicIds,
      questionCount,
      createdAt: Date.now(),
      deadline,
      status: "active",
      pinnedQuestionIds: qIds,
      pinnedCompoundIds: cIds,
    });

    // Fan the pinned questions out to each student as assignedQuestions —
    // without this the homework row exists but renders empty (no assignments).
    // questionCount == pinned count, so assignToStudents adds no extra
    // personalized questions (remaining = 0); students get exactly the packet.
    await ctx.scheduler.runAfter(0, internal.homework.assignToStudents, {
      homeworkId,
      classroomId: packet.classroomId,
      topicIds,
      questionCount,
      pinnedQuestionIds: qIds,
      pinnedCompoundIds: cIds,
    });

    return { homeworkId, pinnedQuestions: qIds.length, pinnedCompounds: cIds.length, errors };
  },
});
