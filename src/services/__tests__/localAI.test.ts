import { describe, it, expect } from "vitest";
import type { Message } from "../localAI";
import {
  estimateTokens,
  needsCompaction,
  heuristicSummary,
  heuristicAnalysis,
  getMockResponse,
} from "../localAI";

// ── Prompt Precision Tests ──

describe("System Prompts", () => {
  it("getMockResponse greeting never contains self-introduction", () => {
    const greetings = ["שלום", "היי", "אהלן", "בוקר טוב", "ערב טוב"];
    for (const g of greetings) {
      const resp = getMockResponse(g);
      expect(resp).not.toContain("אני ת'אורם");
      expect(resp).not.toContain("שלום, אני");
    }
  });

  it("getMockResponse never contains self-introduction even for generic input", () => {
    const inputs = ["מה זה סדרה?", "עזרה", "לא מבין", "סדרות"];
    for (const input of inputs) {
      const resp = getMockResponse(input);
      expect(resp).not.toContain("אני ת'אורם");
    }
  });

  it("getMockResponse returns Hebrew-only text", () => {
    const resp = getMockResponse("שלום");
    // Should not start with any English phrase
    expect(resp).not.toMatch(/^[A-Za-z]/);
  });

  it("getMockResponse handles long conversation gracefully", () => {
    const history: Message[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "model",
      content: `הודעה ${i}`,
    })) as Message[];
    const resp = getMockResponse("עוד שאלה", history);
    expect(resp).toBeTruthy();
    expect(resp.length).toBeGreaterThan(0);
  });
});

// ── Context Compaction Tests ──

describe("Context Compaction", () => {
  it("estimateTokens returns roughly 0.5x character count", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("הי")).toBe(1);
    expect(estimateTokens("שלום עולם")).toBe(5); // 9 chars → ceil(4.5) = 5
  });

  it("needsCompaction returns false for short history", () => {
    const history: Message[] = [
      { role: "user", content: "שאלה 1" },
      { role: "model", content: "תשובה 1" },
      { role: "user", content: "שאלה 2" },
      { role: "model", content: "תשובה 2" },
    ];
    expect(needsCompaction(history)).toBe(false);
  });

  it("needsCompaction returns false for exactly 4 user messages", () => {
    const history: Message[] = [
      { role: "user", content: "1" },
      { role: "model", content: "a" },
      { role: "user", content: "2" },
      { role: "model", content: "b" },
      { role: "user", content: "3" },
      { role: "model", content: "c" },
      { role: "user", content: "4" },
      { role: "model", content: "d" },
    ];
    expect(needsCompaction(history)).toBe(false);
  });

  it("needsCompaction returns true for 5+ user messages", () => {
    const history: Message[] = [
      { role: "user", content: "1" },
      { role: "model", content: "a" },
      { role: "user", content: "2" },
      { role: "model", content: "b" },
      { role: "user", content: "3" },
      { role: "model", content: "c" },
      { role: "user", content: "4" },
      { role: "model", content: "d" },
      { role: "user", content: "5" },
      { role: "model", content: "e" },
    ];
    expect(needsCompaction(history)).toBe(true);
  });

  it("needsCompaction ignores system messages in count", () => {
    const history: Message[] = [
      { role: "system", content: "instructions" },
      { role: "user", content: "1" },
      { role: "model", content: "a" },
      { role: "user", content: "2" },
      { role: "model", content: "b" },
    ];
    expect(needsCompaction(history)).toBe(false);
  });

  it("heuristicSummary generates bullet points from user messages", () => {
    const messages: Message[] = [
      { role: "user", content: "מה זה סדרה חשבונית?" },
      { role: "model", content: "סדרה חשבונית היא סדרה עם הפרש קבוע." },
      { role: "user", content: "איך מוצאים את האיבר הכללי?" },
      { role: "model", content: "השתמש בנוסחה aₙ = a₁ + (n−1)d" },
    ];
    const summary = heuristicSummary(messages);
    expect(summary).toContain("שאלת התלמיד");
    expect(summary).toContain("סדרה חשבונית");
    expect(summary).toContain("תשובה אחרונה של המורה");
  });

  it("heuristicSummary truncates long messages", () => {
    const longMessage = "א".repeat(100);
    const messages: Message[] = [
      { role: "user", content: longMessage },
    ];
    const summary = heuristicSummary(messages);
    expect(summary).toContain("...");
    expect(summary.length).toBeLessThan(longMessage.length);
  });

  it("heuristicSummary handles empty input", () => {
    const summary = heuristicSummary([]);
    expect(summary).toBe("");
  });
});

// ── Heuristic Analysis Tests ──

describe("Heuristic Analysis", () => {
  it("detects frustration from keywords", () => {
    const messages: Message[] = [
      { role: "user", content: "אני לא מבין את זה בכלל" },
      { role: "model", content: "בוא ננסה צעד אחרי צעד" },
    ];
    const metrics = heuristicAnalysis(messages);
    expect(metrics.sentiment).toBe("frustrated");
    expect(metrics.confusionScore).toBe(80);
  });

  it("returns neutral for normal conversation", () => {
    const messages: Message[] = [
      { role: "user", content: "מה הנוסחה של סדרה חשבונית?" },
      { role: "model", content: "aₙ = a₁ + (n−1)d" },
    ];
    const metrics = heuristicAnalysis(messages);
    expect(metrics.sentiment).toBe("neutral");
  });

  it("calculates independence ratio correctly", () => {
    const messages: Message[] = [
      { role: "user", content: "ניסיתי לפתור ויצא לי 14" },
      { role: "model", content: "נכון!" },
      { role: "user", content: "עכשיו אני רוצה לעבור לשאלה הבאה" },
      { role: "model", content: "יופי" },
    ];
    const metrics = heuristicAnalysis(messages);
    // 1 out of 2 user messages has independence keywords
    expect(metrics.independenceRatio).toBe(0.5);
  });

  it("returns safe defaults for empty messages", () => {
    const metrics = heuristicAnalysis([]);
    expect(metrics.questionsAsked).toBe(0);
    expect(metrics.avgResponseLength).toBe(0);
    expect(metrics.sentiment).toBe("neutral");
    expect(metrics.confusionScore).toBe(20);
    expect(metrics.independenceRatio).toBe(0);
  });

  it("caps engagement score at 100", () => {
    const messages: Message[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" as const : "model" as const,
      content: `הודעה ${i}`,
    }));
    const metrics = heuristicAnalysis(messages);
    expect(metrics.engagementScore).toBeLessThanOrEqual(100);
  });

  it("counts only user messages for questionsAsked", () => {
    const messages: Message[] = [
      { role: "user", content: "שאלה?" },
      { role: "model", content: "תשובה" },
      { role: "user", content: "עוד שאלה?" },
      { role: "model", content: "תשובה" },
      { role: "system", content: "הוראות" },
    ];
    const metrics = heuristicAnalysis(messages);
    expect(metrics.questionsAsked).toBe(2); // only user messages counted
  });
});
