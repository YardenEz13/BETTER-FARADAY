import { useState, useEffect, useRef, useCallback } from "react";
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
    <>
      <div className="chat-overlay" onClick={handleMinimize} />
      <div className="chat-panel" style={{ display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div className="chat-header">
          <div className="flex items-center gap-3">
            <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "var(--surface-high)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={20} color={agentType === "practice" ? "var(--primary-dim)" : "#818cf8"} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1rem" }}> מייקל פאראדיי  🤖</div>
              <div className="flex items-center gap-2">
                <span className={`chat-agent-badge ${agentType}`}>
                  {agentType === "practice" ? <><Zap size={10} /> תרגול</> : <><BookOpen size={10} /> שיעורי בית</>}
                </span>
                {isResumed && (
                  <span style={{ fontSize: "0.7rem", color: "var(--primary-dim)", display: "flex", alignItems: "center", gap: 3, background: "var(--primary-alpha)", padding: "1px 6px", borderRadius: 6 }}>
                    <Clock size={9} /> ממשיך שיחה
                  </span>
                )}
                {aiStatus === "downloading" ? (
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <div className="typing-dot" style={{ width: 6, height: 6 }} />
                    {loadProgress ? `${loadProgress.stage} ${loadProgress.percent}%` : "טוען מודל..."}
                  </span>
                ) : (
                  <span className={`ai-status-dot ${aiStatus}`} title={aiStatus === "ready" ? "עוזר AI פעיל (Gemini)" : "אין חיבור לעוזר AI"} />
                )}
                {!online && <WifiOff size={12} color="var(--warning)" />}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowDebug(v => !v)}
              title="קונסולת פיתוח AI"
              style={{ background: showDebug ? "rgba(16,185,129,0.12)" : "transparent", border: "none", color: showDebug ? "#10b981" : "var(--text-muted)", cursor: "pointer", padding: 8, borderRadius: "var(--r-sm)", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 3 }}
            >
              <Terminal size={15} />
            </button>
            <button
              onClick={() => setShowHistory((v) => !v)}
              title="היסטוריית שיחות"
              style={{ background: showHistory ? "var(--primary-alpha)" : "transparent", border: "none", color: showHistory ? "var(--primary-dim)" : "var(--text-muted)", cursor: "pointer", padding: 8, borderRadius: "var(--r-sm)", transition: "all 0.2s" }}
            >
              <History size={16} />
            </button>
            <button
              onClick={handleEndChat}
              disabled={isAnalyzing || messages.length <= 1}
              title="סיים שיחה ושמור תובנות"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: isAnalyzing ? "var(--primary-dim)" : "var(--text-muted)", cursor: "pointer", padding: "5px 10px", borderRadius: "var(--r-sm)", fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, transition: "all 0.2s" }}
            >
              {isAnalyzing ? (
                <><div className="typing-dot" style={{ width: 5, height: 5 }} /> מנתח...</>
              ) : (
                <><Sparkles size={11} /> סיים ושמור</>
              )}
            </button>
            <button onClick={handleMinimize} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 8 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* History Sidebar */}
        {showHistory && (
          <div style={{ borderBottom: "1px solid var(--surface-highest)", padding: "8px 16px", maxHeight: 220, overflowY: "auto", background: "var(--surface)" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-faint)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>שיחות קודמות</div>
            {!chatHistory && (
              <div style={{ color: "var(--text-faint)", fontSize: "0.8rem", padding: "8px 0" }}>טוען...</div>
            )}
            {chatHistory?.length === 0 && (
              <div style={{ color: "var(--text-faint)", fontSize: "0.8rem", padding: "8px 0" }}>אין שיחות קודמות</div>
            )}
            {chatHistory?.map((chat: Doc<"aiChats">) => (
              <div
                key={chat._id}
                onClick={() => handleResumeHistoryChat(chat._id)}
                style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", cursor: "pointer", marginBottom: 4, background: chat._id === chatId ? "var(--primary-alpha)" : "var(--surface-high)", border: chat._id === chatId ? "1px solid var(--primary-alpha)" : "1px solid transparent", transition: "all 0.15s" }}
              >
                <div className="flex justify-between items-center">
                  <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text)" }}>
                    <MessageSquare size={10} style={{ display: "inline", marginLeft: 4 }} />
                    {chat.title}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-faint)" }}>
                    {chat.endedAt ? "✅ הסתיים" : "🟢 פתוח"}
                  </div>
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {chat.messageCount} הודעות · {formatTime(chat.startedAt)}
                  {chat.metrics?.sentiment && (
                    <span style={{ marginRight: 8 }}>
                      {chat.metrics.sentiment === "frustrated" ? "😟" : chat.metrics.sentiment === "confident" ? "😊" : "😐"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Context chips */}
        {(topicName || questionStem) && !showHistory && (
          <div style={{ padding: "8px 24px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {topicName && <span className="context-chip">📐 {topicName}</span>}
            {questionStem && (
              <span className="context-chip" style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ❓ {questionStem.slice(0, 40)}...
              </span>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="chat-messages" style={{ flex: 1 }}>
          {messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.role === "model" ? "assistant" : msg.role}`}>
              <MathText>{msg.content}</MathText>
            </div>
          ))}
          {isTyping && (
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          )}
          {isAnalyzing && (
            <div className="chat-msg assistant" style={{ opacity: 0.7, fontStyle: "italic" }}>
              <Sparkles size={14} style={{ display: "inline", marginLeft: 6 }} />
              מנתח את השיחה עם AI... זה ייקח כמה שניות 🔍
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* AI Debug Console */}
        {showDebug && (
          <div style={{
            borderTop: "1px solid rgba(16,185,129,0.15)",
            background: "#0a0f0a",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: "0.7rem",
            maxHeight: 340,
            overflowY: "auto",
            direction: "ltr",
          }}>
            {/* Header bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", background: "rgba(16,185,129,0.08)", borderBottom: "1px solid rgba(16,185,129,0.12)", position: "sticky", top: 0, zIndex: 1 }}>
              <span style={{ color: "#10b981", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <Terminal size={11} /> AI DEBUG CONSOLE
              </span>
              {debugInfo?.isGenerating && (
                <span style={{ color: "#f59e0b", animation: "pulse 1s infinite" }}>⟳ GENERATING…</span>
              )}
              {!debugInfo?.isGenerating && debugInfo && debugInfo.chunkCount > 0 && (
                <span style={{ color: "#6b7280" }}>✓ {debugInfo.chunkCount} chunks</span>
              )}
            </div>

            {/* API & Model */}
            <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.6rem" }}>API & MODEL</div>
              <div style={{ color: "#10b981" }}>
                🌐 Google Gemini 3.1 Flash Lite → 2.5 Flash Lite → 2.5 Flash (API)
              </div>
              <div style={{ color: "#9ca3af", marginTop: 2 }}>max_tokens: {debugInfo?.generationParams?.max_tokens ?? 1024}</div>
              <div style={{ color: "#9ca3af" }}>temp: {debugInfo?.generationParams?.temperature ?? 0.3}</div>
            </div>

            {/* Token Stats */}
            <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.6rem" }}>TOKEN STATS</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span style={{ color: "#818cf8" }}>📊 Prompt: ~<b style={{ color: "#a5b4fc" }}>{debugInfo?.promptTokenEstimate ?? 0}</b> tokens</span>
                <span style={{ color: "#818cf8" }}>📝 History: <b style={{ color: "#a5b4fc" }}>{debugInfo?.historyLength ?? 0}</b> msgs</span>
                <span style={{ color: debugInfo?.wasCompacted ? "#f59e0b" : "#6b7280" }}>🗜 Compacted: {debugInfo?.wasCompacted ? "YES" : "no"}</span>
                <span style={{ color: "#818cf8" }}>⟲ Chunks: <b style={{ color: "#a5b4fc" }}>{debugInfo?.chunkCount ?? 0}</b></span>
              </div>
            </div>

            {/* Think Block */}
            {(debugInfo?.thinkBlock || debugInfo?.isGenerating) && (
              <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.6rem" }}>
                  🧠 THINKING BLOCK {debugInfo?.isGenerating && !debugInfo?.visibleResponse ? "(live stream)" : "(complete)"}
                </div>
                <pre style={{
                  color: "#fbbf24",
                  background: "rgba(251,191,36,0.04)",
                  padding: "8px",
                  borderRadius: 6,
                  border: "1px solid rgba(251,191,36,0.1)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 160,
                  overflowY: "auto",
                  margin: 0,
                  fontSize: "0.68rem",
                }}>{debugInfo?.thinkBlock || "(ממתין לחשיבה...)"}</pre>
              </div>
            )}

            {/* Visible Response */}
            {debugInfo?.visibleResponse && (
              <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.6rem" }}>✅ VISIBLE RESPONSE</div>
                <pre style={{ color: "#34d399", background: "rgba(52,211,153,0.04)", padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(52,211,153,0.1)", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontSize: "0.68rem" }}>{debugInfo.visibleResponse}</pre>
              </div>
            )}

            {/* ChatML Prompt Dump */}
            {debugInfo?.promptMessages && (
              <div style={{ padding: "8px 12px" }}>
                <div style={{ color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.6rem" }}>📋 CHATML PROMPT DUMP ({debugInfo.promptMessages.length} messages)</div>
                <pre style={{
                  color: "#9ca3af",
                  background: "rgba(255,255,255,0.02)",
                  padding: "8px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.06)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 280,
                  overflowY: "auto",
                  margin: 0,
                  fontSize: "0.65rem",
                }}>{JSON.stringify(debugInfo.promptMessages, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div className="chat-input-bar">
          <input
            type="text"
            placeholder={agentType === "practice" ? "שאל על השאלה הנוכחית..." : "שאל כל שאלה במתמטיקה..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isTyping || isAnalyzing}
          />
          <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim() || isTyping || isAnalyzing}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
