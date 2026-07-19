import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "../electric";

export type ModalTone = "primary" | "secondary" | "danger";

const ACCENT: Record<ModalTone, string> = {
  primary: "var(--color-primary)",
  secondary: "var(--color-secondary)",
  danger: "var(--color-error)",
};

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title: ReactNode;
  /** Top accent bar + semantic color. */
  tone?: ModalTone;
  /** Action row (usually btn-clay-* buttons). */
  footer?: ReactNode;
  maxWidth?: number;
  children: ReactNode;
}

/**
 * Clay dialog on a Lab-Ink scrim: translucent dark backdrop with blur, a solid
 * clay card with a top accent bar, springy entrance. Closes on Escape and on
 * backdrop click. (Faraday Extras design.)
 */
export default function Modal({ open, onClose, title, tone = "primary", footer, maxWidth = 440, children }: ModalProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === "string" ? title : undefined}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          style={{
            background: "color-mix(in srgb, #0C140E 55%, transparent)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
          dir="rtl"
        >
          <motion.div
            initial={{ y: 14, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 14, scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="clay-card w-full overflow-hidden"
            style={{ maxWidth, padding: 0 }}
          >
            <div style={{ height: 6, background: ACCENT[tone] }} />
            <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-2">
              <h3 className="m-0 font-headline-md text-on-surface" style={{ fontWeight: 800 }}>{title}</h3>
              {onClose && (
                <button
                  onClick={onClose}
                  aria-label="סגור"
                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 hover:text-primary transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="px-6 pt-2 pb-5 font-body-md text-on-surface-variant" style={{ lineHeight: 1.55 }}>
              {children}
            </div>
            {footer && <div className="flex gap-3 px-6 pb-6 justify-start">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
