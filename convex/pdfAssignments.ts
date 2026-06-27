import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Answer normalization ──
// Mirrors the lenient check in CompoundQuestionRenderer (lowercase + strip
// whitespace) but WITHOUT the "long answers always pass" shortcut — here the
// teacher types a canonical answer, so we want a real comparison. We also fold
// a few interchangeable math glyphs (unicode minus, multiplication signs) and
// normalise the decimal separator so "1.5" and "1,5" match.
function normalizeAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[−‒–—]/g, "-") // unicode minus / dashes → "-"
    .replace(/[×∙·*]/g, "*")
    .replace(/,/g, ".");
}

// Evaluate a normalized answer to a number when it's purely arithmetic —
// handles fractions (1/2), decimals (0.5), and +-*/^ with parentheses, plus a
// leading "x="/"y="/"=" which students often include. Returns null for anything
// non-numeric (e.g. "כן", "x=3a", "עולה") so we fall back to string matching.
// Strip a leading single-variable assignment ("x=", "y=", "n=", or bare "=")
// that students often prepend, so "x=3" is treated as "3" and "y=2x" as "2x".
function stripVarAssign(s: string): string {
  return s.replace(/^[a-z]?=/, "");
}

function evalNumeric(s: string): number | null {
  const stripped = stripVarAssign(s);
  if (!/^[-+*/^().\d]+$/.test(stripped)) return null; // only math chars allowed
  let i = 0;
  const peek = () => stripped[i];
  const fail = Symbol("fail");

  // Recursive-descent: expr → term (('+'|'-') term)*
  function parseExpr(): number | typeof fail {
    let v = parseTerm();
    if (v === fail) return fail;
    while (peek() === "+" || peek() === "-") {
      const op = stripped[i++];
      const rhs = parseTerm();
      if (rhs === fail) return fail;
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  // term → factor (('*'|'/') factor)*
  function parseTerm(): number | typeof fail {
    let v = parseFactor();
    if (v === fail) return fail;
    while (peek() === "*" || peek() === "/") {
      const op = stripped[i++];
      const rhs = parseFactor();
      if (rhs === fail) return fail;
      if (op === "/") { if (rhs === 0) return fail; v = v / rhs; }
      else v = v * rhs;
    }
    return v;
  }
  // factor → '-'? base ('^' factor)?
  function parseFactor(): number | typeof fail {
    let neg = false;
    while (peek() === "+" || peek() === "-") { if (stripped[i++] === "-") neg = !neg; }
    let v = parseBase();
    if (v === fail) return fail;
    if (peek() === "^") { i++; const e = parseFactor(); if (e === fail) return fail; v = Math.pow(v, e); }
    return neg ? -v : v;
  }
  // base → number | '(' expr ')'
  function parseBase(): number | typeof fail {
    if (peek() === "(") {
      i++;
      const v = parseExpr();
      if (v === fail || peek() !== ")") return fail;
      i++;
      return v;
    }
    const start = i;
    while (i < stripped.length && /[\d.]/.test(stripped[i])) i++;
    if (i === start) return fail;
    const num = Number(stripped.slice(start, i));
    return Number.isFinite(num) ? num : fail;
  }

  const result = parseExpr();
  if (result === fail || i !== stripped.length || !Number.isFinite(result)) return null;
  return result;
}

function answersMatch(studentRaw: string, correctRaw: string): boolean {
  const a = normalizeAnswer(studentRaw);
  const b = normalizeAnswer(correctRaw);
  if (!a || !b) return false;
  if (a === b) return true;
  // Tolerate a "x="/"y=" prefix on either side ("y=2x" == "2x", "x=3" == "3").
  if (stripVarAssign(a) === stripVarAssign(b)) return true;
  // Math equivalence: 0.5 == 1/2 == 2/4, 3 == 3.0, (1+2)/4 == 0.75.
  const na = evalNumeric(a);
  const nb = evalNumeric(b);
  if (na !== null && nb !== null) {
    return Math.abs(na - nb) <= 1e-6 * Math.max(1, Math.abs(nb));
  }
  return false;
}

// ── Teacher: get a Convex file-storage upload URL for the source PDF ──
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// ── Teacher: create the assignment shell (questions added separately) ──
export const createAssignment = mutation({
  args: {
    classroomId: v.id("classrooms"),
    studentId: v.id("students"),
    title: v.string(),
    pdfStorageId: v.optional(v.id("_storage")),
    pdfFileName: v.optional(v.string()),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pdfAssignments", {
      classroomId: args.classroomId,
      studentId: args.studentId,
      title: args.title,
      pdfStorageId: args.pdfStorageId,
      pdfFileName: args.pdfFileName,
      createdAt: Date.now(),
      deadline: args.deadline,
      status: "active",
    });
  },
});

