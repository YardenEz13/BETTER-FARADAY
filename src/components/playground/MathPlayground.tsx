import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sigma, ChevronDown, BookOpen } from "../electric";
import FaradayCanvas from "../FaradayCanvas";
import MathText from "../MathText";
import ExprBoard from "./ExprBoard";
import FormulaDrawer from "./FormulaDrawer";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** The question the student is on. The playground covers 86vh of a phone, so
   *  without this the question it exists to solve is off-screen behind it. */
  questionStem?: string;
}

/**
 * Math Playground — the slide-up "no pen & paper" workspace.
 *
 * One board, and the board is lego: every term of the equation is a brick you
 * pick up and drop on the other side of the equals, where it lands inverted and
 * already merged. No operation tray, no keyboard, no tool to choose — the whole
 * interface is "move a brick", which is what makes it work one-handed on a bus.
 *
 * Reuses the AIChatPanel slide-up motion + a FaradayCanvas backdrop. Lazily
 * imported, so nothing here rides in the main bundle.
 */
export default function MathPlayground({ isOpen, onClose, questionStem }: Props) {
  // Collapsed by default: the board is what the student came for, and a long
  // stem would eat it. One tap re-reads the question without leaving.
  const [stemOpen, setStemOpen] = useState(false);
  // The formula sheet is reference, not part of the flow — it stays shut until
  // asked for, so the board never shares the screen with it uninvited.
  const [formulasOpen, setFormulasOpen] = useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 220 }}
          className="fixed bottom-0 left-0 w-full z-[110] flex flex-col font-body-md shadow-2xl overflow-hidden h-[86vh] md:h-[64vh]"
          style={{
            background: "var(--color-surface)",
            borderTop: "2px solid var(--color-outline-variant)",
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
          }}
          dir="rtl"
        >
          {/* Backdrop animation */}
          <div className="absolute inset-0 z-0 opacity-60 pointer-events-none" aria-hidden>
            <FaradayCanvas variant="circuit" />
          </div>

          {/* Mobile drag indicator */}
          <div className="md:hidden w-full flex justify-center pt-3 pb-1 relative z-[2]">
            <div className="w-10 h-1.5 rounded-full bg-outline-variant/60" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 md:px-6 py-2.5 flex-shrink-0 bg-surface-container-lowest/80 backdrop-blur-sm border-b border-outline-variant/60 relative z-[2]">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-primary-container/20 border-2 border-primary flex items-center justify-center shadow-[0_0_15px_rgba(91,255,159,0.2)]">
                <Sigma size={20} className="text-primary" />
              </span>
              <div>
                <div className="font-headline-md text-on-surface">מגרש המתמטיקה</div>
                <div className="font-label-md text-on-surface-variant" style={{ fontSize: "11px" }}>
                  הרימו לבנה, העבירו לצד השני
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFormulasOpen((v) => !v)}
                aria-pressed={formulasOpen}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  formulasOpen
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:bg-surface-variant/50 hover:text-primary"
                }`}
                title="נוסחאות"
              >
                <BookOpen size={19} />
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 hover:text-primary transition-colors"
                title="סגור"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* The question being solved — collapsible, so it costs one line when shut */}
          {questionStem && (
            <div className="px-4 pt-2 relative z-[2] flex-shrink-0">
              <button
                onClick={() => setStemOpen((v) => !v)}
                aria-expanded={stemOpen}
                className="w-full flex items-center gap-2 rounded-xl border-2 border-outline-variant/60 bg-surface-container-lowest/80 px-3 py-2 text-start"
              >
                <ChevronDown
                  size={16}
                  className={`text-primary flex-shrink-0 transition-transform ${stemOpen ? "" : "-rotate-90"}`}
                />
                <span className="font-label-md text-on-surface-variant flex-shrink-0" style={{ fontSize: "11px" }}>
                  השאלה
                </span>
                {!stemOpen && (
                  <span className="text-xs text-on-surface truncate min-w-0">{questionStem}</span>
                )}
              </button>
              {stemOpen && (
                <div className="mt-1.5 max-h-32 overflow-y-auto rounded-xl border-2 border-outline-variant/60 bg-surface-container-lowest/80 px-3 py-2.5 text-sm text-on-surface">
                  <MathText>{questionStem}</MathText>
                </div>
              )}
            </div>
          )}

          {/* The board stays mounted behind the formula sheet — opening a
              reference must never cost a student the equation they were on. */}
          <div className="flex-1 min-h-0 p-4 relative z-[2]">
            <div className={`h-full ${formulasOpen ? "hidden" : "block"}`}>
              <ExprBoard />
            </div>
            {formulasOpen && <FormulaDrawer />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
