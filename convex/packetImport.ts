import { mutation, query, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { packetDraft } from "./packetValidators";
import { normalizeLabel, pickBatch, matchTopic, indexBySourceLabel } from "./packetParse";

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
    return rows;
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

// ── Internal reads used by the pipeline actions ──
export const getPacketInternal = internalQuery({
  args: { packetId: v.id("packetImports") },
  handler: async (ctx, { packetId }) => await ctx.db.get(packetId),
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
    await ctx.db.patch(packetId, { status: "review" });
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
      await ctx.scheduler.runAfter(0, internal.packetPipeline.runChunk, {
        packetId: row.packetId,
        labels: [row.sourceLabelRaw],
      });
    }
  },
});

// ── Publish ──
// Shared publish logic, reused by approveQuestion / bulkApprove / homework
// helpers. Throws Hebrew errors; idempotent via the row's published ids.
export async function publishRow(
  ctx: MutationCtx,
  row: Doc<"packetImportQuestions">,
): Promise<{ questionId: Id<"questions"> | null; compoundId: Id<"compoundQuestions"> | null }> {
  if (row.publishedQuestionId) return { questionId: row.publishedQuestionId, compoundId: null };
  if (row.publishedCompoundId) return { questionId: null, compoundId: row.publishedCompoundId };
  if (row.status === "discarded") throw new Error("השאלה נמחקה");
  if (!row.draft) throw new Error("אין טיוטה לשאלה");
  if (!row.topicId) throw new Error("יש לבחור נושא לפני אישור השאלה");

  const d = row.draft;
  const topicId = row.topicId;

  // Multiple-choice → a real `questions` row.
  if (d.kind === "simple" && d.format === "multiple_choice") {
    const questionId = await ctx.db.insert("questions", {
      topicId,
      difficulty: d.difficulty,
      stem: d.stem,
      choices: d.choices,
      correctIndex: d.correctIndex ?? 0,
      solutionSteps: d.solutionSteps,
      hint: d.hints[0] ?? "",
      explanation: d.explanation,
    });
    await ctx.db.patch(row._id, { status: "approved", publishedQuestionId: questionId });
    return { questionId, compoundId: null };
  }

  // Everything else → a `compoundQuestions` row.
  let sections: Doc<"compoundQuestions">["sections"];
  let difficulty: number;
  let tags: string[];
  let preamble: string;
  let fullSolution: string;

  if (d.kind === "compound") {
    sections = d.sections;
    difficulty = d.difficulty;
    tags = d.tags;
    preamble = d.preamble;
    fullSolution = d.fullSolution;
  } else {
    // simple fill_blank → a single-section compound. Points pinned to 100 (a
    // synthesized single section always owns the whole question).
    sections = [
      {
        label: "א",
        prompt: d.stem,
        answerType: "expression",
        correctAnswer: d.correctAnswer ?? "",
        solutionSteps: d.solutionSteps,
        hints: d.hints,
        points: 100,
        skillsTested: [],
      },
    ];
    difficulty = d.difficulty;
    tags = [];
    preamble = "";
    fullSolution = d.explanation;
  }

  // Proof sections become live auto-grading ground truth — guard their shape and
  // require an explicit teacher confirmation of the claim/reason chain.
  const hasProof = sections.some((s) => s.answerType === "proof");
  if (hasProof) {
    if (!row.proofReviewedAt) throw new Error("יש לאשר את שלבי ההוכחה לפני פרסום השאלה");
    for (const s of sections) {
      if (s.answerType !== "proof") continue;
      if (!s.proofSteps || s.proofSteps.length === 0 || !s.proofMeta?.given?.trim() || !s.proofMeta?.toProve?.trim()) {
        throw new Error("בסעיף הוכחה חסרים נתון/להוכיח או שלבי הוכחה");
      }
    }
  }

  const compoundId = await ctx.db.insert("compoundQuestions", {
    topicIds: [topicId],
    difficulty,
    tags,
    preamble,
    preambleParams: [],
    sections,
    fullSolution,
  });
  await ctx.db.patch(row._id, { status: "approved", publishedCompoundId: compoundId });
  return { questionId: null, compoundId };
}

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

export const pinToHomework = mutation({
  args: {
    homeworkId: v.id("homework"),
    questionIds: v.array(v.id("packetImportQuestions")),
  },
  handler: async (ctx, { homeworkId, questionIds }) => {
    const homework = await ctx.db.get(homeworkId);
    if (!homework) throw new Error("שיעורי הבית לא נמצאו");
    const qIds = new Set<Id<"questions">>(homework.pinnedQuestionIds ?? []);
    const cIds = new Set<Id<"compoundQuestions">>(homework.pinnedCompoundIds ?? []);
    const errors: { id: Id<"packetImportQuestions">; message: string }[] = [];
    for (const id of questionIds) {
      const row = await ctx.db.get(id);
      if (!row) {
        errors.push({ id, message: "שאלה לא נמצאה" });
        continue;
      }
      try {
        const ref = await publishRow(ctx, row);
        if (ref.questionId) qIds.add(ref.questionId);
        if (ref.compoundId) cIds.add(ref.compoundId);
      } catch (e) {
        errors.push({ id, message: e instanceof Error ? e.message : "פרסום נכשל" });
      }
    }
    await ctx.db.patch(homeworkId, {
      pinnedQuestionIds: Array.from(qIds),
      pinnedCompoundIds: Array.from(cIds),
    });
    return { pinnedQuestions: qIds.size, pinnedCompounds: cIds.size, errors };
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

    const homeworkId = await ctx.db.insert("homework", {
      classroomId: packet.classroomId,
      title,
      topicIds,
      questionCount: qIds.length + cIds.length,
      createdAt: Date.now(),
      deadline,
      status: "active",
      pinnedQuestionIds: qIds,
      pinnedCompoundIds: cIds,
    });
    return { homeworkId, pinnedQuestions: qIds.length, pinnedCompounds: cIds.length, errors };
  },
});
