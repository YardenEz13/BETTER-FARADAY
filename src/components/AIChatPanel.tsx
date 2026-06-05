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
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 w-full h-[65vh] z-[100] border-t-2 border-[var(--neon-emerald)] flex flex-col backdrop-blur-3xl bg-[rgba(2,8,5,0.92)] shadow-[0_-10px_40px_rgba(0,255,136,0.15)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--neon-emerald)] shadow-[0_2px_10px_rgba(0,255,136,0.1)]">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Bot size={32} className="text-[var(--acid-green)]" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[var(--neon-emerald)] rounded-full animate-pulse border-2 border-[var(--bg-deep)]"></div>
              </div>
              <div>
                <div className="font-mono text-2xl text-[var(--neon-emerald)] font-bold tracking-widest">FARADAY_AI_UPLINK</div>
                <div className="flex gap-2 mt-1">
                  <div className="text-[10px] font-mono px-2 py-0.5 bg-[var(--bg-panel)] border border-[var(--laser-cyan)] text-[var(--laser-cyan)] tracking-wider">
                    SYS: ONLINE
                  </div>
                  {aiStatus === "downloading" && (
                     <div className="text-[10px] font-mono px-2 py-0.5 bg-[var(--bg-panel)] border border-[var(--warning-amber)] text-[var(--warning-amber)] tracking-wider animate-pulse">
                       {loadProgress ? `DOWNLOADING... ${loadProgress.percent}%` : "SYNCING MODEL..."}
                     </div>
                  )}
                  {isAnalyzing && (
                    <div className="text-[10px] font-mono px-2 py-0.5 bg-[var(--bg-panel)] border border-[var(--neon-emerald)] text-[var(--neon-emerald)] tracking-wider animate-pulse">
                      ANALYZING_TELEMETRY...
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <button onClick={() => setShowDebug(v => !v)} className="font-mono text-[10px] text-[var(--text-muted)] hover:text-[var(--neon-emerald)] transition-colors">
                [ TOGGLE_DEBUG ]
              </button>
              <button onClick={handleEndChat} disabled={isAnalyzing || messages.length <= 1} className="font-mono text-[10px] text-[var(--warning-amber)] hover:text-white transition-colors">
                [ TERMINATE_SESSION ]
              </button>
              <button onClick={handleMinimize} className="text-[var(--danger-crimson)] hover:text-white transition-colors ml-4">
                <X size={28} />
              </button>
            </div>
          </div>
          
          <div className="flex flex-1 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-8 font-mono flex flex-col gap-6 text-lg relative">
              {messages.map((msg, i) => (
                 <div key={i} className={`max-w-[85%] p-5 text-xl leading-relaxed ${msg.role === "model" ? "self-start border-l-4 border-[var(--acid-green)] text-[var(--neon-emerald)] bg-[rgba(180,255,0,0.05)]" : "self-end border-r-4 border-[var(--laser-cyan)] text-white bg-[rgba(0,240,255,0.08)]"}`}>
                   <MathText>{msg.content}</MathText>
                 </div>
              ))}
              {isTyping && <div className="text-[var(--acid-green)] animate-pulse border-l-4 border-[var(--acid-green)] p-5 self-start bg-[rgba(180,255,0,0.05)]">PROCESSING_DATA_STREAM...</div>}
              <div ref={messagesEndRef} />
            </div>

            {/* Debug Sidebar (if open) */}
            {showDebug && (
              <div className="w-[400px] border-r border-[var(--neon-emerald)] bg-[#010402] overflow-y-auto p-4 font-mono text-xs text-[var(--text-muted)]">
                <div className="text-[var(--laser-cyan)] font-bold mb-4">-- AI DIAGNOSTICS --</div>
                {debugInfo && (
                  <pre className="whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-6 border-t border-[var(--neon-emerald)] flex gap-6 bg-[var(--bg-deep)]">
            <input
              type="text"
              className="flex-1 bg-[rgba(0,255,136,0.05)] border border-[var(--neon-emerald)] px-6 py-4 text-xl text-[var(--neon-emerald)] font-mono outline-none focus:shadow-[var(--glow-emerald)] placeholder:text-[rgba(0,255,136,0.3)] transition-all"
              placeholder="ENTER_COMMAND_OR_QUERY..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={isTyping || isAnalyzing}
            />
            <button className="cyber-btn !px-8 !text-lg" onClick={handleSend} disabled={!input.trim() || isTyping || isAnalyzing}>
              [ TRANSMIT ] <Send size={20} className="ml-2" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
