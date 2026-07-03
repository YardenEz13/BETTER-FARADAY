// ── Packet extraction: pure parsing & normalization ──
// No Convex context — deterministic, unit-tested helpers used by the packet
// pipeline to turn raw Gemini JSON into schema-safe drafts. The normalizers
// exist because the model routinely omits schema-REQUIRED fields (points,
// skillsTested, correctAnswer) and truncates long responses; inserting an
// un-normalized draft would throw a Convex validator error and fail the whole
// chunk. Everything here degrades gracefully instead.

export type SimpleFormat = "multiple_choice" | "fill_blank";
export type AnswerType =
  | "numeric" | "expression" | "range" | "proof" | "graph_description" | "coordinates";

export interface PacketProofStep {
  stepIndex: number;
  expectedClaim: string;
  expectedReason: string;
  clueIfWrong?: string;
}

export interface PacketSection {
  label: string;
  prompt: string;
  dependsOn?: string[];
  answerType: AnswerType;
  correctAnswer: string;
  solutionSteps: string[];
  hints: string[];
  points: number;
  skillsTested: string[];
  proofMeta?: { given: string; toProve: string; diagramDescription?: string };
  proofSteps?: PacketProofStep[];
}

export interface SimpleDraft {
  kind: "simple";
  format: SimpleFormat;
  difficulty: number;
  stem: string;
  choices: string[];
  correctIndex?: number;
  correctAnswer?: string;
  solutionSteps: string[];
  hints: string[];
  explanation: string;
}

export interface CompoundDraft {
  kind: "compound";
  difficulty: number;
  tags: string[];
  preamble: string;
  sections: PacketSection[];
  fullSolution: string;
}

export type PacketDraft = SimpleDraft | CompoundDraft;

export const ANSWER_TYPES: readonly AnswerType[] = [
  "numeric", "expression", "range", "proof", "graph_description", "coordinates",
];

const DEFAULT_DIFFICULTY = 3;
const HEBREW_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י"];
// Placeholder written into a proof section's required `correctAnswer` when the
// model leaves it blank (proofs are graded via proofSteps, not this string).
const PROOF_ANSWER_PLACEHOLDER = "ראה הוכחה מלאה";
// Generic progressive fallbacks used only to pad a question up to exactly two
// hints when the model returned fewer.
const GENERIC_HINTS = ["התחל מהנתונים שבשאלה.", "עקוב אחר שלבי הפתרון אחד־אחד."];

// ── Primitive coercions ──

function toStr(x: unknown): string {
  if (x === null || x === undefined) return "";
  return typeof x === "string" ? x : String(x);
}

/** Treat arbitrary parsed JSON as an indexable object (empty if it isn't one). */
function rec(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" ? (x as Record<string, unknown>) : {};
}

/** Strings only, non-empty after trim. Preserves order. */
function toStringList(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.map(toStr).map((s) => s.trim()).filter(Boolean);
}

function clampDifficulty(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) return DEFAULT_DIFFICULTY;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Coerce to exactly two progressive hints, padding with generics if short. */
function coerceHints(x: unknown): string[] {
  const got = toStringList(x).slice(0, 2);
  while (got.length < 2) got.push(GENERIC_HINTS[got.length] ?? GENERIC_HINTS[0]);
  return got.slice(0, 2);
}

// ── Fence stripping & truncated-array salvage ──

/** Remove a leading ```json / ``` fence and a trailing ``` fence. */
export function stripFences(raw: string): string {
  return toStr(raw)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Parse a JSON array, salvaging as many complete top-level elements as possible
 * when the model truncated its output mid-element. Returns [] if nothing can be
 * recovered. Assumes elements are objects/arrays (packet entries always are).
 */
export function salvageJsonArray(raw: string): unknown[] {
  const s = stripFences(raw);
  if (!s) return [];

  // Fast path: well-formed JSON.
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") return [parsed];
    return [];
  } catch {
    // fall through to salvage
  }

  const start = s.indexOf("[");
  if (start === -1) return [];
  const body = s.slice(start + 1);

  const chunks: string[] = [];
  let depth = 0;
  let inStr = false;
  let esc = false;
  let elemStart = -1;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      if (depth === 0 && elemStart === -1) elemStart = i;
      inStr = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      if (depth === 0 && elemStart === -1) elemStart = i;
      depth++;
      continue;
    }
    if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0 && elemStart !== -1) {
        chunks.push(body.slice(elemStart, i + 1));
        elemStart = -1;
      }
      if (depth < 0) break; // closing ] of the outer array
      continue;
    }
  }

  const out: unknown[] = [];
  for (const c of chunks) {
    try {
      out.push(JSON.parse(c));
    } catch {
      // incomplete trailing element — drop it
    }
  }
  return out;
}

