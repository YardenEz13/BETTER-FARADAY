import {
  createContext, useContext, useCallback, useEffect, useState, lazy, Suspense,
} from "react";
import { useLocation } from "react-router-dom";
import type { AgentType } from "../../services/localAI";

// Both lazy: the tutor ships in its own chunk, downloaded on first open —
// the provider itself lives in the main bundle but weighs nothing until then.
const AIChatPanel = lazy(() => import("../AIChatPanel"));
const MathPlayground = lazy(() => import("../playground/MathPlayground"));

/**
 * FaradayProvider — the single home of the Faraday tutor.
 *
 * The AIChatPanel (and its MathPlayground companion) is mounted exactly once,
 * here. Screens never render the panel themselves; they call `useFaraday()`:
 *
 *   const faraday = useFaraday();
 *   faraday.open({ studentId, agentType: "practice", questionStem, ... });
 *
 * Context rules:
 * - `open(ctx)` replaces the tutor's context with the calling screen's.
 * - `updateContext(patch)` keeps it fresh while open (e.g. next question).
 * - Navigating to a different route closes the panel and clears transient
 *   state, so a homework conversation never leaks into a practice screen.
 */
export interface FaradayContextInfo {
  studentId: string;
  agentType: AgentType;
  questionStem?: string;
  topicName?: string;
  topicId?: string;
  questionId?: string;
}

interface FaradayApi {
  isOpen: boolean;
  open: (ctx: FaradayContextInfo & { requestBridge?: boolean }) => void;
  close: () => void;
  updateContext: (patch: Partial<Omit<FaradayContextInfo, "studentId">>) => void;
}

const Ctx = createContext<FaradayApi | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useFaraday(): FaradayApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useFaraday must be used inside <FaradayProvider>");
  return api;
}

export default function FaradayProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [ctx, setCtx] = useState<FaradayContextInfo | null>(null);
  const [bridgeRequested, setBridgeRequested] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const location = useLocation();

  // One tutor, one context: leaving the screen closes the panel.
  useEffect(() => {
    setIsOpen(false);
    setBridgeRequested(false);
    setPlaygroundOpen(false);
  }, [location.pathname]);

  const open = useCallback((o: FaradayContextInfo & { requestBridge?: boolean }) => {
    const { requestBridge, ...info } = o;
    setCtx(info);
    if (requestBridge) setBridgeRequested(true);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const updateContext = useCallback(
    (patch: Partial<Omit<FaradayContextInfo, "studentId">>) =>
      setCtx((c) => (c ? { ...c, ...patch } : c)),
    []
  );

  return (
    <Ctx.Provider value={{ isOpen, open, close, updateContext }}>
      {children}
      {ctx && (
        <Suspense fallback={null}>
          <AIChatPanel
            isOpen={isOpen}
            onClose={close}
            studentId={ctx.studentId}
            agentType={ctx.agentType}
            questionStem={ctx.questionStem}
            topicName={ctx.topicName}
            topicId={ctx.topicId}
            questionId={ctx.questionId}
            requestBridge={bridgeRequested}
            onBridgeRequestHandled={() => setBridgeRequested(false)}
            onOpenPlayground={() => setPlaygroundOpen(true)}
          />
          <MathPlayground isOpen={playgroundOpen} onClose={() => setPlaygroundOpen(false)} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}
