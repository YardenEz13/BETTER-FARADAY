// ── Packet extraction prompts ──
// Three Gemini prompts for the full-PDF packet pipeline: a cheap INVENTORY pass
// (list every question, no solving), a SOLVE pass (fully solve a scoped subset
// into the app's draft shapes, incl. the geometry-proof format), and a VERIFY
// pass (independent re-solve for auto-grade confidence).
//
// Convention: instructions are in English (they steer the model reliably), but
// EVERY field the model emits must be Hebrew. Math goes in $...$ and must stay
// KaTeX-safe — never wrap Hebrew in \text{...} (it breaks under strict:"ignore").

/** Render the injected {{TOPIC_LIST}} — one topic per line, verbatim nameHe. */
export function buildTopicList(topics: { nameHe: string }[]): string {
  return topics.map((t) => `- ${t.nameHe}`).join("\n");
}

// ── Inventory: catalogue every question, solve nothing ──
export function inventoryPrompt(topicList: string): string {
  return `You are cataloguing a Hebrew high-school math packet (מטלת קיץ) supplied as a PDF.
Do NOT solve anything. List EVERY distinct question in the packet, in reading order.

For each question output one object:
{
  "sourceLabel": string,   // the exact question number/label AS PRINTED, verbatim (e.g. "שאלה 3", "12", "ב1")
  "pageStart": number,     // 1-based PDF page where the question begins
  "pageEnd": number,       // 1-based PDF page where it ends (same as pageStart if on one page)
  "kind": "simple" | "compound" | "proof",
  "topicHe": string        // the single best-matching topic from the list below, copied verbatim
}

Rules:
- "simple": one standalone question (multiple-choice, or a single fill-in answer).
- "compound": one question with several labelled sub-sections (סעיף א/ב/ג...).
- "proof": a geometry question whose task is to prove something (contains הוכח / הוכיחו / הוֹכֵח).
  Classify it as "proof" even if it also has sub-sections.
- Every distinct printed question gets EXACTLY ONE entry. Do not merge two questions, and do not
  split a question's sub-sections into separate entries.
- "topicHe" MUST be copied verbatim from this list (pick the closest match):
${topicList}
- Go through EVERY page. Do not stop early.
- Return ONLY a valid JSON array of these objects. No markdown, no code fences, no prose.`;
}

