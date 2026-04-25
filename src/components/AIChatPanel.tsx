import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { X, Send, Bot, BookOpen, Zap, WifiOff, History, MessageSquare, Sparkles, Clock } from "lucide-react";
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
  type AgentType,
  type Message,
  type PartialBrief,
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
  const [selfAssessment, setSelfAssessment] = useState<string | null>(null);
  const [awaitingSelfAssess, setAwaitingSelfAssess] = useState(false);
  const [pendingNextQuestion, setPendingNextQuestion] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatIdRef = useRef<Id<"aiChats"> | null>(null);
  const initGuard = useRef(false);
  const sessionStartedAt = useRef(Date.now());
  const prevQuestionId = useRef(questionId);
  const userMsgCount = useRef(0);

  // Keep ref in sync so callbacks always have current value
  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);

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
    const interval = setInterval(() => setAiStatus(getAIStatus()), 2000);
    return () => clearInterval(interval);
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

  // ── Single unified init/resume flow ──
  useEffect(() => {
    if (!isOpen) {
      initGuard.current = false; // reset guard when panel closes
      return;
    }

    // If we already have messages in state (panel was just hidden, not unmounted), skip re-init
    if (chatId && messages.length > 0) return;

    if (initGuard.current) return; // prevent double-fire from React strict mode / race
    initGuard.current = true;

    const init = async () => {
      // 1. Try local IndexedDB (instant, no network)
      const localSession = await getActiveSession(studentId, agentType);

      if (localSession) {
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
  }, [isOpen, agentType, studentId]);

  const createFreshChat = async () => {
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

    let context = "";
    if (agentType === "practice" && questionStem) {
      context = `נושא: ${topicName}\nשאלה: ${questionStem}`;
    }
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
  };

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
    if (questionId && prevQuestionId.current && questionId !== prevQuestionId.current && cycleState === "active" && messages.length > 1) {
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
    }
    prevQuestionId.current = questionId;
  }, [questionId, cycleState, messages.length, persistMessage]);

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
      let context = "";
      if (agentType === "practice" && questionStem) {
        context = `נושא: ${topicName}\nשאלה: ${questionStem}`;
      }
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

    await createSession(agentType, questionStem ? `נושא: ${topicName}\nשאלה: ${questionStem}` : "");
    setCycleState("active");
  }, [cycleState, messages, sessionIndex, online, agentType, topicName, questionStem, topicId, questionId, studentId, startChat, endChatMut]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput("");

    const newUserMsg: Message = { role: "user", content: userMsg };

    // ── Self-assessment capture ──
    if (awaitingSelfAssess) {
      setSelfAssessment(userMsg);
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

    try {
      const available = await isLocalAIAvailable();
      let finalResponse = "";

      if (available) {
        finalResponse = await streamMessage(userMsg, (partial: string) => {
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
        }, updatedWithUser);
      }

      if (!finalResponse) {
        finalResponse = getMockResponse(userMsg, messages);
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
    } catch (e) {
      console.error("AI error:", e);
      const fallback = "מצטער, נתקלתי בבעיה טכנית. נסה שוב.";
      setMessages((prev) => {
        const updated = [...prev, { role: "model" as const, content: fallback }];
        if (chatIdRef.current) saveMessages(chatIdRef.current, updated).catch(console.error);
        return updated;
      });
      await persistMessage("model", fallback);
    }

    setIsTyping(false);
  };

  // X = minimize (keep session alive for resume)
  const handleMinimize = async () => {
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

  // ── Finalize: generate composite brief + save + cleanup ──
  const finalizeWithBrief = async (selfAssessText: string) => {
    setIsAnalyzing(true);

    try {
      // Generate composite brief
      const brief = await generateCompositeBrief(
        partialBriefs,
        messages,
        selfAssessText
      );

      // End current chat with metrics
      if (chatIdRef.current && online) {
        const metrics = await analyzeConversation(messages);
        await endChatMut({ chatId: chatIdRef.current, metrics });
      }

      // Save the composite brief to Convex
      if (chatIdRef.current && online) {
        await createBriefMut({
          chatId: chatIdRef.current,
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
          selfAssessment: brief.selfAssessment,
        });
      }

      // Show confirmation message briefly
      const confirmMsg: Message = {
        role: "system",
        content: "✨ השיחה נשמרה בהצלחה. תודה!",
      };
      setMessages(prev => [...prev, confirmMsg]);

      // Wait a moment then cleanup
      setTimeout(() => cleanup(), 1500);
    } catch (e) {
      console.error("Failed to generate brief:", e);
      if (online && chatIdRef.current) {
        try { await endChatMut({ chatId: chatIdRef.current }); } catch {}
      }
      await cleanup();
    }
  };

  const finalizeWithBriefAndContinue = async (selfAssessText: string) => {
    setIsAnalyzing(true);
    try {
      const brief = await generateCompositeBrief(
        partialBriefs,
        messages,
        selfAssessText
      );

      if (chatIdRef.current && online) {
        const metrics = await analyzeConversation(messages);
        await endChatMut({ chatId: chatIdRef.current, metrics });
        await createBriefMut({
          chatId: chatIdRef.current,
          studentId: studentId as Id<"students">,
          topicId: topicId ? (topicId as Id<"topics">) : undefined,
          ...brief,
        });
      }

      const confirmMsg: Message = {
        role: "system",
        content: "✨ השיחה נשמרה בהצלחה! מכין את מורה ה-AI לשאלה החדשה...",
      };
      setMessages(prev => [...prev, confirmMsg]);

      setTimeout(async () => {
        setIsAnalyzing(false);
        await clearActiveSession(studentId, agentType);
        setPartialBriefs([]);
        setSessionIndex(0);
        userMsgCount.current = 0;
        setSelfAssessment(null);
        setPendingNextQuestion(false);
        setCycleState("active");
        
        await createFreshChat();
      }, 2000);

    } catch (e) {
      console.error("Failed to generate brief:", e);
      setIsAnalyzing(false);
      setPendingNextQuestion(false);
      setCycleState("active");
      await createFreshChat();
    }
  };

  const cleanup = async () => {
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
                  <span className={`ai-status-dot ${aiStatus}`} title={aiStatus === "ready" ? "מודל AI מקומי פעיל" : "אין תמיכה במודל מקומי"} />
                )}
                {!online && <WifiOff size={12} color="var(--warning)" />}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
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
            {chatHistory?.map((chat) => (
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
            <div key={i} className={`chat-msg ${msg.role}`}>
              {msg.content}
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
            <div className="chat-msg model" style={{ opacity: 0.7, fontStyle: "italic" }}>
              <Sparkles size={14} style={{ display: "inline", marginLeft: 6 }} />
              מנתח את השיחה עם AI... זה ייקח כמה שניות 🔍
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

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
