import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  queueMessage,
  getPendingMessages,
  clearPendingMessages,
  isOnline,
  onOnline,
} from "./offlineQueue";

describe("offlineQueue (IndexedDB & Network Status)", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    // Set network to online by default
    if ((globalThis as any).setOnline) {
      (globalThis as any).setOnline(true);
    }
  });

  describe("Queue Persistence", () => {
    it("should queue messages and retrieve them", async () => {
      const msg = {
        chatId: "chat-xyz",
        role: "user",
        content: "offline message",
        timestamp: Date.now(),
      };

      await queueMessage(msg);

      const pending = await getPendingMessages();
      expect(pending).toHaveLength(1);
      expect(pending[0].chatId).toBe("chat-xyz");
      expect(pending[0].content).toBe("offline message");
      expect(pending[0].id).toBeDefined(); // autoIncrement key
    });

    it("should retrieve empty queue if nothing is queued", async () => {
      const pending = await getPendingMessages();
      expect(pending).toEqual([]);
    });

    it("should clear the queue completely", async () => {
      await queueMessage({
        chatId: "chat-xyz",
        role: "user",
        content: "msg 1",
        timestamp: Date.now(),
      });
      await queueMessage({
        chatId: "chat-xyz",
        role: "model",
        content: "msg 2",
        timestamp: Date.now(),
      });

      let pending = await getPendingMessages();
      expect(pending).toHaveLength(2);

      await clearPendingMessages();
      pending = await getPendingMessages();
      expect(pending).toEqual([]);
    });
  });

  describe("Network Status Listeners", () => {
    it("should check online status accurately", () => {
      expect(isOnline()).toBe(true);

      if ((globalThis as any).setOnline) {
        (globalThis as any).setOnline(false);
        expect(isOnline()).toBe(false);
      }
    });

    it("should trigger callback when switching to online state", () => {
      if (!(globalThis as any).setOnline) return;

      (globalThis as any).setOnline(false);
      
      const callback = vi.fn();
      const unsubscribe = onOnline(callback);

      expect(callback).not.toHaveBeenCalled();

      // Toggle to online, which fires the online window event
      (globalThis as any).setOnline(true);

      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
    });
  });
});