// ── Teacher: append one cropped question (with its parts) to an assignment ──
export const addQuestion = mutation({
  args: {
    assignmentId: v.id("pdfAssignments"),
    imageBase64: v.string(),
    imageMimeType: v.string(),
    parts: v.array(v.object({
      label: v.string(),
      correctAnswer: v.string(),
      points: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pdfQuestions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .collect();
    return await ctx.db.insert("pdfQuestions", {
      assignmentId: args.assignmentId,
      order: existing.length,
      imageBase64: args.imageBase64,
      imageMimeType: args.imageMimeType,
      parts: args.parts.map((p) => ({
        label: p.label,
        correctAnswer: p.correctAnswer,
        points: p.points,
      })),
    });
  },
});

// ── Teacher: remove a question (builder edits) ──
export const deleteQuestion = mutation({
  args: { questionId: v.id("pdfQuestions") },
  handler: async (ctx, { questionId }) => {
    await ctx.db.delete(questionId);
  },
});

// ── Teacher: delete an assignment and its questions + stored PDF ──
export const deleteAssignment = mutation({
  args: { assignmentId: v.id("pdfAssignments") },
  handler: async (ctx, { assignmentId }) => {
    const assignment = await ctx.db.get(assignmentId);
    if (!assignment) return;
    const questions = await ctx.db
      .query("pdfQuestions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignmentId))
      .collect();
    for (const q of questions) await ctx.db.delete(q._id);
    if (assignment.pdfStorageId) await ctx.storage.delete(assignment.pdfStorageId);
    await ctx.db.delete(assignmentId);
  },
});

// ── Teacher: list assignments created for a classroom (with progress) ──
export const listForClassroom = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    const assignments = await ctx.db
      .query("pdfAssignments")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .order("desc")
      .collect();

    const enriched = [];
    for (const a of assignments) {
      const questions = await ctx.db
        .query("pdfQuestions")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", a._id))
        .collect();
      const student = await ctx.db.get(a.studentId);
      const allParts = questions.flatMap((q) => q.parts);
      const answered = allParts.filter((p) => p.studentAnswer != null).length;
      const correct = allParts.filter((p) => p.isCorrect === true).length;
      enriched.push({
        ...a,
        studentName: student?.name ?? "תלמיד",
        avatarColor: student?.avatarColor ?? "#3b82f6",
        questionCount: questions.length,
        partCount: allParts.length,
        answeredCount: answered,
        correctCount: correct,
        // Partial credit: share of all parts answered correctly.
        scorePercent: allParts.length > 0 ? Math.round((correct / allParts.length) * 100) : 0,
      });
    }
    return enriched;
  },
});

// ── Student: list their PDF assignments (lightweight, no images) ──
export const listForStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const assignments = await ctx.db
      .query("pdfAssignments")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .collect();

    const result = [];
    for (const a of assignments) {
      const questions = await ctx.db
        .query("pdfQuestions")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", a._id))
        .collect();
      const allParts = questions.flatMap((q) => q.parts);
      const answered = allParts.filter((p) => p.studentAnswer != null).length;
      const correct = allParts.filter((p) => p.isCorrect === true).length;
      result.push({
        _id: a._id,
        title: a.title,
        status: a.status,
        deadline: a.deadline,
        createdAt: a.createdAt,
        completedAt: a.completedAt,
        questionCount: questions.length,
        partCount: allParts.length,
        answeredCount: answered,
        correctCount: correct,
        scorePercent: allParts.length > 0 ? Math.round((correct / allParts.length) * 100) : 0,
      });
    }
    return result;
  },
});

// ── Get one assignment with its questions + a served PDF url ──
export const getAssignment = query({
  args: { assignmentId: v.id("pdfAssignments") },
  handler: async (ctx, { assignmentId }) => {
    const assignment = await ctx.db.get(assignmentId);
    if (!assignment) return null;
    const questions = await ctx.db
      .query("pdfQuestions")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignmentId))
      .collect();
    questions.sort((a, b) => a.order - b.order);
    // Never ship answer keys for parts the student hasn't attempted yet — otherwise
    // every correct answer is sitting in the network payload before they even try.
    // Once a part is answered we keep it, so the UI can still show "the correct
    // answer was…" after a wrong submit.
    const safeQuestions = questions.map((q) => ({
      ...q,
      parts: q.parts.map((p) =>
        p.studentAnswer != null ? p : { ...p, correctAnswer: "" }
      ),
    }));
    const pdfUrl = assignment.pdfStorageId
      ? await ctx.storage.getUrl(assignment.pdfStorageId)
      : null;
    return { ...assignment, pdfUrl, questions: safeQuestions };
  },
});

// ── Student: submit an answer for one PART of a question → instant ✓/✗ ──
export const submitPdfAnswer = mutation({
  args: {
    questionId: v.id("pdfQuestions"),
    partIndex: v.number(),
    studentAnswer: v.string(),
  },
  handler: async (ctx, { questionId, partIndex, studentAnswer }) => {
    const question = await ctx.db.get(questionId);
    if (!question) throw new Error("Question not found");
    const part = question.parts[partIndex];
    if (!part) throw new Error("Part not found");
    const isCorrect = answersMatch(studentAnswer, part.correctAnswer);
    const nextParts = question.parts.map((p, i) =>
      i === partIndex ? { ...p, studentAnswer, isCorrect, answeredAt: Date.now() } : p
    );
    await ctx.db.patch(questionId, { parts: nextParts });

    // Mark the whole assignment complete once every part of every question has
    // been answered — drives the teacher's "אלמוג finished" notification.
    const assignment = await ctx.db.get(question.assignmentId);
    if (assignment && !assignment.completedAt) {
      const all = await ctx.db
        .query("pdfQuestions")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", question.assignmentId))
        .collect();
      // Use the just-patched parts for the current question (not yet re-read here).
      const done = all.every((q) =>
        (q._id === questionId ? nextParts : q.parts).every((p) => p.studentAnswer != null)
      );
      if (done) {
        await ctx.db.patch(question.assignmentId, { status: "completed", completedAt: Date.now() });
      }
    }
    return { isCorrect, correctAnswer: part.correctAnswer };
  },
});
