import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { X, Send, Terminal, ChevronDown, Copy, ThumbsUp, Calculator, ImagePlus, Settings, User, QrCode } from "./electric";
import { log } from "../lib/logger";
import {
  isLocalAIAvailable,
  getAIStatus,
  createSession,
  destroySession,
  streamMessage,
  checkNotebookImage,
  analyzeConversation,
  generateCompositeBrief,
  getMockResponse,
  onModelProgress,
  estimateTokens,
  heuristicSummary,
  onDebugUpdate,
  type AgentType,
  type Message,
  type PartialBrief,
  type AIDebugState,
} from "../services/localAI";
import { prepareImageForUpload, type PreparedImage } from "../services/imageUpload";
import { queueMessage, getPendingMessages, clearPendingMessages, isOnline, onOnline } from "../services/offlineQueue";
import {
  saveActiveSession,
  getActiveSession,
  clearActiveSession,
  saveMessages,
  getMessages,
  debouncedSaveMessages,
  flushAllPending,
} from "../services/chatStorage";
import MathText from "./MathText";
import FaradayAvatar from "./FaradayAvatar";
import QRBridgeModal from "./QRBridgeModal";
import FaradayCanvas from "./FaradayCanvas";
import ThinkingWave from "./chat/ThinkingWave";
import FaradayConsole from "./chat/FaradayConsole";

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  agentType: AgentType;
  questionStem?: string;
  topicName?: string;
  topicId?: string;
  questionId?: string;
  /** External trigger (e.g. the homework question) to open the phone-photo bridge. */
  requestBridge?: boolean;
  onBridgeRequestHandled?: () => void;
  /** Opens the math playground (wired to the math-keyboard button in the console). */
  onOpenPlayground?: () => void;
}

