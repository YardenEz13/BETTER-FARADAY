import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatAnalysisView } from "./ChatAnalysisView";

/**
 * Both breakpoint layouts are in the DOM at once (Tailwind lg:hidden is CSS
 * only, and jsdom applies no stylesheet), so every assertion here counts
 * matches rather than expecting exactly one.
 *
 * The verdict gate is the whole point of this screen: it must refuse to state a
 * conclusion it cannot evidence. These cover the three states — thin (no
 * verdict), hunch (labelled השערה) and full — plus the claim→round link, which
 * is what makes the analysis checkable rather than merely readable.
 */

const mockCreateHomework = vi.fn().mockResolvedValue("hw-1");
let queryResults: Record<string, unknown> = {};

vi.mock("convex/react", () => ({
  useMutation: () => mockCreateHomework,
  useQuery: (name: string) => queryResults[name],
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    aiChat: { getChatMessages: "getChatMessages" },
    sessionBriefs: { getBriefForChat: "getBriefForChat", getClassGapPicture: "getClassGapPicture" },
    homework: { createHomework: "createHomework" },
  },
}));

const userMsgs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ _id: `m${i}`, role: "user", content: `הודעה ${i}` }));

const chat = {
  _id: "chat-1",
  studentId: "stu-1",
  classroomId: "cls-1",
  topicId: "top-1",
  studentName: "נועה",
  title: "נקודות קיצון",
  agentType: "practice",
  startedAt: 0,
  endedAt: 42 * 60_000,
  messageCount: 47,
};

const round = (i: number, autonomy: number, summary: string) => ({
  sessionIndex: i,
  messageCount: 8,
  durationMs: 8 * 60_000,
  summary,
  triggerReason: "message_count",
  autonomyLevel: autonomy,
});

const fullBrief = {
  keyInsight: "נועה יודעת לגזור — היא נשברת כשיש פרמטר במכנה.",
  autonomyLevel: 3,
  solutionAccuracy: 4,
  missingConcepts: ["פרמטר במכנה"],
  recommendedAction: "תרגיל אחד עם פרמטר על הלוח",
  nextSteps: ["לפתוח מסבב 4"],
  selfAssessment: "כשיש אות אני מתבלבלת",
  partialBriefs: [
    round(0, 4, "ניסחה את השאלה מחדש בעצמה"),
    round(1, 3, "טעות בכלל המנה, תיקנה לבד"),
    round(2, 1, "ביקשה פתרון מלא פעמיים"),
    round(3, 5, "פתרה סעיף שלם לבד"),
    round(4, 2, "נטשה את הסעיף עם הפרמטר"),
  ],
};

beforeEach(() => {
  mockCreateHomework.mockClear();
  queryResults = {
    getChatMessages: userMsgs(10),
    getBriefForChat: fullBrief,
    getClassGapPicture: { concepts: [], classmates: [], total: 0 },
  };
});

describe("ChatAnalysisView", () => {
  it("refuses a verdict when the conversation is too thin to evidence one", () => {
    queryResults.getChatMessages = userMsgs(2);
    queryResults.getBriefForChat = null;
    render(<ChatAnalysisView chat={{ ...chat, messageCount: 4 }} onBack={vi.fn()} />);

    expect(screen.getAllByText(/אין מספיק נתונים למסקנה/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/מסקנת פרדיי/)).toHaveLength(0);
  });

  it("labels a thinly-evidenced read as a hunch, with how to verify it", () => {
    queryResults.getChatMessages = userMsgs(3);
    queryResults.getBriefForChat = { ...fullBrief, partialBriefs: [round(0, 3, "סבב יחיד")] };
    render(<ChatAnalysisView chat={chat} onBack={vi.fn()} />);

    expect(screen.getAllByText("השערה").length).toBeGreaterThan(0);
    expect(screen.getAllByText("איך לאמת").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ביטחון נמוך/).length).toBeGreaterThan(0);
  });

  it("states the verdict and flags the break round when the evidence supports it", () => {
    render(<ChatAnalysisView chat={chat} onBack={vi.fn()} />);

    expect(screen.getAllByText(fullBrief.keyInsight).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("השערה")).toHaveLength(0);
    // round 3 (index 2) is the 1/5 low — it is the break point, and its low
    // autonomy is what earns the "worth a look" flag in the header.
    expect(screen.getAllByText("עצמאות 1/5").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/נקודת השבירה/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("שווה מבט").length).toBeGreaterThan(0);
  });

  it("assigns targeted practice to just this student", async () => {
    render(<ChatAnalysisView chat={chat} onBack={vi.fn()} />);
    fireEvent.click(screen.getAllByText(/הקצה תרגול/)[0]);

    expect(mockCreateHomework).toHaveBeenCalledTimes(1);
    expect(mockCreateHomework.mock.calls[0][0]).toMatchObject({
      classroomId: "cls-1",
      studentIds: ["stu-1"],
      questionCount: 4,
    });
  });

  it("does not offer the assign CTA when the chat has no topic to draw from", () => {
    render(<ChatAnalysisView chat={{ ...chat, topicId: undefined }} onBack={vi.fn()} />);
    expect(screen.queryAllByText(/הקצה תרגול/)).toHaveLength(0);
    expect(screen.getAllByText(/לא משויך נושא/).length).toBeGreaterThan(0);
  });
});
