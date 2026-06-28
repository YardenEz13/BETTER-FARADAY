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
