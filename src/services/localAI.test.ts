import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock environment variables. Gemini now goes through the Convex httpAction
// proxy on `.convex.site`, so the client only needs the Convex URL.
vi.stubEnv("VITE_GEMINI_API_KEY", "test-api-key");
vi.stubEnv("VITE_CONVEX_URL", "https://test.convex.cloud");

const mockStream = {
  getReader() {
    let callCount = 0;
    const encoder = new TextEncoder();
    return {
      async read() {
        if (callCount === 0) {
          callCount++;
          const line1 = 'data: {"candidates": [{"content": {"parts": [{"text": "הנוסחה "}]}}]}\n';
          const line2 = 'data: {"candidates": [{"content": {"parts": [{"text": "היא $T=\\\\frac{2\\\\pi}{k}$. מה הוא $k$?"}]}}]}\n';
          return { done: false, value: encoder.encode(line1 + line2) };
        }
        return { done: true, value: undefined };
      }
    };
  }
};

const mockFetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes("/gemini-stream")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      body: mockStream,
    });
  } else if (url.includes("/gemini-generate")) {
    const responseJson = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  sentiment: "neutral",
                  confusionScore: 40,
                  engagementScore: 70,
                  progressionSignal: "improving",
                  questionDepth: 2,
                  independenceRatio: 0.5,
                  conceptMentions: ["סדרות"],
                  keyStrugglePoints: ["לא מבין מושג d"],
                  topicsCovered: ["סדרות"],
                  missingKnowledge: ["הפרש סדרה"],
                  teacherActionItem: "לעבוד על הבסיס",
                  gemmaAnalysisSummary: "התקדמות טובה",
                  approach: "עבודה עצמית חלקית",
                  frictionPoints: [],
                  autonomyLevel: 3,
                  solutionAccuracy: 4,
                  keyInsight: "הבין בסוף",
                  nextSteps: ["תרגיל הבא"]
                })
              }
            ]
          }
        }
      ]
    };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseJson)
    });
  }
  return Promise.reject(new Error("Unknown URL"));
});

vi.stubGlobal("fetch", mockFetch);

import {
  stripThinkBlock,
  violatesSocraticRules,
  needsCompaction,
  compactHistory,
  heuristicSummary,
  heuristicAnalysis,
  getMockResponse,
  getAIStatus,
  isLocalAIAvailable,
  createSession,
  destroySession,
  streamMessage,
  analyzeConversation,
  generateCompositeBrief,
} from "./localAI";

