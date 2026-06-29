import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sigma, PencilLine, BookOpen } from "../electric";
import FaradayCanvas from "../FaradayCanvas";
import Worksheet from "./Worksheet";
import FormulaDrawer from "./FormulaDrawer";
import type { MathFieldHandle } from "./MathField";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type MobileTab = "work" | "formulas";

/**
 * Math Playground — the slide-up "no pen & paper" workspace. Reuses the
 * AIChatPanel slide-up motion + a FaradayCanvas backdrop. On desktop the
 * worksheet and the נוסחאות drawer sit side by side; on mobile a tab switches
 * between them. Lazily imported, so mathlive/nerdamer ride in this chunk only.
 */
export default function MathPlayground({ isOpen, onClose }: Props) {
  const worksheetRef = useRef<MathFieldHandle>(null);
  const [tab, setTab] = useState<MobileTab>("work");

  const insert = (latex: string) => {
    worksheetRef.current?.insertLatex(latex);
    setTab("work"); // on mobile, jump back to the field so the insert is visible
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 220 }}
          className="fixed bottom-0 left-0 w-full z-[110] flex flex-col font-body-md shadow-2xl overflow-hidden h-[74vh] md:h-[64vh]"
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
                  פתרו, גזרו ואנטגרלו — בלי דף ועיפרון
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 hover:text-primary transition-colors"
              title="סגור"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mobile tab switch */}
          <div className="md:hidden flex gap-1 px-4 pt-2 relative z-[2]">
            {([
              { id: "work", he: "דף עבודה", Icon: PencilLine },
              { id: "formulas", he: "נוסחאות", Icon: BookOpen },
            ] as const).map(({ id, he, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-label-md transition-colors ${
                  tab === id
                    ? "bg-primary-container/30 text-primary border border-primary/40"
                    : "text-on-surface-variant hover:bg-surface-variant/40"
                }`}
              >
                <Icon size={15} /> {he}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 p-4 relative z-[2]">
            <div className={`flex-1 min-h-0 flex-col ${tab === "formulas" ? "hidden md:flex" : "flex"}`}>
              <Worksheet ref={worksheetRef} />
            </div>
            <div
              className={`md:w-72 lg:w-80 min-h-0 flex-col md:border-s md:border-outline-variant/50 md:ps-3 ${
                tab === "work" ? "hidden md:flex" : "flex"
              }`}
            >
              <FormulaDrawer onInsert={insert} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