// ── Solve: fully solve a scoped subset of the packet ──
export function solvePrompt(topicList: string, labels: string[], expectedCount: number): string {
  const labelLines = labels.map((l, i) => `${i + 1}. "${l}"`).join("\n");
  return `You are an expert Israeli high-school math teacher building an answer key from a Hebrew PDF packet.
The FULL packet PDF is attached. In THIS call, extract and FULLY SOLVE ONLY these questions:
${labelLines}
Return EXACTLY ${expectedCount} entries — one per label above, in that order. Ignore every other question.

Each entry is one of two shapes.

SIMPLE question:
{
  "kind": "simple",
  "sourceLabel": string,          // verbatim label; MUST match the requested label
  "topicHe": string,              // verbatim from the topic list below
  "format": "multiple_choice" | "fill_blank",
  "stem": string,                 // full Hebrew question text; math in $...$
  "choices": string[],            // 4 items for multiple_choice, [] for fill_blank
  "correctIndex": number,         // 0-3 for multiple_choice; omit for fill_blank
  "correctAnswer": string,        // the answer for fill_blank; "" for multiple_choice
  "difficulty": number,           // 1-5, RELATIVE to the rest of this packet
  "solutionSteps": string[],      // full worked steps in Hebrew
  "hints": string[],              // EXACTLY 2 progressive hints: gentle first, almost-gives-it-away second
  "skillsTested": string[],       // 2-4 Hebrew skill names, e.g. "גזירה", "פתרון משוואה ריבועית"
  "explanation": string           // short Hebrew explanation of the full solution
}

COMPOUND question (several סעיפים, OR a geometry proof):
{
  "kind": "compound",
  "sourceLabel": string,
  "topicHe": string,              // verbatim from the topic list
  "difficulty": number,           // 1-5, relative to the packet
  "tags": string[],               // 2-5 Hebrew topical tags
  "preamble": string,             // shared given / function definition / figure description; math in $...$
  "sections": [
    {
      "label": string,            // "א","ב",... (use "א" if a proof has no sub-parts)
      "prompt": string,           // the sub-question text in Hebrew
      "answerType": "numeric" | "expression" | "range" | "coordinates" | "graph_description" | "proof",
      "correctAnswer": string,    // the answer you computed yourself
      "solutionSteps": string[],
      "hints": string[],          // EXACTLY 2 progressive hints
      "points": number,           // Bagrut-style; points across ALL sections of ONE question sum to ~100
      "skillsTested": string[]    // 2-4 Hebrew skills
      // proof-only fields (see the GEOMETRY PROOF RULE) go here when answerType === "proof"
    }
  ],
  "fullSolution": string          // full Hebrew narrative solution covering all sections together
}

GEOMETRY PROOF RULE — MANDATORY:
If a section's task is to prove something (its prompt contains הוכח / הוכיחו / הוֹכֵח), you MUST, for THAT section:
- set "answerType": "proof"
- set "correctAnswer" to a single Hebrew sentence stating what was proven (e.g. "משולש AOB חופף למשולש COD")
- add "proofMeta": {
    "given": string,               // the נתון, copied/derived from the question, verbatim where possible
    "toProve": string,             // the להוכיח statement, verbatim where possible
    "diagramDescription": string   // a precise Hebrew description of the figure (points, lines, what is drawn)
  }   // do NOT output an SVG or any image
- add "proofSteps": an ordered two-column claim/reason chain that ends in the thing to prove:
  [
    {
      "stepIndex": number,         // 0-based
      "expectedClaim": string,     // one logical claim, e.g. "AO = OC"
      "expectedReason": string,    // the justifying theorem/reason using STANDARD Hebrew theorem names,
                                   // e.g. "צ.ז.צ", "ז.צ.ז", "צ.צ.צ", "אלכסוני מקבילית מחצים זה את זה",
                                   // "זוויות קודקוד שוות", "זוויות מתחלפות בין ישרים מקבילים"
      "clueIfWrong": string        // a short Hebrew nudge if the student's claim/reason is wrong
    }
  ]
A single compound question may mix section types — e.g. section א numeric and section ב a proof. Apply the
proof rule PER SECTION, only to the sections that ask to prove.

Rules:
- Solve every question yourself, fully and correctly — this becomes the auto-grading answer key.
- Preserve any [FIGURE: ...] markers from the source as-is inside the relevant text field.
- Do NOT output multiple-choice options inside a compound section; express the answer in "correctAnswer".
- "topicHe" MUST be copied verbatim from:
${topicList}
- All content is Hebrew. Math in $...$ only. NEVER wrap Hebrew in \\text{...}. Keep every formula KaTeX-safe.
- Return ONLY a valid JSON array of EXACTLY ${expectedCount} entries. No markdown, no code fences, no prose.`;
}

// ── Verify: independently re-solve one answer and compare ──
// Only meaningful for numeric / expression / multiple_choice sections.
export function verifyPrompt(stem: string, answerType: string, candidateAnswer: string): string {
  return `You are independently checking one Hebrew math answer for correctness. Solve the problem yourself
from scratch, then compare your result to the candidate answer. Do NOT assume the candidate is correct.

Problem (Hebrew), answerType "${answerType}":
${stem}

Candidate answer: ${candidateAnswer}

Return ONLY this JSON object (no markdown, no code fences, no prose):
{
  "agrees": boolean,          // true if the candidate matches YOUR independent result
  "correctedAnswer": string,  // your answer if you disagree; "" if you agree
  "note": string              // one short Hebrew sentence explaining any disagreement; "" if you agree
}

Rules:
- Treat algebraically-equivalent expressions as equal (e.g. "2x+4" == "2(x+2)").
- Be strict on numeric mismatches; be lenient on equivalent forms.`;
}