describe("localAI service", () => {
  beforeEach(() => {
    destroySession();
  });

  describe("stripThinkBlock", () => {
    it("should strip closed think blocks", () => {
      const input = "<think>\nThinking about the problem...\n</think>\nHere is the answer.";
      expect(stripThinkBlock(input)).toBe("Here is the answer.");
    });

    it("should strip trailing unclosed think blocks", () => {
      const input = "Here is the answer. <think>Unfinished thoughts...";
      expect(stripThinkBlock(input)).toBe("Here is the answer.");
    });

    it("should handle empty or normal inputs", () => {
      expect(stripThinkBlock("Normal text")).toBe("Normal text");
      expect(stripThinkBlock("")).toBe("");
    });
  });

  describe("violatesSocraticRules", () => {
    it("should flag active operations with numbers other than 1, 2, 4", () => {
      expect(violatesSocraticRules("הנוסחה היא $a + 2 = b$")).toBe(false);
      expect(violatesSocraticRules("הנוסחה היא $3 + 5 = 8$")).toBe(true);
      expect(violatesSocraticRules("נבדוק $x^2 - 4x + 1$")).toBe(false);
      expect(violatesSocraticRules("נבדוק $x^2 - 5x + 6$")).toBe(true);
    });

    it("should allow math block contents if they are part of the question context", async () => {
      const mathText = "האם $3 + 5$ נכון?";
      expect(violatesSocraticRules(mathText)).toBe(true);

      createSession("practice", "תרגיל: $3 + 5$");
      expect(violatesSocraticRules(mathText)).toBe(false);
    });

    it("should flag explicit assignments with a number across the text", () => {
      expect(violatesSocraticRules("התשובה היא x = 5")).toBe(true);
      expect(violatesSocraticRules("x = -12")).toBe(true);
      expect(violatesSocraticRules("x = a")).toBe(false);
    });

    it("should flag fraction answers (e.g. 17/20)", () => {
      expect(violatesSocraticRules("ההסתברות היא 17/20")).toBe(true);
      expect(violatesSocraticRules("ההסתברות היא 6/36")).toBe(true);
      expect(violatesSocraticRules("השיפוע הוא 3/4")).toBe(true);
      expect(violatesSocraticRules("הנוסחה היא a/b")).toBe(false);
    });
  });

  describe("needsCompaction", () => {
    it("should compaction-trigger only when user messages exceed 4", () => {
      const historyShort = [
        { role: "user" as const, content: "hi" },
        { role: "model" as const, content: "hello" },
        { role: "user" as const, content: "question" },
      ];
      expect(needsCompaction(historyShort)).toBe(false);

      const historyLong = [
        { role: "user" as const, content: "1" },
        { role: "model" as const, content: "a" },
        { role: "user" as const, content: "2" },
        { role: "model" as const, content: "b" },
        { role: "user" as const, content: "3" },
        { role: "model" as const, content: "c" },
        { role: "user" as const, content: "4" },
        { role: "model" as const, content: "d" },
        { role: "user" as const, content: "5" },
      ];
      expect(needsCompaction(historyLong)).toBe(true);
    });
  });

  describe("heuristicSummary & compactHistory", () => {
    it("should build heuristic summary from conversation history", () => {
      const history = [
        { role: "user" as const, content: "איך מוצאים נקודות קיצון?" },
        { role: "model" as const, content: "גוזרים ומשווים לאפס." },
      ];
      const summary = heuristicSummary(history);
      expect(summary).toContain("שאלת התלמיד: איך מוצאים נקודות קיצון?");
      expect(summary).toContain("תשובה אחרונה: גוזרים ומשווים לאפס.");
    });

    it("should compact history when needed and prepend system summary", async () => {
      const history = [
        { role: "user" as const, content: "user msg 1" },
        { role: "model" as const, content: "model msg 1" },
        { role: "user" as const, content: "user msg 2" },
        { role: "model" as const, content: "model msg 2" },
        { role: "user" as const, content: "user msg 3" },
        { role: "model" as const, content: "model msg 3" },
        { role: "user" as const, content: "user msg 4" },
        { role: "model" as const, content: "model msg 4" },
        { role: "user" as const, content: "user msg 5" },
        { role: "model" as const, content: "model msg 5" },
      ];
      const compacted = await compactHistory(history);
      expect(compacted[0].role).toBe("system");
      expect(compacted[0].content).toContain("[סיכום שיחה קודמת]:");
      expect(compacted.length).toBe(5);
    });
  });

  describe("heuristicAnalysis", () => {
    it("should detect math topics based on Hebrew keywords", () => {
      const history = [
        { role: "user" as const, content: "נתונה לי סדרה חשבונית וצריך למצוא הפרש" },
      ];
      const analysis = heuristicAnalysis(history);
      expect(analysis.topicsCovered).toContain("סדרות");
    });

    it("should identify struggle points and sentiment", () => {
      const history = [
        { role: "user" as const, content: "אני לא מבין שום דבר, קשה לי מאוד" },
      ];
      const analysis = heuristicAnalysis(history);
      expect(analysis.sentiment).toBe("frustrated");
      expect(analysis.keyStrugglePoints).toContain("ביטא תסכול או בלבול");
      expect(analysis.confusionScore).toBe(80);
    });

    it("should identify missing knowledge", () => {
      const history = [
        { role: "user" as const, content: "מה זה נוסחה של סכום סדרה חשבונית?" },
      ];
      const analysis = heuristicAnalysis(history);
      expect(analysis.missingKnowledge).toContain("לא מכיר את הנוסחה הרלוונטית");
    });
  });

  describe("getMockResponse", () => {
    it("should return greeting fallback in Hebrew", () => {
      const resp = getMockResponse("היי, שלום");
      expect(resp).toContain("איך אפשר לעזור?");
    });

    it("should return explanation tips on struggle queries", () => {
      const resp = getMockResponse("אני לא מבין, נתקעתי");
      expect(resp).toContain("נסה לפרק את השאלה לחלקים");
    });

    it("should return series guidance on topic questions", () => {
      const resp = getMockResponse("סדרה הנדסית");
      expect(resp).toContain("בסדרות:");
    });
  });

  describe("model status", () => {
    // The tutor is a server-side Gemini call, so readiness is purely "is the
    // Convex proxy URL configured" — it does not depend on session state.
    it("is ready whenever the proxy URL is configured", async () => {
      expect(getAIStatus()).toBe("ready");
      await expect(isLocalAIAvailable()).resolves.toBe(true);
    });

    it("stays ready across session create/destroy", async () => {
      createSession("practice");
      expect(getAIStatus()).toBe("ready");
      destroySession();
      expect(getAIStatus()).toBe("ready");
    });
  });

  describe("streamMessage", () => {
    it("should parse SSE streams and call onChunk", async () => {
      createSession("practice");
      const chunks: string[] = [];
      const result = await streamMessage("עזרה", (chunk) => {
        chunks.push(chunk);
      });
      expect(chunks.length).toBeGreaterThan(0);
      expect(result).toContain("T=\\frac{2\\pi}{k}");
    });
  });

  describe("analyzeConversation & generateCompositeBrief", () => {
    it("should call Gemini and return parsed analytics", async () => {
      createSession("practice");
      const metrics = await analyzeConversation([
        { role: "user", content: "מהי סדרה חשבונית?" }
      ]);
      expect(metrics.topicsCovered).toContain("סדרות");
      expect(metrics.confusionScore).toBe(40);
    });

    it("should generate a composite brief via Gemini", async () => {
      createSession("practice");
      const brief = await generateCompositeBrief(
        [],
        [{ role: "user", content: "ניסיתי לפתור" }],
        "הרגשתי טוב"
      );
      expect(brief.autonomyLevel).toBe(3);
    });
  });
});
