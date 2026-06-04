import { describe, it, expect, vi } from "vitest";
import { evaluateStudentLevel, resolveSuggestion } from "./levels";

describe("Convex levels queries and mutations", () => {
  describe("evaluateStudentLevel", () => {
    it("should suggest level upgrade when student meets topic mastery and homework score criteria", async () => {
      const studentId = "student-789" as any;

      const mockStudent = {
        _id: studentId,
        name: "רן לוי",
        streak: 4,
        level: 1, // current level is 1
      };

      // Meets Level 2 Criteria (masteryScore >= 40 in 2+ topics)
      // Mastery scores: 45 and 50 (two topics >= 40)
      const mockPowerMap = {
        studentId,
        topicMastery: [
          { topicId: "t1", topicName: "סדרות", masteryScore: 45, avgAccuracy: 3.5 },
          { topicId: "t2", topicName: "הסתברות", masteryScore: 50, avgAccuracy: 4.0 },
        ],
      };

      // Assigned homework questions (average score 85)
      const mockAssignedQuestions = [
        { status: "submitted", score: 80 },
        { status: "submitted", score: 90 },
      ];

      const mockInsert = vi.fn().mockResolvedValue("suggestion-new-id");

      const mockCtx: any = {
        db: {
          get: vi.fn().mockImplementation(async (id) => {
            if (id === studentId) return mockStudent;
            return null;
          }),
          insert: mockInsert,
          query: vi.fn().mockImplementation((tableName) => {
            if (tableName === "studentPowerMap") {
              return {
                withIndex: vi.fn().mockReturnThis(),
                first: vi.fn().mockResolvedValue(mockPowerMap),
              };
            }
            if (tableName === "assignedQuestions") {
              return {
                withIndex: vi.fn().mockReturnThis(),
                collect: vi.fn().mockResolvedValue(mockAssignedQuestions),
              };
            }
            if (tableName === "levelSuggestions") {
              return {
                withIndex: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                first: vi.fn().mockResolvedValue(null), // no existing suggestion
              };
            }
            return { collect: vi.fn().mockResolvedValue([]) };
          }),
        },
      };

      await evaluateStudentLevel._handler(mockCtx, { studentId });

      // Should insert a new level suggestion with status pending and suggestedLevel = 2
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledWith(
        "levelSuggestions",
        expect.objectContaining({
          studentId,
          currentLevel: 1,
          suggestedLevel: 2,
          status: "pending",
        })
      );
    });
  });

  describe("resolveSuggestion", () => {
    it("should patch suggestion status and update student's level when approved", async () => {
      const suggestionId = "suggestion-111" as any;
      const studentId = "student-789" as any;

      const mockSuggestion = {
        _id: suggestionId,
        studentId,
        currentLevel: 1,
        suggestedLevel: 2,
        status: "pending",
      };

      const mockPatch = vi.fn().mockResolvedValue(true);

      const mockCtx: any = {
        db: {
          get: vi.fn().mockImplementation(async (id) => {
            if (id === suggestionId) return mockSuggestion;
            return null;
          }),
          patch: mockPatch,
        },
      };

      await resolveSuggestion._handler(mockCtx, {
        suggestionId,
        action: "approved",
        resolvedBy: "המורה שרה",
      });

      // Patch should update suggestion status to approved
      expect(mockPatch).toHaveBeenCalledWith(
        suggestionId,
        expect.objectContaining({
          status: "approved",
          resolvedBy: "המורה שרה",
        })
      );

      // Patch should update student's level to suggested level 2
      expect(mockPatch).toHaveBeenCalledWith(
        studentId,
        expect.objectContaining({
          level: 2,
        })
      );
    });
  });
});
