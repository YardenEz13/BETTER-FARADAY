import { describe, it, expect, vi } from "vitest";
import { duplicateHomework } from "./homework";

// The failure this guards against is silent: drop pinnedQuestionIds on the copy
// and "שלח שוב" still succeeds — it just hands out freshly generated questions
// instead of the חוברת the teacher built, which is the whole point of re-sending.
describe("duplicateHomework", () => {
  const baseHw = {
    _id: "hw-1",
    classroomId: "class-1",
    title: "גיאומטריה",
    topicIds: ["topic-1", "topic-2"],
    teacherNotes: "שימו לב לסעיף ג",
    questionCount: 5,
    createdAt: 1_000,
    deadline: 2_000,
    status: "active",
    pinnedQuestionIds: ["q-1", "q-2"],
    pinnedCompoundIds: ["cq-1"],
    studentIds: ["s-1", "s-2"],
  };

  const mockCtx = (hw: unknown) => ({
    db: {
      get: vi.fn().mockResolvedValue(hw),
      insert: vi.fn().mockResolvedValue("hw-2"),
    },
    scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
  });

  it("carries the pinned חוברת questions and target students onto the new row", async () => {
    const ctx = mockCtx(baseHw);

    await (duplicateHomework as any)._handler(ctx, {
      homeworkId: "hw-1",
      deadline: 9_999,
    });

    const inserted = ctx.db.insert.mock.calls[0][1];
    expect(inserted.pinnedQuestionIds).toEqual(["q-1", "q-2"]);
    expect(inserted.pinnedCompoundIds).toEqual(["cq-1"]);
    expect(inserted.studentIds).toEqual(["s-1", "s-2"]);
    expect(inserted.topicIds).toEqual(["topic-1", "topic-2"]);
    expect(inserted.questionCount).toBe(5);
    expect(inserted.title).toBe("גיאומטריה");
    // New round: fresh deadline, live immediately.
    expect(inserted.deadline).toBe(9_999);
    expect(inserted.status).toBe("active");
    // And the fan-out actually runs, or no student ever sees it.
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });

  it("leaves the original row untouched", async () => {
    const ctx = mockCtx(baseHw);
    await (duplicateHomework as any)._handler(ctx, { homeworkId: "hw-1", deadline: 9_999 });
    expect((ctx.db as any).patch).toBeUndefined();
    expect(baseHw.deadline).toBe(2_000);
    expect(baseHw.status).toBe("active");
  });

  it("refuses a draft — it was never given out, so there is no 'again'", async () => {
    const ctx = mockCtx({ ...baseHw, status: "draft" });
    await expect(
      (duplicateHomework as any)._handler(ctx, { homeworkId: "hw-1", deadline: 9_999 })
    ).rejects.toThrow();
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("throws when the homework is gone", async () => {
    const ctx = mockCtx(null);
    await expect(
      (duplicateHomework as any)._handler(ctx, { homeworkId: "hw-1", deadline: 9_999 })
    ).rejects.toThrow("Homework not found");
  });
});
