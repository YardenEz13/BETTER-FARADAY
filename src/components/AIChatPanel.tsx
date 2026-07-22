import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { X, ChevronDown, Copy, Check } from "./electric";
import { log } from "../lib/logger";
import {
  isLocalAIAvailable,
  getAIStatus,
  createSession,
  destroySession,
  setActiveStudentId,
  streamMessage,
  checkNotebookImage,
  analyzeConversation,
  generateCompositeBrief,
  getMockResponse,
  estimateTokens,
  heuristicSummary,
  type AgentType,
  type Message,
  type PartialBrief,
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
import FaradayMoodAvatar, { type FaradayMood } from "./FaradayMoodAvatar";
import QRBridgeModal from "./QRBridgeModal";
import FaradayConsole from "./chat/FaradayConsole";
import { errorMessage } from "../lib/errors";

// Adaptive-help stages, mirrored from the tutor's escalation levels (localAI.ts).
const HELP_STAGES = [
  { label: "רמז", color: "var(--color-primary)" },
  { label: "הסבר", color: "var(--color-secondary)" },
  { label: "דוגמה", color: "var(--color-tertiary)" },
  { label: "פתרון", color: "var(--color-error)" },
] as const;

/** Compact meter in the chat header showing how much help Faraday is giving right now. */
function HelpLevelMeter({ level }: { level: number }) {
  const lvl = Math.max(0, Math.min(3, level));
  return (
    <div className="flex items-center gap-2" title="רמת העזרה עולה ככל שנתקעים באותה שאלה">
      <span className="font-label-md text-on-surface-variant" style={{ fontSize: 11 }}>עזרה</span>
      <div className="flex items-center gap-1">
        {HELP_STAGES.map((s, i) => {
          const on = i <= lvl;
          return (
            <span
              key={s.label}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === lvl ? 18 : 8,
                height: 8,
                background: on ? s.color : "var(--color-outline)",
                boxShadow: i === lvl ? `0 0 8px ${s.color}` : "none",
              }}
            />
          );
        })}
      </div>
      <span className="font-label-md font-bold" style={{ fontSize: 11, color: HELP_STAGES[lvl].color }}>
        {HELP_STAGES[lvl].label}
      </span>
    </div>
  );
}

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
  const [aiStatus, setAiStatus] = useState<"ready" | "unavailable">("unavailable");
  const [chatId, setChatId] = useState<Id<"aiChats"> | null>(null);
  const [online, setOnline] = useState(isOnline());
  const [, setIsResumed] = useState(false);
  // lg+ → the panel docks as a side column beside the question; below that it stays
  // a bottom sheet. Drives both the entrance animation axis and the layout classes.
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );

  // Session Cycling state
  const [cycleState, setCycleState] = useState<"active" | "cycling" | "self_assess">("active");
  const [sessionIndex, setSessionIndex] = useState(0);
  const [partialBriefs, setPartialBriefs] = useState<PartialBrief[]>([]);
  const [awaitingSelfAssess, setAwaitingSelfAssess] = useState(false);
  const [pendingNextQuestion, setPendingNextQuestion] = useState(false);
  const [, setSelfAssessment] = useState<string | null>(null);

  // Notebook image-check state
  const [attachedImage, setAttachedImage] = useState<PreparedImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showQRBridge, setShowQRBridge] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyMessage = useCallback((text: string, idx: number) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1600);
    }).catch(() => {});
  }, []);

  const currentContext = questionStem
    ? (topicName ? `נושא: ${topicName}\nשאלה: ${questionStem}` : `שאלה: ${questionStem}`)
    : "";

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatIdRef = useRef<Id<"aiChats"> | null>(null);
  const initGuard = useRef(false);
  const sessionStartedAt = useRef(Date.now());
  const lastValidQuestionIdRef = useRef(questionId);
  const userMsgCount = useRef(0);
  // Adaptive help: how stuck the student is on the CURRENT question (0-3). Reset on
  // every new question; drives Faraday's escalation hint → concept → example → solution.
  const struggleRef = useRef(0);
  const stuckStreakRef = useRef(0); // consecutive stuck-signal messages since the last escalation
  const [helpLevel, setHelpLevel] = useState(0); // mirror of struggleRef for the UI meter
  const isSendingRef = useRef(false);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // ── Faraday mood (visual only): thinking while a response streams/pends,
  //    a brief happy flash when one lands, idle otherwise. ──
  const [happyFlash, setHappyFlash] = useState(false);
  const prevTypingRef = useRef(false);
  useEffect(() => {
    if (prevTypingRef.current && !isTyping) {
      setHappyFlash(true);
      const t = setTimeout(() => setHappyFlash(false), 1500);
      prevTypingRef.current = isTyping;
      return () => clearTimeout(t);
    }
    prevTypingRef.current = isTyping;
  }, [isTyping]);
  const faradayMood: FaradayMood = isTyping ? "thinking" : happyFlash ? "happy" : "idle";

  // Keep ref in sync so callbacks always have current value
  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);

  // Forward studentId to localAI so the Gemini proxy can rate-limit per student.
  useEffect(() => { setActiveStudentId(studentId); }, [studentId]);

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

  // Track AI status. The tutor is a server-side Gemini call, so the only two
  // states are "ready" and "unavailable" — no download progress to poll for.
  useEffect(() => {
    setAiStatus(getAIStatus());
  }, []);

  // External trigger (e.g. from the homework question) to open the phone-photo bridge
  useEffect(() => {
    if (requestBridge && isOpen) {
      setShowQRBridge(true);
      onBridgeRequestHandled?.();
    }
  }, [requestBridge, isOpen, onBridgeRequestHandled]);

  // Track viewport → dock (desktop) vs bottom sheet (mobile)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
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
      struggleRef.current = 0; stuckStreakRef.current = 0; setHelpLevel(0); // fresh question → back to gentle hints
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
      createSession(agentType, currentContext);
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
            struggleRef.current = 0; stuckStreakRef.current = 0; setHelpLevel(0);
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
    struggleRef.current = 0; stuckStreakRef.current = 0; setHelpLevel(0);
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
      setImageError(errorMessage(err, "לא ניתן לטעון את התמונה."));
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

  const handleSend = async (overrideText?: string) => {
    const raw = (overrideText ?? input).trim();
    if (!raw || isTyping || isSendingRef.current) return;
    isSendingRef.current = true;

    try {
      const userMsg = raw;
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

      // ── Adaptive help escalation ──
      // Raise the help level only when the student is STILL stuck after already
      // getting help on this question — a first message that happens to contain
      // "לא הבנתי" (e.g. a starter prompt) should not skip straight past the hint
      // level. Escalate on a repeated stuck signal (not a single one), with a slow
      // turn-based floor as a backstop for long, unproductive back-and-forth.
      {
        const explicitAsk = /פשוט תגיד|תגיד לי את התשובה|תן לי את התשובה|מה התשובה|תפתור לי|פתור לי|just tell|show me the answer/i.test(userMsg);
        const stuckSignal = /לא הבנתי|לא מבין|לא יודע|תעזור|עזור לי|לא מצליח|עדיין לא|תקוע|לא ברור|קשה לי|מבולבל/.test(userMsg);
        const turns = userMsgCount.current; // already incremented above; 1 = first message

        if (explicitAsk) {
          struggleRef.current = 3;
        } else if (turns === 1) {
          // First message never escalates on its own — Faraday always starts at a hint.
          stuckStreakRef.current = stuckSignal ? 1 : 0;
        } else {
          stuckStreakRef.current = stuckSignal ? stuckStreakRef.current + 1 : 0;
          // Two stuck messages in a row (after already receiving help) → bump one level.
          if (stuckStreakRef.current >= 2) {
            struggleRef.current += 1;
            stuckStreakRef.current = 0;
          }
          // Slow backstop for long threads that never explicitly say "stuck".
          if (turns >= 10) struggleRef.current = Math.max(struggleRef.current, 3);
          else if (turns >= 7) struggleRef.current = Math.max(struggleRef.current, 2);
          else if (turns >= 4) struggleRef.current = Math.max(struggleRef.current, 1);
        }
        struggleRef.current = Math.min(3, struggleRef.current);
        setHelpLevel(struggleRef.current);
      }

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
            { agentType, questionContext: currentContext, struggleLevel: struggleRef.current as 0 | 1 | 2 | 3 }  // fresh context + adaptive help level
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
    struggleRef.current = 0; stuckStreakRef.current = 0; setHelpLevel(0);
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
    struggleRef.current = 0; stuckStreakRef.current = 0; setHelpLevel(0);
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
            initial={isDesktop ? { x: "100%", opacity: 0 } : { y: "100%", opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={isDesktop ? { x: "100%", opacity: 0 } : { y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
            className="fixed z-[100] flex flex-col font-body-md overflow-hidden border-outline
              bottom-0 left-0 w-full h-[62vh] rounded-t-[24px] border-t-2
              lg:top-[68px] lg:bottom-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[min(440px,42vw)] lg:rounded-none lg:border-t-0 lg:border-e-2"
            style={{
              background: 'var(--color-background)',
              boxShadow: isDesktop
                ? '-6px 0 28px rgba(20,40,30,0.10)'
                : '0 -10px 34px rgba(20,40,30,0.14)',
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
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, color-mix(in srgb, var(--color-inverse-primary) 1.5%, transparent) 2px, color-mix(in srgb, var(--color-inverse-primary) 1.5%, transparent) 4px)',
              }}
              aria-hidden
            />
            {/* ── Header ── */}
            <div className="flex flex-col flex-shrink-0 bg-surface border-b-2 border-outline relative z-[2]">
              <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-2 md:py-3">
                {/* AI identity */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-primary-container/20 border-2 border-primary flex items-center justify-center shadow-[0_0_15px_color-mix(in_srgb,var(--color-inverse-primary)_25%,transparent)]">
                      <FaradayMoodAvatar mood={faradayMood} px={48} fill />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-surface animate-pulse shadow-[0_0_8px_color-mix(in_srgb,var(--color-inverse-primary)_60%,transparent)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-headline-md text-on-surface truncate" style={{ textShadow: '0 0 10px color-mix(in srgb, var(--color-inverse-primary) 8%, transparent)' }}>
                      פרופסור פאראדיי
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
                      <span className="font-label-md text-primary truncate" style={{ fontSize: '11px' }}>
                        {aiStatus === "unavailable"
                          ? "פאראדיי לא זמין כרגע"
                          : isAnalyzing
                          ? "מנתח שיחה..."
                          : cycleState === "cycling"
                          ? "מחדש הקשר..."
                          : "⚡ העוזר האישי שלך למתמטיקה"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={handleEndChat}
                    disabled={isAnalyzing || messages.length <= 1}
                    title="סיום שיחה"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-outline-variant rounded-lg font-label-lg text-on-surface-variant hover:bg-surface-variant transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="hidden lg:inline">סיום שיחה</span>
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

              {/* Adaptive help meter — own row so it never fights the identity/actions for space
                  in the narrow desktop dock or on small phones. */}
              {agentType !== "proof" && (
                <div className="flex items-center px-4 md:px-6 pb-2 -mt-1">
                  <HelpLevelMeter level={helpLevel} />
                </div>
              )}
            </div>

            {/* Live wire — current flowing through the circuit, right under the header (1d Clay signature) */}
            <svg
              viewBox="0 0 392 4" width="100%" height="4" preserveAspectRatio="none"
              className="block flex-shrink-0 relative z-[2]" aria-hidden
            >
              <line
                x1="0" y1="2" x2="392" y2="2"
                stroke="var(--color-primary)" strokeWidth="2"
                strokeDasharray="6 10" strokeLinecap="round" opacity="0.7"
                className="wire-current-path"
              />
            </svg>

            {/* ── Body: messages + optional debug ── */}
            <div className="flex flex-1 overflow-hidden relative">

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-5 py-6 flex flex-col gap-5 scroll-smooth z-10">

                {/* Context Header */}
                {topicName && (
                  <div className="text-center mb-2">
                    <span className="inline-block bg-tertiary-container text-on-tertiary-container font-label-sm px-4 py-1.5 rounded-full">
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
                      <div className="w-16 h-16 rounded-full bg-primary-container/20 border-2 border-primary flex items-center justify-center overflow-hidden shadow-[0_0_24px_color-mix(in_srgb,var(--color-inverse-primary)_30%,transparent)]">
                        <FaradayAvatar px={64} fill />
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary border-2 border-surface animate-pulse" />
                    </div>
                    <div>
                      <div className="font-headline-md text-on-surface mb-1">שלום, אני פרופסור פאראדיי ⚡</div>
                      <div className="font-body-md text-on-surface-variant max-w-[22rem] mx-auto">
                        {agentType === "practice"
                          ? `כאן כדי לעזור לך לפצח את ${topicName || "השאלה"} — מתחילים ברמז, ואם עדיין תקוע נעמיק יחד עד שיהיה ברור.`
                          : "כאן כדי ללוות אותך בשיעורי הבית, שלב אחר שלב. שאל אותי כל דבר."}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-[30rem]">
                      {starterPrompts.map((s) => (
                        <button key={s} onClick={() => handleSend(s)} className="chip-btn rounded-full">
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
                  // Group consecutive same-role bubbles: avatar + full radius only
                  // on the first of the run, tighter gap inside the run.
                  const prev = messages[i - 1];
                  const firstOfGroup = !prev || prev.role !== msg.role;

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, type: "spring", stiffness: 200, damping: 20 }}
                      className={`flex gap-3 w-full max-w-4xl ${isAI ? 'mr-auto' : 'ml-auto flex-row-reverse'} ${firstOfGroup ? '' : '-mt-3'}`}
                    >
                      {/* Avatar — Faraday only, on the first bubble of a run (1d Clay: student has no avatar) */}
                      {isAI && (
                        <div className="w-9 flex-shrink-0">
                          {firstOfGroup && (
                            <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden bg-surface-bright border-2 border-primary glow-primary">
                              <FaradayAvatar px={36} fill />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bubble — clay surface with an electric edge (AI) / solid primary (student) */}
                      <div
                        className="px-4 py-3 relative group"
                        style={{
                          maxWidth: '85%',
                          borderRadius: isAI
                            ? (firstOfGroup ? '22px 22px 22px 7px' : '22px')
                            : (firstOfGroup ? '22px 22px 7px 22px' : '22px'),
                          border: isAI
                            ? '2px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-outline))'
                            : '2px solid transparent',
                          background: isAI ? 'var(--color-surface)' : 'var(--color-primary)',
                          color: isAI ? 'var(--color-on-surface)' : 'var(--color-on-primary)',
                          boxShadow: isAI ? 'var(--shadow-clay)' : 'var(--shadow-clay-primary)',
                        }}
                      >
                        {isAI && (
                          <button
                            onClick={() => copyMessage(msg.content, i)}
                            title={copiedIdx === i ? "הועתק!" : "העתק"}
                            className={`absolute top-1.5 left-1.5 p-1.5 rounded-lg border border-outline-variant bg-surface transition-all z-10 ${
                              copiedIdx === i ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-primary'
                            }`}
                          >
                            {copiedIdx === i ? <Check size={15} /> : <Copy size={15} />}
                          </button>
                        )}
                        {msg.imageUrl && (
                          <img
                            src={msg.imageUrl}
                            alt="המחברת שצולמה"
                            className="rounded-xl mb-3 max-h-72 w-auto border border-outline/40 shadow-md"
                          />
                        )}
                        <div className="leading-relaxed" style={{ color: 'inherit' }}>
                          <MathText>{msg.content}</MathText>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex gap-3 w-full max-w-4xl mr-auto">
                    <div className="w-9 h-9 rounded-full bg-surface-bright border-2 border-primary glow-primary flex-shrink-0 flex items-center justify-center overflow-hidden">
                      <FaradayAvatar px={36} fill />
                    </div>
                    <div
                      className="flex items-center gap-2.5 px-4 py-3"
                      style={{
                        borderRadius: '22px',
                        border: '2px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-outline))',
                        background: 'var(--color-surface)',
                        boxShadow: 'var(--shadow-clay)',
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-[7px] h-[7px] rounded-full bg-primary chat-tdot" />
                        <span className="w-[7px] h-[7px] rounded-full bg-primary chat-tdot" style={{ animationDelay: '.15s' }} />
                        <span className="w-[7px] h-[7px] rounded-full bg-primary chat-tdot" style={{ animationDelay: '.3s' }} />
                      </span>
                      <span className="font-label-md text-on-surface-variant" style={{ fontSize: '12px' }}>
                        פאראדיי חושב…
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} className="h-4" />
              </div>

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

            {/* AI output is model-generated and can be wrong — say so where the
                student is actually reading it, not only in the terms page. */}
            <p className="px-4 pb-2 text-center text-[11px] font-medium text-on-surface-variant opacity-70">
              פאראדיי הוא AI ויכול לטעות — כדאי לבדוק, ובמקרה של ספק לשאול את המורה.
            </p>
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


