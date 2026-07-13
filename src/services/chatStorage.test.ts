import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  saveActiveSession,
  getActiveSession,
  clearActiveSession,
  saveMessages,
  getMessages,
  clearMessages,
  debouncedSaveMessages,
  flushAllPending,
} from "./chatStorage";

describe("chatStorage (IndexedDB)", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  describe("Active Sessions", () => {
    it("should save and retrieve active sessions", async () => {
      const sessionData = {
        chatId: "chat-123",
        studentId: "student-456",
        agentType: "practice",
        context: "math question context",
        topicName: "סדרות",
        startedAt: Date.now(),
      };

      await saveActiveSession(sessionData);

      const retrieved = await getActiveSession("student-456", "practice");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.chatId).toBe("chat-123");
      expect(retrieved?.context).toBe("math question context");
      expect(retrieved?.key).toBe("student-456:practice");
    });

    it("should return null for non-existent sessions", async () => {
      const session = await getActiveSession("no-student", "practice");
      expect(session).toBeNull();
    });

    it("should clear active sessions", async () => {
      const sessionData = {
        chatId: "chat-999",
        studentId: "student-xyz",
        agentType: "homework",
        context: "homework context",
        startedAt: Date.now(),
      };

      await saveActiveSession(sessionData);
      let session = await getActiveSession("student-xyz", "homework");
      expect(session).not.toBeNull();

      await clearActiveSession("student-xyz", "homework");
      session = await getActiveSession("student-xyz", "homework");
      expect(session).toBeNull();
    });
  });

  describe("Message Persistence", () => {
    it("should save and retrieve message arrays", async () => {
      const messages = [
        { role: "system" as const, content: "system prompt" },
        { role: "user" as const, content: "hello" },
        { role: "model" as const, content: "hi there" },
      ];

      await saveMessages("chat-abc", messages);

      const retrieved = await getMessages("chat-abc");
      expect(retrieved).toHaveLength(3);
      expect(retrieved[1].content).toBe("hello");
      expect(retrieved[2].role).toBe("model");
    });

    it("should return empty array for non-existent chats", async () => {
      const messages = await getMessages("missing-chat");
      expect(messages).toEqual([]);
    });

    it("should clear saved messages", async () => {
      await saveMessages("chat-to-clear", [{ role: "user", content: "test" }]);
      let messages = await getMessages("chat-to-clear");
      expect(messages).toHaveLength(1);

      await clearMessages("chat-to-clear");
      messages = await getMessages("chat-to-clear");
      expect(messages).toEqual([]);
    });
  });

  describe("Debounced & Flush Saves", () => {
    it("should debounce messages saving", async () => {
      const messages = [{ role: "user" as const, content: "debounced msg" }];

      // Use a short delay of 10ms for testing
      debouncedSaveMessages("chat-debounced", messages, 10);

      // Verify not written immediately
      expect(await getMessages("chat-debounced")).toEqual([]);

      // Wait 30ms for the debounce timer to fire and complete the write
      await new Promise(resolve => setTimeout(resolve, 30));

      const saved = await getMessages("chat-debounced");
      expect(saved).toHaveLength(1);
      expect(saved[0].content).toBe("debounced msg");
    });

    it("should immediately write pending saves on flushAllPending", async () => {
      const messages = [{ role: "user" as const, content: "flushed msg" }];
      debouncedSaveMessages("chat-flushed", messages, 1000);

      expect(await getMessages("chat-flushed")).toEqual([]);

      flushAllPending();

      // Wait a short moment for IndexedDB write transaction to complete
      await new Promise(resolve => setTimeout(resolve, 25));

      const saved = await getMessages("chat-flushed");
      expect(saved).toHaveLength(1);
      expect(saved[0].content).toBe("flushed msg");
    });
  });
});
