/**
 * Chat Storage — IndexedDB-based persistence for AI chat sessions & messages.
 *
 * Provides instant local restore on page refresh (no network round-trip).
 * Two object stores:
 *   - `active_sessions`: tracks which chat is currently active per student+agent
 *   - `chat_messages`: stores full message arrays keyed by chatId
 */

import type { Message } from "./localAI";

const DB_NAME = "FARADAY-chat-history";
const DB_VERSION = 1;
const SESSIONS_STORE = "active_sessions";
const MESSAGES_STORE = "chat_messages";

// ── Types ──

export interface ActiveSession {
  /** Composite key: `${studentId}:${agentType}` */
  key: string;
  chatId: string;
  studentId: string;
  agentType: string;
  context: string;
  topicName?: string;
  questionStem?: string;
  topicId?: string;
  questionId?: string;
  startedAt: number;
}

export interface StoredChat {
  chatId: string;
  messages: Message[];
  updatedAt: number;
}

export interface ChatHistoryEntry {
  chatId: string;
  title: string;
  agentType: string;
  messageCount: number;
  lastMessage: string;
  startedAt: number;
  updatedAt: number;
}

// ── Database ──

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const store = db.createObjectStore(MESSAGES_STORE, { keyPath: "chatId" });
        store.createIndex("by_updatedAt", "updatedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Active Session Management ──

function sessionKey(studentId: string, agentType: string): string {
  return `${studentId}:${agentType}`;
}

export async function saveActiveSession(session: Omit<ActiveSession, "key">): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, "readwrite");
    tx.objectStore(SESSIONS_STORE).put({
      ...session,
      key: sessionKey(session.studentId, session.agentType),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getActiveSession(
  studentId: string,
  agentType: string
): Promise<ActiveSession | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, "readonly");
    const request = tx.objectStore(SESSIONS_STORE).get(sessionKey(studentId, agentType));
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function clearActiveSession(
  studentId: string,
  agentType: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, "readwrite");
    tx.objectStore(SESSIONS_STORE).delete(sessionKey(studentId, agentType));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Message Persistence ──

export async function saveMessages(chatId: string, messages: Message[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES_STORE, "readwrite");
    tx.objectStore(MESSAGES_STORE).put({
      chatId,
      messages,
      updatedAt: Date.now(),
    } as StoredChat);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMessages(chatId: string): Promise<Message[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES_STORE, "readonly");
    const request = tx.objectStore(MESSAGES_STORE).get(chatId);
    request.onsuccess = () => {
      const result = request.result as StoredChat | undefined;
      resolve(result?.messages ?? []);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearMessages(chatId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MESSAGES_STORE, "readwrite");
    tx.objectStore(MESSAGES_STORE).delete(chatId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Debounced save helper ──

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingSaves = new Map<string, Message[]>();

export function debouncedSaveMessages(chatId: string, messages: Message[], delayMs = 300): void {
  const existing = saveTimers.get(chatId);
  if (existing) clearTimeout(existing);

  pendingSaves.set(chatId, messages);

  saveTimers.set(
    chatId,
    setTimeout(() => {
      saveMessages(chatId, messages).catch(console.error);
      saveTimers.delete(chatId);
      pendingSaves.delete(chatId);
    }, delayMs)
  );
}

/** Immediately flush all pending debounced saves — call before page unload */
export function flushAllPending(): void {
  for (const [chatId, timer] of saveTimers) {
    clearTimeout(timer);
  }
  saveTimers.clear();

  for (const [chatId, messages] of pendingSaves) {
    // Fire and forget — we're in beforeunload so can't await
    saveMessages(chatId, messages).catch(console.error);
  }
  pendingSaves.clear();
}

