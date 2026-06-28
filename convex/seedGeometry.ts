import { mutation } from "./_generated/server";

export const seedGeometryProof = mutation({
  args: {},
  handler: async (ctx) => {
    // Find or create geometry topic
    const existing = await ctx.db
      .query("topics")
      .filter((q) => q.eq(q.field("name"), "geometry"))
      .first();

    let topicId = existing?._id;
    if (!topicId) {
      topicId = await ctx.db.insert("topics", {
        name: "geometry",
        nameHe: "גיאומטריה",
        order: 10,
        description: "הוכחות גיאומטריות, משפטי חפיפה ודמיון, זוויות ומשפטי עיגול",
        icon: "📐",
      });
    }

    // Check if a proof question already exists (avoid duplicates)
    const existingQ = await ctx.db
      .query("compoundQuestions")
      .filter((q) => q.eq(q.field("difficulty"), 3))
      .first();

    // Only insert if no proof question exists yet for this specific demo
    const alreadyHasProof = existingQ?.sections?.some(
      (s) => s.answerType === "proof" && s.label === "א"
    );
    if (alreadyHasProof) {
      return { message: "Geometry proof question already seeded", topicId };
    }

    const questionId = await ctx.db.insert("compoundQuestions", {
      topicIds: [topicId],
      difficulty: 3,
      tags: ["מקבילית", "חפיפת משולשים", "SAS"],
      preamble: "בתרשים, ABCD הוא מקבילית. האלכסונים AC ו-BD נחתכים בנקודה O.",
      preambleParams: [],
      sections: [
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
            diagramSvg: `<svg viewBox="0 0 340 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
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
</svg>`,
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
      ],
      fullSolution:
        "מכיוון ש-ABCD מקבילית, האלכסונים מחצים זה את זה: AO=OC, BO=OD. זוויות קודקוד AOB ו-COD שוות. לפי צ.ז.צ: AOB≅COD.",
    });

    return { message: "Geometry proof question seeded successfully", topicId, questionId };
  },
});
