import { describe, it, expect, vi } from "vitest";
import { getClassroomHeatmap, getLiveAlerts } from "./classroom";

describe("Convex classroom queries", () => {
  describe("getClassroomHeatmap", () => {
    it("should return student heatmap status 'red' if accuracy is low", async () => {
      const studentId = "student-123" as any;
      const classroomId = "classroom-456" as any;

      const mockStudent = {
        _id: studentId,
        name: "יוסי כהן",
        classroomId,
        avatarColor: "blue",
        streak: 2,
        level: 1,
      };

      // 5 attempts, 1 correct (20% ratio)
      const mockAttempts = [
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
      ];

      const mockCtx: any = {
        db: {
          get: vi.fn().mockResolvedValue(null),
          query: vi.fn().mockImplementation((tableName) => {
            if (tableName === "students") {
              return {
                withIndex: vi.fn().mockReturnThis(),
                collect: vi.fn().mockResolvedValue([mockStudent]),
              };
            }
            if (tableName === "attempts") {
              return {
                withIndex: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                take: vi.fn().mockResolvedValue(mockAttempts),
              };
            }
            if (tableName === "hintRequests") {
              return {
                withIndex: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                first: vi.fn().mockResolvedValue(null),
              };
            }
            return { collect: vi.fn().mockResolvedValue([]) };
          }),
        },
      };

      const result = await getClassroomHeatmap._handler(mockCtx, { classroomId });
      expect(result).toHaveLength(1);
      expect(result[0].student.name).toBe("יוסי כהן");
      expect(result[0].status).toBe("red"); // low ratio < 0.4
    });

    it("should return 'green' status if accuracy is high", async () => {
      const studentId = "student-123" as any;
      const classroomId = "classroom-456" as any;

      const mockStudent = {
        _id: studentId,
        name: "דניאלה לוי",
        classroomId,
        avatarColor: "green",
        streak: 5,
        level: 2,
      };

      // 5 attempts, 4 correct (80% ratio)
      const mockAttempts = [
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: true },
      ];

      const mockCtx: any = {
        db: {
          get: vi.fn().mockResolvedValue({ name: "סדרות" }),
          query: vi.fn().mockImplementation((tableName) => {
            if (tableName === "students") {
              return {
                withIndex: vi.fn().mockReturnThis(),
                collect: vi.fn().mockResolvedValue([mockStudent]),
              };
            }
            if (tableName === "attempts") {
              return {
                withIndex: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                take: vi.fn().mockResolvedValue(mockAttempts),
              };
            }
            if (tableName === "hintRequests") {
              return {
                withIndex: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                first: vi.fn().mockResolvedValue(null),
              };
            }
            return { collect: vi.fn().mockResolvedValue([]) };
          }),
        },
      };

      const result = await getClassroomHeatmap._handler(mockCtx, { classroomId });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("green");
    });
  });

  describe("getLiveAlerts", () => {
    it("should group recent hints and sort them by student count", async () => {
      const classroomId = "classroom-456" as any;
      const student1Id = "student-1" as any;
      const student2Id = "student-2" as any;
      const questionId = "question-999" as any;
      const topicId = "topic-777" as any;

      const mockStudents = [
        { _id: student1Id, name: "תלמיד א׳", classroomId },
        { _id: student2Id, name: "תלמיד ב׳", classroomId },
      ];

      const fiveMinAgo = Date.now() - 2 * 60 * 1000; // 2 mins ago (within 5 mins threshold)
      const mockHintRequests = [
        { studentId: student1Id, questionId, _creationTime: fiveMinAgo },
        { studentId: student2Id, questionId, _creationTime: fiveMinAgo },
      ];

      const mockQuestion = {
        _id: questionId,
        stem: "מה ערך הנגזרת של $f(x)=x^2$ בנקודה $x=3$?",
        topicId,
      };

      const mockTopic = {
        _id: topicId,
        name: "חדו\"א - נגזרות",
      };

      const mockCtx: any = {
        db: {
          get: vi.fn().mockImplementation(async (id) => {
            if (id === questionId) return mockQuestion;
            if (id === topicId) return mockTopic;
            return null;
          }),
          query: vi.fn().mockImplementation((tableName) => {
            if (tableName === "students") {
              return {
                withIndex: vi.fn().mockReturnThis(),
                collect: vi.fn().mockResolvedValue(mockStudents),
              };
            }
            if (tableName === "hintRequests") {
              return {
                order: vi.fn().mockReturnThis(),
                take: vi.fn().mockResolvedValue(mockHintRequests),
              };
            }
            return { collect: vi.fn().mockResolvedValue([]) };
          }),
        },
      };

      const alerts = await getLiveAlerts._handler(mockCtx, { classroomId });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].questionId).toBe(questionId);
      expect(alerts[0].studentNames).toContain("תלמיד א׳");
      expect(alerts[0].studentNames).toContain("תלמיד ב׳");
      expect(alerts[0].count).toBe(2);
      expect(alerts[0].questionStem).toContain("מה ערך הנגזרת");
      expect(alerts[0].topicName).toBe("חדו\"א - נגזרות");
    });
  });
});
