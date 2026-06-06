import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";
import { X, Send, Bot, BookOpen, Zap, WifiOff, History, MessageSquare, Sparkles, Clock, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import {
  isLocalAIAvailable,
  getAIStatus,
  createSession,
  destroySession,
  streamMessage,
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

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  agentType: AgentType;
  questionStem?: string;
  topicName?: string;
  topicId?: string;
  questionId?: string;
}

export default function AIChatPanel({
  isOpen, onClose, studentId, agentType,
  questionStem, topicName, topicId, questionId,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStatus, setAiStatus] = useState<"ready" | "downloading" | "unavailable">("unavailable");
  const [loadProgress, setLoadProgress] = useState<{ percent: number; stage: string } | null>(null);
  const [chatId, setChatId] = useState<Id<"aiChats"> | null>(null);
  const [online, setOnline] = useState(isOnline());
  const [isResumed, setIsResumed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Session Cycling state
  const [cycleState, setCycleState] = useState<"active" | "cycling" | "self_assess">("active");
  const [sessionIndex, setSessionIndex] = useState(0);
  const [partialBriefs, setPartialBriefs] = useState<PartialBrief[]>([]);
  const [awaitingSelfAssess, setAwaitingSelfAssess] = useState(false);
  const [pendingNextQuestion, setPendingNextQuestion] = useState(false);
  const [selfAssessment, setSelfAssessment] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<AIDebugState | null>(null);
  
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

  // Chat history for the sidebar
  const chatHistory = useQuery(
    api.aiChat.getStudentChats,
    showHistory ? { studentId: studentId as Id<"students"> } : "skip"
  );

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
    const title = agentType === "practice"
      ? `תרגול: ${topicName || "כללי"}`
      : `שיעורי בית: ${new Date().toLocaleDateString("he-IL")}`;

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
        chatIdRef.current = newChatId; // sync ref immediately
      }
    } catch (e) {
      console.error("Failed to start chat:", e);
    }

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
    setIsResumed(false);

    // Persist session + messages to IndexedDB immediately
    if (newChatId) {
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
      await saveMessages(newChatId, initialMessages);
    }
  }, [agentType, topicName, online, startChat, studentId, topicId, questionId, questionStem]);

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
            
            const title = agentType === "practice"
              ? `תרגול: ${topicName || "כללי"}`
              : `שיעורי בית: ${new Date().toLocaleDateString("he-IL")}`;

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
              console.error("Failed to start silent reset chat:", e);
            }

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
            if (newChatId) {
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
              await saveMessages(newChatId, initialMessages);
            }
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

  const handleSend = async () => {
    if (!input.trim() || isTyping || isSendingRef.current) return;
    isSendingRef.current = true;
    
    try {
      const userMsg = input.trim();
      setInput("");

      const newUserMsg: Message = { role: "user", content: userMsg };

      // ── Self-assessment capture ──
      if (awaitingSelfAssess) {
        setAwaitingSelfAssess(false);
        setMessages(prev => [...prev, newUserMsg]);
        // Now finalize the brief
        if (pendingNextQuestion) {
          await finalizeWithBriefAndContinue(userMsg);
        } else {
          await finalizeWithBrief(userMsg);
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
      console.log("[AIChatPanel] isLocalAIAvailable returned:", available);
      let finalResponse = "";

      if (available) {
        const controller = new AbortController();
        activeAbortControllerRef.current = controller;
        try {
          console.log("[AIChatPanel] Calling streamMessage for userMsg:", JSON.stringify(userMsg));
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
          console.log("[AIChatPanel] streamMessage resolved. finalResponse returned:", JSON.stringify(finalResponse));
        } finally {
          if (activeAbortControllerRef.current === controller) {
            activeAbortControllerRef.current = null;
          }
        }
      }

      if (!finalResponse) {
        console.log("[AIChatPanel] finalResponse is empty/falsy, falling back to mock response.");
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
    } catch (e: any) {
      if (e?.name === "AbortError" || e?.message?.includes("aborted")) {
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
  const finalizeWithBrief = async (selfAssessText: string) => {
    const currentChatId = chatIdRef.current;
    const currentMessages = [...messages];
    const currentPartialBriefs = [...partialBriefs];

    // Trigger background generation and saving without blocking the user
    runFinalizeBackground(selfAssessText, currentChatId, currentMessages, currentPartialBriefs);

    // Immediately clean up and close the panel
    await cleanup();
  };

  const finalizeWithBriefAndContinue = async (selfAssessText: string) => {
    const currentChatId = chatIdRef.current;
    const currentMessages = [...messages];
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

  // Resume a historical chat from the sidebar
  const handleResumeHistoryChat = async (historyChatId: string) => {
    setShowHistory(false);
    const cached = await getMessages(historyChatId);
    if (cached.length > 0) {
      setChatId(historyChatId as Id<"aiChats">);
      chatIdRef.current = historyChatId as Id<"aiChats">;
      setMessages(cached);
      setIsResumed(true);
    }
  };

  if (!isOpen) return null;

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 220 }}
          className="fixed bottom-0 left-0 w-full z-[100] flex flex-col"
          style={{
            height: '65vh',
            background: 'rgba(5, 11, 24, 0.96)',
            backdropFilter: 'blur(32px)',
            borderTop: '1px solid var(--border-default)',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.6), 0 -1px 0 var(--border-subtle)',
          }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}>

            {/* AI identity */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', boxShadow: 'var(--glow-primary)' }}>
                  <Bot size={20} className="text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full pulse-dot border-2"
                  style={{ borderColor: 'var(--bg-void)' }} />
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  פרופסור פאראדיי · מורה AI
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="label-mono" style={{ color: 'var(--color-success)', fontSize: '0.58rem' }}>מחובר</span>
                  {aiStatus === "downloading" && loadProgress && (
                    <span className="label-mono animate-pulse" style={{ color: 'var(--color-warning)', fontSize: '0.58rem' }}>
                      טוען מודל... {loadProgress.percent}%
                    </span>
                  )}
                  {isAnalyzing && (
                    <span className="label-mono animate-pulse" style={{ color: 'var(--color-primary-light)', fontSize: '0.58rem' }}>
                      מנתח שיחה...
                    </span>
                  )}
                  {cycleState === "cycling" && (
                    <span className="label-mono animate-pulse" style={{ color: 'var(--color-accent)', fontSize: '0.58rem' }}>
                      מחדש הקשר...
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDebug(v => !v)}
                className="btn-icon"
                title="Debug"
                style={{ fontSize: '0.6rem' }}
              >
                <Terminal size={14} />
              </button>
              <button
                onClick={handleEndChat}
                disabled={isAnalyzing || messages.length <= 1}
                className="btn btn-ghost btn-sm"
              >
                סיום שיחה
              </button>
              <button
                onClick={handleMinimize}
                className="btn-icon"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* ── Body: messages + optional debug ── */}
          <div className="flex flex-1 overflow-hidden">

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {messages.map((msg, i) => {
                if (msg.role === "system") return (
                  <div key={i} className="flex justify-center">
                    <div className="px-3 py-1.5 rounded-full text-xs"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                      <MathText>{msg.content}</MathText>
                    </div>
                  </div>
                );

                const isAI = msg.role === "model";

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-3 ${isAI ? 'justify-end' : 'justify-start'}`}
                    style={{ flexDirection: isAI ? 'row' : 'row-reverse' }}
                  >
                    {/* Avatar */}
                    {isAI && (
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                        style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--border-primary)' }}>
                        <Bot size={14} style={{ color: 'var(--color-primary-light)' }} />
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className="max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                      style={isAI ? {
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        borderBottomLeftRadius: '6px',
                      } : {
                        background: 'var(--color-primary-muted)',
                        border: '1px solid var(--border-primary)',
                        color: 'var(--text-primary)',
                        borderBottomRightRadius: '6px',
                      }}
                    >
                      <MathText>{msg.content}</MathText>
                    </div>
                  </motion.div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-3 justify-end">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--border-primary)' }}>
                    <Bot size={14} style={{ color: 'var(--color-primary-light)' }} />
                  </div>
                  <div className="px-4 py-3 rounded-2xl flex items-center gap-1.5"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderBottomLeftRadius: '6px' }}>
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full"
                        style={{ background: 'var(--color-primary-light)' }}
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                        transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Debug sidebar */}
            {showDebug && (
              <div className="w-[360px] overflow-y-auto p-4 flex-shrink-0"
                style={{ borderRight: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.3)' }}>
                <div className="label-mono mb-3" style={{ color: 'var(--color-primary-light)' }}>AI Diagnostics</div>
                {debugInfo ? (
                  <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                ) : (
                  <span className="label-mono" style={{ color: 'var(--text-disabled)' }}>אין נתונים</span>
                )}
              </div>
            )}
          </div>

          {/* ── Input bar ── */}
          <div className="flex-shrink-0 px-5 py-4 flex gap-3"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'rgba(5,11,24,0.7)' }}>
            <input
              type="text"
              className="field flex-1"
              placeholder="כתוב שאלה לפרופסור פאראדיי..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              disabled={isTyping || isAnalyzing}
              style={{ fontSize: '0.95rem' }}
            />
            <button
              className="btn btn-primary flex-shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || isTyping || isAnalyzing}
            >
              <Send size={16} />
              שלח
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