export default function AIChatPanel({
  isOpen, onClose, studentId, agentType,
  questionStem, topicName, topicId, questionId,
  requestBridge, onBridgeRequestHandled, onOpenPlayground,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStatus, setAiStatus] = useState<"ready" | "downloading" | "unavailable">("unavailable");
  const [loadProgress, setLoadProgress] = useState<{ percent: number; stage: string } | null>(null);
  const [chatId, setChatId] = useState<Id<"aiChats"> | null>(null);
  const [online, setOnline] = useState(isOnline());
  const [, setIsResumed] = useState(false);

  // Session Cycling state
  const [cycleState, setCycleState] = useState<"active" | "cycling" | "self_assess">("active");
  const [sessionIndex, setSessionIndex] = useState(0);
  const [partialBriefs, setPartialBriefs] = useState<PartialBrief[]>([]);
  const [awaitingSelfAssess, setAwaitingSelfAssess] = useState(false);
  const [pendingNextQuestion, setPendingNextQuestion] = useState(false);
  const [, setSelfAssessment] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<AIDebugState | null>(null);

  // Notebook image-check state
  const [attachedImage, setAttachedImage] = useState<PreparedImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showQRBridge, setShowQRBridge] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentContext = questionStem
    ? (topicName ? `נושא: ${topicName}\nשאלה: ${questionStem}` : `שאלה: ${questionStem}`)
    : "";

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatIdRef = useRef<Id<"aiChats"> | null>(null);
  const initGuard = useRef(false);
  const sessionStartedAt = useRef(Date.now());
  const lastValidQuestionIdRef = useRef(questionId);
  const userMsgCount = useRef(0);
  const isSendingRef = useRef(false);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Keep ref in sync so callbacks always have current value
  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);

  useEffect(() => {
    return () => {
      activeAbortControllerRef.current?.abort();
      activeAbortControllerRef.current = null;
    };
  }, []);

  const startChat = useMutation(api.aiChat.startChat);
  const addMessageMut = useMutation(api.aiChat.addMessage);
  const endChatMut = useMutation(api.aiChat.endChat);
  const syncMessages = useMutation(api.aiChat.syncMessages);
  const createBriefMut = useMutation(api.sessionBriefs.createBrief);

  // Track AI status
  useEffect(() => {
    setAiStatus(getAIStatus());
    onModelProgress((percent, stage) => {
      setLoadProgress({ percent, stage });
      setAiStatus(percent >= 100 || stage === "ready" ? "ready" : "downloading");
    });
    const interval = setInterval(() => {
      setAiStatus(getAIStatus());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to AI debug state updates
  useEffect(() => {
    const unsub = onDebugUpdate((state) => setDebugInfo(state));
    return unsub;
  }, []);

  // External trigger (e.g. from the homework question) to open the phone-photo bridge
  useEffect(() => {
    if (requestBridge && isOpen) {
      setShowQRBridge(true);
      onBridgeRequestHandled?.();
    }
  }, [requestBridge, isOpen, onBridgeRequestHandled]);

  // Track online status
  useEffect(() => {
    const handler = () => setOnline(navigator.onLine);
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  }, []);

  // Flush pending saves on page refresh/close
  useEffect(() => {
    const handler = () => flushAllPending();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Sync offline messages when back online
  useEffect(() => {
    return onOnline(async () => {
      const pending = await getPendingMessages();
      if (pending.length > 0 && chatIdRef.current) {
        try {
          await syncMessages({
            messages: pending.map((m) => ({
              chatId: chatIdRef.current!,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
            })),
          });
          await clearPendingMessages();
        } catch (e) {
          console.error("Failed to sync offline messages:", e);
        }
      }
    });
  }, [syncMessages]);


  const createFreshChat = useCallback(async () => {
    const context = questionStem
      ? (topicName ? `נושא: ${topicName}\nשאלה: ${questionStem}` : `שאלה: ${questionStem}`)
      : "";
    await createSession(agentType, context);

    const welcome: Message = {
      role: "system",
      content: agentType === "practice"
        ? `🤖 מורה AI מוכן לעזור עם ${topicName || "הנושא הנוכחי"}`
        : "🤖 מורה AI מוכן לעזור עם שיעורי הבית",
    };

    // We defer calling startChat() until the first message is sent
    // so we don't pollute the DB with empty chats.
    setMessages([welcome]);
    setIsResumed(false);
  }, [agentType, topicName, questionStem]);

  // ── Reset on question change ──
  const prevQuestionIdRef = useRef(questionId);
  useEffect(() => {
    if (prevQuestionIdRef.current !== questionId) {
      console.log("[AIChatPanel] Active question changed! Clearing old chat state...");
      setChatId(null);
      chatIdRef.current = null;
      setMessages([]);
      setIsResumed(false);
      initGuard.current = false; // allow re-init
      prevQuestionIdRef.current = questionId;
    }
  }, [questionId]);

  // ── Single unified init/resume flow ──
  useEffect(() => {
    if (!isOpen) {
      initGuard.current = false; // reset guard when panel closes
      return;
    }

    // If we already have messages in state (panel was just hidden, not unmounted), skip re-init
    if (chatId && messages.length > 0) {
      createSession(agentType, currentContext).catch((e) =>
        console.error("[AIChatPanel] Failed to restore session context on reopen:", e)
      );
      return;
    }

    if (initGuard.current) return; // prevent double-fire from React strict mode / race
    initGuard.current = true;

    const init = async () => {
      // 1. Try local IndexedDB (instant, no network)
      const localSession = await getActiveSession(studentId, agentType);

      if (localSession) {
        if (localSession.questionId !== questionId) {
          console.log("[AIChatPanel] Question ID mismatch, clearing old session. Old:", localSession.questionId, "New:", questionId);
          await clearActiveSession(studentId, agentType);
        } else {
          const localChatId = localSession.chatId as Id<"aiChats">;
          setChatId(localChatId);
          chatIdRef.current = localChatId; // sync ref immediately, don't wait for render

          const cached = await getMessages(localSession.chatId);
          if (cached.length > 0) {
            setMessages(cached);
            setIsResumed(true);
            await createSession(agentType, localSession.context);
            return; // successfully restored
          }
          // local session exists but messages cache is empty → fall through to create fresh
        }
      }

      // 2. Try Convex server for an open chat (within last 4 hours)
      // We do a direct fetch instead of relying on a reactive useQuery to avoid race conditions
      // The getActiveChat query is still available for the future but we don't depend on it reactively here
      // Just create a fresh chat — this is the simplest reliable path
      await createFreshChat();
    };

    init().catch((e) => {
      console.error("Chat init failed:", e);
      initGuard.current = false;
    });
  }, [isOpen, agentType, studentId, chatId, messages.length, createFreshChat]);


  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── Immediately save current messages to IndexedDB (no debounce) ──
  const flushSave = useCallback(async (msgs?: Message[]) => {
    const id = chatIdRef.current;
    if (!id) return;
    const toSave = msgs ?? messages;
    try {
      await saveMessages(id, toSave);
    } catch (e) {
      console.error("Flush save failed:", e);
    }
  }, [messages]);

  const persistMessage = useCallback(async (role: string, content: string) => {
    if (chatIdRef.current && online) {
      try {
        await addMessageMut({ chatId: chatIdRef.current, role, content });
      } catch {
        await queueMessage({ chatId: chatIdRef.current, role, content, timestamp: Date.now() });
      }
    } else if (chatIdRef.current) {
      await queueMessage({ chatId: chatIdRef.current, role, content, timestamp: Date.now() });
    }
  }, [online, addMessageMut]);

  // ── Session Cycling: detect questionId prop change ──
  useEffect(() => {
    if (questionId) {
      const prevId = lastValidQuestionIdRef.current;
      if (prevId && questionId !== prevId) {
        if (cycleState === "active" && messages.length > 1) {
          setCycleState("self_assess");
          setAwaitingSelfAssess(true);
          setPendingNextQuestion(true);
          const assessMsg: Message = {
            role: "model",
            content: "רגע לפני שממשיכים לשאלה הבאה — איך אתה מרגיש שהלך? מה היה הכי קשה ומה הבנת הכי טוב?",
          };
          setMessages(prev => {
            const newMsgs = [...prev, assessMsg];
            if (chatIdRef.current) saveMessages(chatIdRef.current, newMsgs).catch(console.error);
            return newMsgs;
          });
          persistMessage("model", assessMsg.content).catch(console.error);
        } else if (messages.length <= 1) {
          // Silently reset to the new question!
          const resetSession = async () => {
            console.log("[AIChatPanel] Silently resetting chat for new question:", questionId);
            await clearActiveSession(studentId, agentType);
            setMessages([]);
            setChatId(null);
            chatIdRef.current = null;
            setIsResumed(false);
            setCycleState("active");
            setSessionIndex(0);
            setPartialBriefs([]);
            setSelfAssessment(null);
            setAwaitingSelfAssess(false);
            setPendingNextQuestion(false);
            userMsgCount.current = 0;
            initGuard.current = false;

            // We defer calling startChat() here just like in createFreshChat,
            // so we don't open an empty chat in the DB until the student sends a message.

            const context = questionStem
              ? (topicName ? `נושא: ${topicName}\nשאלה: ${questionStem}` : `שאלה: ${questionStem}`)
              : "";
            await createSession(agentType, context);

            const welcome: Message = {
              role: "system",
              content: agentType === "practice"
                ? `🤖 מורה AI מוכן לעזור עם ${topicName || "הנושא הנוכחי"}`
                : "🤖 מורה AI מוכן לעזור עם שיעורי הבית",
            };
            const initialMessages = [welcome];
            setMessages(initialMessages);
          };
          resetSession().catch(console.error);
        }
      }
      lastValidQuestionIdRef.current = questionId;
    }
  }, [questionId, cycleState, messages.length, persistMessage, studentId, agentType, topicName, questionStem, topicId, online, startChat]);

  // ── Session Cycling: check triggers ──
  const checkCycleTriggers = useCallback((): "message_count" | "time" | "token_saturation" | null => {
    // Check message count (8 user messages)
    if (userMsgCount.current >= 8) return "message_count";

    // Check elapsed time (15 minutes)
    if (Date.now() - sessionStartedAt.current > 15 * 60 * 1000) return "time";

    // Check token saturation (80% of 4096)
    const allText = messages.map(m => m.content).join("");
    if (estimateTokens(allText) > 3200) return "token_saturation";

    return null;
  }, [messages]);

  // ── Execute a session cycle (transparent to student) ──
  const executeCycle = useCallback(async (triggerReason: PartialBrief["triggerReason"]) => {
    if (cycleState !== "active") return;
    setCycleState("cycling");

    // Generate a carry-over summary from current messages
    const summary = heuristicSummary(messages);
    const durationMs = Date.now() - sessionStartedAt.current;

    // Store partial brief
    const partial: PartialBrief = {
      sessionIndex,
      messageCount: messages.filter(m => m.role !== "system").length,
      durationMs,
      summary,
      triggerReason,
    };
    setPartialBriefs(prev => [...prev, partial]);

    // End current chat session on server
    if (chatIdRef.current && online) {
      try {
        const metrics = await analyzeConversation(messages);
        await endChatMut({ chatId: chatIdRef.current, metrics });
      } catch (e) {
        console.error("Failed to end cycle session:", e);
      }
    }

    // Start a fresh chat session
    const title = agentType === "practice"
      ? `תרגול: ${topicName || "כללי"} (סבב ${sessionIndex + 2})`
      : `שיעורי בית: ${new Date().toLocaleDateString("he-IL")} (סבב ${sessionIndex + 2})`;

    let newChatId: Id<"aiChats"> | null = null;
    try {
      if (online) {
        newChatId = await startChat({
          studentId: studentId as Id<"students">,
          agentType,
          topicId: topicId ? (topicId as Id<"topics">) : undefined,
          questionId: questionId ? (questionId as Id<"questions">) : undefined,
          title,
        });
        setChatId(newChatId);
        chatIdRef.current = newChatId;
      }
    } catch (e) {
      console.error("Failed to start cycle chat:", e);
    }

    // Inject carry-over summary as system message
    const carryOver: Message = {
      role: "system",
      content: `[סיכום שיחה קודמת]: ${summary}`,
    };
    setMessages([carryOver]);
    userMsgCount.current = 0;
    sessionStartedAt.current = Date.now();
    setSessionIndex(prev => prev + 1);

    // Save to IndexedDB
    if (newChatId) {
      const context = questionStem
        ? (topicName ? `נושא: ${topicName}\nשאלה: ${questionStem}` : `שאלה: ${questionStem}`)
        : "";
      await saveActiveSession({
        chatId: newChatId,
        studentId,
        agentType,
        context,
        topicName,
        questionStem,
        topicId,
        questionId,
        startedAt: Date.now(),
      });
      await saveMessages(newChatId, [carryOver]);
    }

    await createSession(agentType, questionStem ? (topicName ? `נושא: ${topicName}\nשאלה: ${questionStem}` : `שאלה: ${questionStem}`) : "");
    setCycleState("active");
  }, [cycleState, messages, sessionIndex, online, agentType, topicName, questionStem, topicId, questionId, studentId, startChat, endChatMut]);

  // ── Notebook image check ──
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setImageError(null);
    try {
      const prepared = await prepareImageForUpload(file);
      setAttachedImage(prepared);
    } catch (err) {
      console.error("[AIChatPanel] Image prepare failed:", err);
      setImageError(err instanceof Error ? err.message : "לא ניתן לטעון את התמונה.");
      setTimeout(() => setImageError(null), 5000);
    }
  };

  const handleImageCheck = async () => {
    if (!attachedImage || isTyping || isSendingRef.current) return;

    if (!online) {
      setImageError("ניתוח התמונה דורש חיבור לאינטרנט.");
      setTimeout(() => setImageError(null), 5000);
      return;
    }

    isSendingRef.current = true;
    const img = attachedImage;
    const question = input.trim();

    try {
      setInput("");
      setAttachedImage(null);

      const userMsg: Message = {
        role: "user",
        content: question || "📷 עזור לי להתקדם — מה הצעד הבא לפי המחברת שלי?",
        imageUrl: img.dataUrl,
      };

      // Ensure a chat exists so the exchange lands in history (mirrors handleSend)
      let currentChatId = chatIdRef.current;
      if (!currentChatId && online) {
        const title = agentType === "practice"
          ? `תרגול: ${topicName || "כללי"}`
          : `שיעורי בית: ${new Date().toLocaleDateString("he-IL")}`;
        currentChatId = await startChat({
          studentId: studentId as Id<"students">,
          agentType,
          topicId: topicId ? (topicId as Id<"topics">) : undefined,
          questionId: questionId ? (questionId as Id<"questions">) : undefined,
          title,
        });
        setChatId(currentChatId);
        chatIdRef.current = currentChatId;
        await saveActiveSession({
          chatId: currentChatId,
          studentId,
          agentType,
          context: currentContext ?? "",
          topicName,
          questionStem,
          topicId,
          questionId,
          startedAt: sessionStartedAt.current,
        });
      }

      const updatedWithUser = [...messages, userMsg];
      setMessages(updatedWithUser);
      if (chatIdRef.current) saveMessages(chatIdRef.current, updatedWithUser).catch(console.error);
      await persistMessage("user", userMsg.content);

      setIsTyping(true);

      let feedback = "";
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;
      try {
        feedback = await checkNotebookImage(
          { mimeType: img.mimeType, data: img.base64 },
          question,
          currentContext,
          controller.signal
        );
      } finally {
        if (activeAbortControllerRef.current === controller) {
          activeAbortControllerRef.current = null;
        }
      }

      if (!feedback) {
        feedback = "לא הצלחתי לנתח את התמונה. נסה לצלם שוב באור טוב, במיקוד חד וכך שכל הפתרון נראה.";
      }

      setMessages((prev) => {
        const updated = [...prev, { role: "model" as const, content: feedback }];
        if (chatIdRef.current) saveMessages(chatIdRef.current, updated).catch(console.error);
        return updated;
      });
      await persistMessage("model", feedback);
    } catch (e) {
      if (e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"))) {
        return;
      }
      console.error("[AIChatPanel] Notebook check error:", e);
      const fallback = "מצטער, נתקלתי בבעיה בניתוח התמונה. נסה שוב בעוד רגע.";
      setMessages((prev) => {
        const updated = [...prev, { role: "model" as const, content: fallback }];
        if (chatIdRef.current) saveMessages(chatIdRef.current, updated).catch(console.error);
        return updated;
      });
      await persistMessage("model", fallback);
    } finally {
      setIsTyping(false);
      isSendingRef.current = false;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping || isSendingRef.current) return;
    isSendingRef.current = true;

    try {
      const userMsg = input.trim();
      setInput("");
      log.ai("user message sent", { agentType, chatId: chatIdRef.current, length: userMsg.length });

      const newUserMsg: Message = { role: "user", content: userMsg };

      // ── Self-assessment capture ──
      if (awaitingSelfAssess) {
        setAwaitingSelfAssess(false);
        const updatedMessages = [...messages, newUserMsg];
        setMessages(updatedMessages);
        // Persist the answer so it lands in the transcript AND the analysis —
        // otherwise the student's closing reply to "איך היה?" is dropped.
        if (chatIdRef.current) {
          await saveMessages(chatIdRef.current, updatedMessages).catch(console.error);
        }
        await persistMessage("user", userMsg);
        // Now finalize the brief, feeding it the transcript that includes this answer
        if (pendingNextQuestion) {
          await finalizeWithBriefAndContinue(userMsg, updatedMessages);
        } else {
          await finalizeWithBrief(userMsg, updatedMessages);
        }
        return;
      }

      // ── Check cycle triggers before processing ──
      const trigger = checkCycleTriggers();
      if (trigger) {
        await executeCycle(trigger);
        // After cycling, re-inject the user's message into the new session
      }

      userMsgCount.current++;

      // ── Ensure chat is created before sending first message ──
      let currentChatId = chatIdRef.current;
      if (!currentChatId && online) {
        const title = agentType === "practice"
          ? `תרגול: ${topicName || "כללי"}`
          : `שיעורי בית: ${new Date().toLocaleDateString("he-IL")}`;

        currentChatId = await startChat({
          studentId: studentId as Id<"students">,
          agentType,
          topicId: topicId ? (topicId as Id<"topics">) : undefined,
          questionId: questionId ? (questionId as Id<"questions">) : undefined,
          title,
        });
        setChatId(currentChatId);
        chatIdRef.current = currentChatId;

        // Persist initial session info now that we have an ID
        await saveActiveSession({
          chatId: currentChatId,
          studentId,
          agentType,
          context: currentContext ?? "",
          topicName,
          questionStem,
          topicId,
          questionId,
          startedAt: sessionStartedAt.current,
        });
      }

      // Update state and save to IndexedDB
      const updatedWithUser = [...messages, newUserMsg];
      setMessages(updatedWithUser);
      if (chatIdRef.current) {
        // Immediate save for the user message (don't lose it)
        saveMessages(chatIdRef.current, updatedWithUser).catch(console.error);
      }

      await persistMessage("user", userMsg);
      setIsTyping(true);

      const available = await isLocalAIAvailable();
      log.ai("AI availability check", { available });
      let finalResponse = "";

      if (available) {
        const controller = new AbortController();
        activeAbortControllerRef.current = controller;
        try {
          log.ai("calling Gemini via streamMessage", { agentType });
          finalResponse = await streamMessage(
            userMsg,
            (partial: string) => {
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg?.role === "model") {
                  lastMsg.content = partial;
                } else {
                  updated.push({ role: "model", content: partial });
                }
                // Debounced save during streaming (too many chunks to save each one)
                if (chatIdRef.current) debouncedSaveMessages(chatIdRef.current, [...updated]);
                return [...updated];
              });
            },
            messages,
            controller.signal,
            { agentType, questionContext: currentContext }  // always pass fresh context
          );
          log.ai("Gemini response received", { length: finalResponse.length });
        } finally {
          if (activeAbortControllerRef.current === controller) {
            activeAbortControllerRef.current = null;
          }
        }
      }

      if (!finalResponse) {
        log.ai("empty response — falling back to mock");
        finalResponse = getMockResponse(userMsg, messages);
        console.log("[AIChatPanel] getMockResponse returned fallback:", JSON.stringify(finalResponse));
      }

      // Final save with complete response — immediate, not debounced
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg?.role === "model") {
          lastMsg.content = finalResponse;
        } else {
          updated.push({ role: "model", content: finalResponse });
        }
        // Immediate save of the final state
        if (chatIdRef.current) saveMessages(chatIdRef.current, [...updated]).catch(console.error);
        return [...updated];
      });

      await persistMessage("model", finalResponse);

      if (chatIdRef.current) {
        await saveActiveSession({
          chatId: chatIdRef.current,
          studentId,
          agentType,
          context: currentContext ?? "",
          topicName,
          questionStem,
          topicId,
          questionId,
          startedAt: sessionStartedAt.current,
        });
      }
    } catch (e) {
      if (e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"))) {
        console.log("[AIChatPanel] streamMessage was aborted, skipping error display.");
        return;
      }
      console.error("AI error:", e);
      const fallback = "מצטער, נתקלתי בבעיה טכנית. נסה שוב.";
      setMessages((prev) => {
        const updated = [...prev, { role: "model" as const, content: fallback }];
        if (chatIdRef.current) saveMessages(chatIdRef.current, updated).catch(console.error);
        return updated;
      });
      await persistMessage("model", fallback);
    } finally {
      setIsTyping(false);
      isSendingRef.current = false;
    }
  };

  // Route the send action: image attached → notebook check, otherwise normal chat
  const handleSubmit = () => {
    if (attachedImage) {
      handleImageCheck();
    } else {
      handleSend();
    }
  };

  // X = minimize (keep session alive for resume)
  const handleMinimize = async () => {
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    // Flush-save messages immediately before closing
    await flushSave();
    destroySession();
    onClose();
  };

  // "End Chat" = ask for self-assessment, then finalize with brief
  const handleEndChat = async () => {
    if (!chatIdRef.current || messages.length <= 1) {
      await cleanup();
      return;
    }

    // Ask the student for self-assessment
    setCycleState("self_assess");
    setAwaitingSelfAssess(true);

    const assessMsg: Message = {
      role: "model",
      content: "לפני שנסיים — איך אתה מרגיש שהלך? מה היה הכי קשה ומה הרגשת שהבנת הכי טוב?",
    };
    setMessages(prev => [...prev, assessMsg]);
    if (chatIdRef.current) {
      await saveMessages(chatIdRef.current, [...messages, assessMsg]);
    }
    await persistMessage("model", assessMsg.content);
  };

  // Helper to run pedagogical analysis and save the session brief in the background
  const runFinalizeBackground = async (
    selfAssessText: string,
    currentChatId: Id<"aiChats"> | null,
    currentMessages: Message[],
    currentPartialBriefs: PartialBrief[]
  ) => {
    if (!currentChatId) return;
    console.log("[AIChatPanel] Starting background finalization for chat:", currentChatId);
    try {
      // 1. Generate composite brief in the background
      const brief = await generateCompositeBrief(
        currentPartialBriefs,
        currentMessages,
        selfAssessText
      );

      // 2. Analyze conversation
      let metrics = undefined;
      try {
        metrics = await analyzeConversation(currentMessages);
      } catch (err) {
        console.error("[AIChatPanel] Background analyzeConversation failed:", err);
      }

      // 3. End chat with metrics
      if (online) {
        try {
          await endChatMut({ chatId: currentChatId, metrics });
        } catch (err) {
          console.error("[AIChatPanel] Background endChatMut failed:", err);
        }
      }

      // 4. Save composite brief to Convex
      if (online) {
        try {
          await createBriefMut({
            chatId: currentChatId,
            studentId: studentId as Id<"students">,
            topicId: topicId ? (topicId as Id<"topics">) : undefined,
            totalCycles: brief.totalCycles,
            totalMessages: brief.totalMessages,
            totalDurationMs: brief.totalDurationMs,
            partialBriefs: brief.partialBriefs,
            approach: brief.approach,
            frictionPoints: brief.frictionPoints,
            autonomyLevel: brief.autonomyLevel,
            solutionAccuracy: brief.solutionAccuracy,
            keyInsight: brief.keyInsight,
            recommendedAction: brief.recommendedAction,
            // Teacher-enriched analytics
            missingConcepts: brief.missingConcepts,
            teacherActionItem: brief.teacherActionItem,
            studentQuotes: brief.studentQuotes,
            detailedStruggleAnalysis: brief.detailedStruggleAnalysis,
            nextSteps: brief.nextSteps,
            selfAssessment: brief.selfAssessment,
          });
          console.log("[AIChatPanel] Background brief created successfully for:", currentChatId);
        } catch (err) {
          console.error("[AIChatPanel] Background createBriefMut failed:", err);
        }
      }
    } catch (e) {
      console.error("[AIChatPanel] Background finalization failed:", e);
      if (online) {
        try {
          await endChatMut({ chatId: currentChatId });
        } catch (err) {
          console.error("[AIChatPanel] Background fallback endChatMut failed:", err);
        }
      }
    }
  };

  // ── Finalize: generate composite brief + save + cleanup ──
  const finalizeWithBrief = async (selfAssessText: string, msgs?: Message[]) => {
    const currentChatId = chatIdRef.current;
    const currentMessages = msgs ?? [...messages];
    const currentPartialBriefs = [...partialBriefs];

    // Trigger background generation and saving without blocking the user
    runFinalizeBackground(selfAssessText, currentChatId, currentMessages, currentPartialBriefs);

    // Immediately clean up and close the panel
    await cleanup();
  };

  const finalizeWithBriefAndContinue = async (selfAssessText: string, msgs?: Message[]) => {
    const currentChatId = chatIdRef.current;
    const currentMessages = msgs ?? [...messages];
    const currentPartialBriefs = [...partialBriefs];

    // Trigger background generation and saving without blocking the user
    runFinalizeBackground(selfAssessText, currentChatId, currentMessages, currentPartialBriefs);

    // Immediately reset the chat context and start a fresh session
    await clearActiveSession(studentId, agentType);
    setPartialBriefs([]);
    setSessionIndex(0);
    userMsgCount.current = 0;
    setSelfAssessment(null);
    setPendingNextQuestion(false);
    setCycleState("active");

    await createFreshChat();
  };

  const cleanup = async () => {
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    setIsAnalyzing(false);
    await clearActiveSession(studentId, agentType);
    destroySession();
    setMessages([]);
    setChatId(null);
    chatIdRef.current = null;
    setIsResumed(false);
    setCycleState("active");
    setSessionIndex(0);
    setPartialBriefs([]);
    setSelfAssessment(null);
    setAwaitingSelfAssess(false);
    setPendingNextQuestion(false);
    userMsgCount.current = 0;
    initGuard.current = false;
    onClose();
  };

  if (!isOpen) return null;

  // Until the first real exchange, show a richer intro instead of a bare system pill
  const hasConversation = messages.some((m) => m.role === "user" || m.role === "model");
  const starterPrompts = agentType === "practice"
    ? ["לא הבנתי את השאלה", "תן לי רמז קטן", "איך מתחילים?"]
    : ["אני תקוע בסעיף הזה", "תסביר לי את הנושא", "תן לי רמז לצעד הבא"];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed bottom-0 left-0 w-full z-[100] flex flex-col font-body-md shadow-2xl overflow-hidden h-[58vh] md:h-[50vh]"
            style={{
              background: 'var(--color-surface)',
              borderTop: '2px solid var(--color-outline-variant)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
            }}
            dir="rtl"
          >
            {/* Mobile Drag Handle Indicator */}
            <div className="md:hidden w-full flex justify-center pt-3 pb-1 bg-surface-container-lowest relative z-[3]">
              <div className="w-10 h-1.5 rounded-full bg-outline-variant/60" />
            </div>

            {/* Scanline effect — dark mode only */}
            <div
              className="pointer-events-none absolute inset-0 z-[1] opacity-0"
              style={{
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(91,255,159,0.015) 2px, rgba(91,255,159,0.015) 4px)',
              }}
              aria-hidden
            />
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-2 md:py-3 flex-shrink-0 bg-surface-container-lowest border-b border-outline-variant/60 relative z-[2]">
              {/* AI identity */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-primary-container/20 border-2 border-primary flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(91,255,159,0.25)]">
                    <FaradayAvatar px={48} fill />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-surface animate-pulse shadow-[0_0_8px_rgba(91,255,159,0.6)]" />
                </div>
                <div>
                  <div className="font-headline-md text-on-surface" style={{ textShadow: '0 0 10px rgba(91,255,159,0.08)' }}>
                    פרופסור פאראדיי
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="font-label-md text-primary" style={{ fontSize: '11px' }}>מחובר · עוזר AI למתמטיקה</span>
                    {aiStatus === "downloading" && loadProgress && (
                      <span className="font-label-md text-tertiary-container animate-pulse" style={{ fontSize: '11px' }}>
                        · טוען מודל... {loadProgress.percent}%
                      </span>
                    )}
                    {isAnalyzing && (
                      <span className="font-label-md text-secondary animate-pulse" style={{ fontSize: '11px' }}>
                        · מנתח שיחה...
                      </span>
                    )}
                    {cycleState === "cycling" && (
                      <span className="font-label-md text-tertiary animate-pulse" style={{ fontSize: '11px' }}>
                        · מחדש הקשר...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">

                <button
                  onClick={handleEndChat}
                  disabled={isAnalyzing || messages.length <= 1}
                  className="flex items-center gap-2 px-3 py-1.5 border-2 border-outline-variant rounded-lg font-label-lg text-on-surface-variant hover:bg-surface-variant transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>סיום שיחה</span>
                  <X className="" />
                </button>
                <button
                  onClick={handleMinimize}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 hover:text-primary transition-colors"
                  title="מזעור"
                >
                  <ChevronDown className="" />
                </button>
              </div>
            </div>

            {/* ── Body: messages + optional debug ── */}
            <div className="flex flex-1 overflow-hidden relative">

              {/* Knowledge constellation field — particle network with named concept nodes */}
              <FaradayCanvas variant="constellation" style={{ zIndex: 0 }} />

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 flex flex-col gap-6 scroll-smooth z-10">

                {/* Context Header */}
                {topicName && (
                  <div className="text-center mb-2">
                    <span className="inline-block bg-surface-container-highest text-on-surface-variant font-label-sm px-4 py-1.5 rounded-full border border-outline-variant shadow-sm">
                      {topicName}
                    </span>
                  </div>
                )}

                {/* Intro / starter state — shown until the first real message */}
                {!hasConversation && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-1 flex-col items-center justify-center text-center gap-5 py-8"
                  >
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-primary-container/20 border-2 border-primary flex items-center justify-center overflow-hidden shadow-[0_0_24px_rgba(91,255,159,0.3)]">
                        <FaradayAvatar px={64} fill />
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary border-2 border-surface animate-pulse" />
                    </div>
                    <div>
                      <div className="font-headline-md text-on-surface mb-1">שלום, אני פרופסור פאראדיי ⚡</div>
                      <div className="font-body-md text-on-surface-variant max-w-[22rem] mx-auto">
                        {agentType === "practice"
                          ? `כאן כדי לעזור לך לפצח את ${topicName || "השאלה"} — לא נותן תשובות, בונה איתך את הדרך.`
                          : "כאן כדי ללוות אותך בשיעורי הבית, שלב אחר שלב. שאל אותי כל דבר."}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-[30rem]">
                      {starterPrompts.map((s) => (
                        <button
                          key={s}
                          onClick={() => setInput(s)}
                          className="px-4 py-2 rounded-full bg-surface-container border-2 border-outline text-on-surface text-sm font-medium hover:border-primary hover:text-primary transition-all"
                          style={{ boxShadow: 'var(--shadow-clay)' }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {hasConversation && messages.map((msg, i) => {
                  if (msg.role === "system") return (
                    <div key={i} className="flex justify-center">
                      <div className="px-4 py-2 rounded-full text-xs font-label-md bg-surface-container-highest text-on-surface-variant border border-outline-variant">
                        <MathText>{msg.content}</MathText>
                      </div>
                    </div>
                  );

                  const isAI = msg.role === "model";

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, type: "spring", stiffness: 200, damping: 20 }}
                      className={`flex gap-4 w-full max-w-4xl ${isAI ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                    >
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden shadow-lg ${isAI ? 'bg-surface-bright border border-primary/30 shadow-[0_0_15px_rgba(91,255,159,0.15)]' : 'bg-secondary-container border border-secondary'}`}>
                        {isAI ? (
                          <FaradayAvatar px={40} fill />
                        ) : (
                          <User size={20} className="text-on-secondary-container" />
                        )}
                      </div>

                      {/* Bubble */}
                      <div
                        className={`p-5 shadow-md relative group ${isAI ? 'bg-surface-container border border-primary/50 rounded-2xl rounded-tr-sm' : 'bg-surface-variant border border-outline/30 rounded-2xl rounded-tl-sm'}`}
                        style={{ maxWidth: '85%' }}
                      >
                        {isAI && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-surface p-1 rounded-md border border-outline-variant z-10">
                            <button className="text-on-surface-variant hover:text-primary"><Copy className="text-[18px]" /></button>
                            <button className="text-on-surface-variant hover:text-primary"><ThumbsUp className="text-[18px]" /></button>
                          </div>
                        )}
                        {msg.imageUrl && (
                          <img
                            src={msg.imageUrl}
                            alt="המחברת שצולמה"
                            className="rounded-xl mb-3 max-h-72 w-auto border border-outline/40 shadow-md"
                          />
                        )}
                        <div className="text-on-background leading-relaxed">
                          <MathText>{msg.content}</MathText>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex gap-4 w-full max-w-4xl mr-auto">
                    <div className="w-10 h-10 rounded-full bg-surface-bright border border-primary/30 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(91,255,159,0.15)]">
                      <FaradayAvatar px={40} fill />
                    </div>
                    <div className="bg-surface-container border border-primary/50 rounded-2xl rounded-tr-sm px-5 py-4 shadow-lg flex items-center gap-3">
                      <ThinkingWave />
                      <span className="font-label-md text-on-surface-variant" style={{ fontSize: '12px' }}>
                        פאראדיי חושב…
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Debug sidebar */}
              {showDebug && (
                <div className="w-[360px] overflow-y-auto p-5 flex-shrink-0 bg-surface-container-lowest border-r border-outline-variant z-20 shadow-xl">
                  <div className="font-label-lg text-primary mb-4 flex items-center gap-2">
                    <Terminal className="" /> AI Diagnostics
                  </div>
                  {debugInfo ? (
                    <pre className="text-[10px] whitespace-pre-wrap text-on-surface-variant font-mono bg-surface p-3 rounded-lg border border-outline/30">
                      {JSON.stringify(debugInfo, null, 2)}
                    </pre>
                  ) : (
                    <span className="font-label-sm text-on-surface-variant/50">אין נתונים</span>
                  )}
                </div>
              )}
            </div>

            {/* ── Input bar (Faraday Console) ── */}
            <FaradayConsole
              input={input}
              onInputChange={setInput}
              attachedImage={attachedImage}
              onRemoveImage={() => setAttachedImage(null)}
              imageError={imageError}
              isTyping={isTyping}
              isAnalyzing={isAnalyzing}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              onSubmit={handleSubmit}
              onOpenQRBridge={() => setShowQRBridge(true)}
              onOpenPlayground={onOpenPlayground}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showQRBridge && (
        <QRBridgeModal
          studentId={studentId}
          label={topicName || "רמז מהמחברת"}
          onClose={() => setShowQRBridge(false)}
          onImageReceived={(img) => { setAttachedImage(img); setShowQRBridge(false); }}
        />
      )}
    </>
  );
}


