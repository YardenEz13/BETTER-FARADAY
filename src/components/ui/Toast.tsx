import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ElectricBolt, ElectricAtom, Lightbulb, SignalWave, X } from "../electric";

export type ToastKind = "success" | "info" | "streak" | "error";

export interface ToastData {
  id: number;
  kind: ToastKind;
  title: ReactNode;
  description?: ReactNode;
}

/** Accent + electric icon per kind — the Faraday personality layer. */
const KINDS: Record<ToastKind, { accent: string; icon: ReactNode }> = {
  success: { accent: "var(--color-primary)", icon: <ElectricBolt size={22} glow={0.5} animated={false} /> },
  info: { accent: "var(--color-secondary)", icon: <ElectricAtom size={22} glow={0.5} tone="violet" animated={false} /> },
  streak: { accent: "var(--color-tertiary)", icon: <Lightbulb size={22} glow={0.5} tone="amber" animated={false} /> },
  error: { accent: "var(--color-error)", icon: <SignalWave size={22} glow={0.5} tone="danger" animated={false} /> },
};

function ToastChip({ toast, onDismiss }: { toast: ToastData; onDismiss?: (id: number) => void }) {
  const k = KINDS[toast.kind] ?? KINDS.success;
  return (
    <motion.div
      layout
      initial={{ y: 10, scale: 0.95, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      exit={{ y: 6, scale: 0.95, opacity: 0 }}
      transition={{ type: "spring", damping: 24, stiffness: 380 }}
      role="status"
      className="flex items-center gap-3 bg-surface border-2 border-outline rounded-2xl px-4 py-3 font-body-md"
      style={{
        borderInlineStart: `6px solid ${k.accent}`,
        boxShadow: "var(--shadow-clay)",
        minWidth: 280,
        maxWidth: 380,
      }}
    >
      <div
        className="flex-shrink-0 grid place-items-center w-9 h-9 rounded-full"
        style={{ background: `color-mix(in srgb, ${k.accent} 12%, var(--color-surface))` }}
        aria-hidden
      >
        {k.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-on-surface" style={{ fontWeight: 800, fontSize: "0.95rem" }}>{toast.title}</div>
        {toast.description && (
          <div className="text-on-surface-variant" style={{ fontSize: "0.85rem", marginTop: 2 }}>{toast.description}</div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="סגור"
          className="flex-shrink-0 grid place-items-center p-1 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </motion.div>
  );
}

/** Fixed, centered stack of clay toast chips (newest at the edge). */
export function ToastStack({
  toasts,
  onDismiss,
  position = "bottom",
}: {
  toasts: ToastData[];
  onDismiss?: (id: number) => void;
  position?: "top" | "bottom";
}) {
  return (
    <div
      className={`fixed z-[300] flex gap-2.5 ${position === "top" ? "top-6 flex-col" : "bottom-6 flex-col-reverse"}`}
      style={{ insetInlineStart: "50%", transform: "translateX(50%)" }}
      dir="rtl"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastChip key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Toast state hook: `push` adds a toast that auto-dismisses after `ttlMs`.
 *
 *   const { toasts, push, dismiss } = useToasts();
 *   push("success", "תשובה נכונה! ✓", "+20 XP");
 *   <ToastStack toasts={toasts} onDismiss={dismiss} />
 */
export function useToasts(ttlMs = 4500) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: ReactNode, description?: ReactNode) => {
      const id = ++idRef.current;
      setToasts((ts) => [...ts, { id, kind, title, description }]);
      window.setTimeout(() => dismiss(id), ttlMs);
    },
    [dismiss, ttlMs],
  );

  return { toasts, push, dismiss };
}