// ── Label normalization ──

/**
 * Canonicalize a question label so the inventory pass and the solve pass agree
 * even when Gemini formats it differently between calls ("שאלה 5" ≡ "5." ≡
 * "5)"). Strips niqqud, common prefix words, and punctuation, keeping only
 * digits and letters.
 */
export function normalizeLabel(raw: string): string {
  let s = toStr(raw).normalize("NFKC");
  s = s.replace(/[֑-ׇ]/g, ""); // Hebrew niqqud
  s = s.toLowerCase().trim();
  s = s.replace(/שאלה|תרגיל|סעיף|מספר|מס['׳`]?|question|q(?=\s*\d)|no\.?(?=\s*\d)/g, "");
  s = s.replace(/[^0-9a-zא-ת]/g, ""); // keep digits + Latin + Hebrew letters
  return s;
}

/** Keep one item per normalized label (last occurrence wins), first-seen order. */
export function dedupeByLabel<T extends { sourceLabel?: string }>(items: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    byKey.set(normalizeLabel(toStr(item.sourceLabel)), item);
  }
  return Array.from(byKey.values());
}

/** Index solve results by their normalized sourceLabel (last occurrence wins). */
export function indexBySourceLabel<T extends { sourceLabel?: string }>(items: T[]): Map<string, T> {
  const byKey = new Map<string, T>();
  for (const item of items) {
    byKey.set(normalizeLabel(toStr(item.sourceLabel)), item);
  }
  return byKey;
}

/**
 * Greedily take the next solve chunk from pending rows (assumed order-sorted):
 * up to `maxSimple` simple questions OR `maxHeavy` compound/proof questions,
 * whichever limit is hit first. Compound/proof are output-heavy, so fewer per
 * call. Returns the raw labels to hand to the solve prompt.
 */
export function pickBatch(
  rows: { sourceLabelRaw: string; kind: string }[],
  maxSimple = 4,
  maxHeavy = 2,
): string[] {
  const batch: string[] = [];
  let simple = 0;
  let heavy = 0;
  for (const row of rows) {
    batch.push(row.sourceLabelRaw);
    if (row.kind === "compound" || row.kind === "proof") heavy++;
    else simple++;
    if (heavy >= maxHeavy || simple >= maxSimple) break;
  }
  return batch;
}

/**
 * Resolve the model's Hebrew topic guess to one of the app's topics: exact
 * nameHe match first, then a niqqud/whitespace-insensitive containment match.
 * Returns undefined when nothing matches (the teacher then picks the topic).
 */
export function matchTopic<T extends { nameHe: string }>(topicHe: string, topics: T[]): T | undefined {
  const norm = (s: string) =>
    toStr(s).normalize("NFKC").replace(/[֑-ׇ]/g, "").replace(/\s+/g, "").trim();
  const exact = topics.find((t) => t.nameHe === topicHe);
  if (exact) return exact;
  const target = norm(topicHe);
  if (!target) return undefined;
  return topics.find((t) => {
    const n = norm(t.nameHe);
    return n === target || n.includes(target) || target.includes(n);
  });
}

// ── Draft normalization ──

function normalizeSection(raw: unknown, index: number, sectionCount: number): PacketSection {
  const r = rec(raw);
  const rawProofSteps = Array.isArray(r.proofSteps) ? r.proofSteps : null;

  // A section with proofSteps is always a proof, regardless of what the model
  // labelled it; otherwise whitelist the answerType, defaulting to "expression".
  let answerType: AnswerType;
  if (rawProofSteps && rawProofSteps.length > 0) {
    answerType = "proof";
  } else if (ANSWER_TYPES.includes(r.answerType as AnswerType)) {
    answerType = r.answerType as AnswerType;
  } else {
    answerType = "expression";
  }

  let correctAnswer = toStr(r.correctAnswer);
  if (answerType === "proof" && !correctAnswer.trim()) {
    correctAnswer = PROOF_ANSWER_PLACEHOLDER;
  }

  const pointsRaw = typeof r.points === "number" ? r.points : Number(r.points);
  const points =
    Number.isFinite(pointsRaw) && pointsRaw > 0
      ? Math.round(pointsRaw)
      : Math.round(100 / Math.max(1, sectionCount));

  const section: PacketSection = {
    label: toStr(r.label).trim() || HEBREW_LETTERS[index] || String(index + 1),
    prompt: toStr(r.prompt),
    answerType,
    correctAnswer,
    solutionSteps: toStringList(r.solutionSteps),
    hints: coerceHints(r.hints),
    points,
    skillsTested: toStringList(r.skillsTested),
  };

  const dependsOn = toStringList(r.dependsOn);
  if (dependsOn.length) section.dependsOn = dependsOn;

  if (answerType === "proof") {
    const meta = rec(r.proofMeta);
    section.proofMeta = { given: toStr(meta.given), toProve: toStr(meta.toProve) };
    const diagram = toStr(meta.diagramDescription).trim();
    if (diagram) section.proofMeta.diagramDescription = diagram;

    if (rawProofSteps) {
      section.proofSteps = rawProofSteps.map((st: unknown, i: number) => {
        const s = rec(st);
        const step: PacketProofStep = {
          stepIndex: Number.isFinite(s.stepIndex) ? Number(s.stepIndex) : i,
          expectedClaim: toStr(s.expectedClaim),
          expectedReason: toStr(s.expectedReason),
        };
        const clue = toStr(s.clueIfWrong).trim();
        if (clue) step.clueIfWrong = clue;
        return step;
      });
    }
  }

  return section;
}

export function normalizeSimple(raw: unknown): SimpleDraft {
  const r = rec(raw);
  const format: SimpleFormat = r.format === "multiple_choice" ? "multiple_choice" : "fill_blank";
  const choices = format === "multiple_choice" && Array.isArray(r.choices) ? r.choices.map(toStr) : [];

  let correctIndex: number | undefined;
  if (format === "multiple_choice") {
    const idx = typeof r.correctIndex === "number" ? r.correctIndex : Number(r.correctIndex);
    correctIndex = Number.isFinite(idx) ? Math.min(Math.max(0, Math.round(idx)), Math.max(0, choices.length - 1)) : 0;
  }

  // Accept both the array `hints` and a legacy singular `hint` field.
  const hintsInput = r.hints ?? (r.hint ? [r.hint] : []);

  const base = {
    kind: "simple" as const,
    format,
    difficulty: clampDifficulty(r.difficulty),
    stem: toStr(r.stem),
    choices,
    solutionSteps: toStringList(r.solutionSteps),
    hints: coerceHints(hintsInput),
    explanation: toStr(r.explanation),
  };

  // Only include the format-relevant optional field — never an explicit
  // `undefined`, which Convex rejects when the draft is passed as a mutation arg.
  return format === "multiple_choice"
    ? { ...base, correctIndex }
    : { ...base, correctAnswer: toStr(r.correctAnswer) };
}

export function normalizeCompound(raw: unknown): CompoundDraft {
  const r = rec(raw);
  const rawSections: unknown[] = Array.isArray(r.sections) ? r.sections : [];
  const count = Math.max(1, rawSections.length);
  return {
    kind: "compound",
    difficulty: clampDifficulty(r.difficulty),
    tags: toStringList(r.tags),
    preamble: toStr(r.preamble),
    sections: rawSections.map((s, i) => normalizeSection(s, i, count)),
    fullSolution: toStr(r.fullSolution),
  };
}

/**
 * Dispatch on `kind`, inferring it from the payload shape when the model omits
 * it (a `sections` array ⇒ compound, otherwise simple).
 */
export function normalizeDraft(raw: unknown): PacketDraft {
  const r = rec(raw);
  const isCompound = r.kind === "compound" || (r.kind !== "simple" && Array.isArray(r.sections));
  return isCompound ? normalizeCompound(raw) : normalizeSimple(raw);
}
