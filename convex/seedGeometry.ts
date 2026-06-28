import { mutation } from "./_generated/server";

const DIAGRAM_SVG = `<svg viewBox="0 0 340 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
  <polygon points="80,50 220,50 260,150 120,150" fill="rgba(56,189,248,0.06)" stroke="#38bdf8" stroke-width="2" stroke-linejoin="round"/>
  <line x1="80" y1="50" x2="260" y2="150" stroke="#7dd3fc" stroke-width="1.5" stroke-dasharray="7,4" opacity="0.8"/>
  <line x1="220" y1="50" x2="120" y2="150" stroke="#7dd3fc" stroke-width="1.5" stroke-dasharray="7,4" opacity="0.8"/>
  <polygon points="80,50 220,50 170,100" fill="rgba(99,102,241,0.15)" stroke="none"/>
  <polygon points="260,150 120,150 170,100" fill="rgba(99,102,241,0.15)" stroke="none"/>
  <circle cx="80" cy="50" r="3.5" fill="#38bdf8"/>
  <circle cx="220" cy="50" r="3.5" fill="#38bdf8"/>
  <circle cx="260" cy="150" r="3.5" fill="#38bdf8"/>
  <circle cx="120" cy="150" r="3.5" fill="#38bdf8"/>
  <circle cx="170" cy="100" r="4.5" fill="#f0abfc" stroke="#e879f9" stroke-width="1"/>
  <text x="62" y="46" fill="#e2e8f0" font-size="15" font-family="monospace" font-weight="bold">A</text>
  <text x="226" y="46" fill="#e2e8f0" font-size="15" font-family="monospace" font-weight="bold">B</text>
  <text x="266" y="166" fill="#e2e8f0" font-size="15" font-family="monospace" font-weight="bold">C</text>
  <text x="104" y="166" fill="#e2e8f0" font-size="15" font-family="monospace" font-weight="bold">D</text>
  <text x="177" y="97" fill="#f0abfc" font-size="13" font-family="monospace" font-weight="bold">O</text>
</svg>`;

const PROOF_SECTIONS = [
  {
    label: "א",
    prompt: "הוכח כי משולש AOB חופף למשולש COD.",
    answerType: "proof",
    correctAnswer: "ראה הוכחה מלאה",
    solutionSteps: [
      "AO = OC — אלכסוני מקבילית מחצים זה את זה",
      "BO = OD — אלכסוני מקבילית מחצים זה את זה",
      "זווית AOB = זווית COD — זוויות קודקוד שוות",
      "לכן: AOB ≅ COD — צ.ז.צ (SAS)",
    ],
    hints: [
      "מה ידוע על אלכסוני מקבילית?",
      "אילו זוויות שוות יש בין האלכסונים?",
      "איזה משפט חפיפה מתאים כאשר יש שני צלעות וזווית ביניהן?",
    ],
    points: 15,
    skillsTested: ["חפיפת משולשים", "תכונות מקבילית", "SAS"],
    proofMeta: {
      given: "ABCD מקבילית, O הוא חיתוך האלכסונים AC ו-BD",
      toProve: "משולש AOB ≅ משולש COD",
      diagramSvg: DIAGRAM_SVG,
    },
    proofSteps: [
      {
        stepIndex: 0,
        expectedClaim: "AO = OC",
        expectedReason: "אלכסוני מקבילית מחצים זה את זה",
        clueIfWrong: "מה קורה לאלכסונים של מקבילית בנקודת החיתוך?",
      },
      {
        stepIndex: 1,
        expectedClaim: "BO = OD",
        expectedReason: "אלכסוני מקבילית מחצים זה את זה",
        clueIfWrong: "אותו עיקרון חל גם על האלכסון השני.",
      },
      {
        stepIndex: 2,
        expectedClaim: "זווית AOB = זווית COD",
        expectedReason: "זוויות קודקוד שוות",
        clueIfWrong: "מהן הזוויות שנוצרות בין שני ישרים חותכים?",
      },
      {
        stepIndex: 3,
        expectedClaim: "משולש AOB ≅ משולש COD",
        expectedReason: "צ.ז.צ (SAS)",
        clueIfWrong: "יש שתי צלעות שוות וזווית ביניהן — איזה משפט חפיפה זה?",
      },
    ],
  },
];

export const seedGeometryProof = mutation({
  args: {},
  handler: async (ctx) => {
    // Find or create geometry topic
    const existingTopic = await ctx.db
      .query("topics")
      .filter((q) => q.eq(q.field("name"), "geometry"))
      .first();

    let topicId = existingTopic?._id;
    if (!topicId) {
      topicId = await ctx.db.insert("topics", {
        name: "geometry",
        nameHe: "גיאומטריה",
        order: 10,
        description: "הוכחות גיאומטריות, משפטי חפיפה ודמיון, זוויות ומשפטי עיגול",
        icon: "📐",
      });
    }

    // Find ALL compoundQuestions that contain a proof section with our specific tags
    // (tags array contains both "מקבילית" and "SAS")
    const allCompound = await ctx.db.query("compoundQuestions").collect();
    const existingProofQ = allCompound.find(
      (q) =>
        q.tags.includes("מקבילית") &&
        q.tags.includes("SAS") &&
        q.sections.some((s) => s.answerType === "proof")
    );

    if (existingProofQ) {
      // UPSERT: patch sections to include diagram and latest proofSteps
      await ctx.db.patch(existingProofQ._id, {
        sections: PROOF_SECTIONS,
        topicIds: [topicId],
      });
      return {
        message: "Geometry proof question updated with diagram",
        questionId: existingProofQ._id,
        topicId,
      };
    }

    // INSERT new question
    const questionId = await ctx.db.insert("compoundQuestions", {
      topicIds: [topicId],
      difficulty: 3,
      tags: ["מקבילית", "חפיפת משולשים", "SAS"],
      preamble: "בתרשים, ABCD הוא מקבילית. האלכסונים AC ו-BD נחתכים בנקודה O.",
      preambleParams: [],
      sections: PROOF_SECTIONS,
      fullSolution:
        "מכיוון ש-ABCD מקבילית, האלכסונים מחצים זה את זה: AO=OC, BO=OD. זוויות קודקוד AOB ו-COD שוות. לפי צ.ז.צ: AOB≅COD.",
    });

    return { message: "Geometry proof question seeded successfully", topicId, questionId };
  },
});
