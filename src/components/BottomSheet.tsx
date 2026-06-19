import { motion, AnimatePresence, PanInfo, useDragControls } from "framer-motion";
import { useEffect, useRef } from "react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Height of the sheet as a CSS string, e.g. "85vh" or "600px". Default: "85vh" */
  height?: string;
  /** Optional title displayed in the drag handle area */
  title?: string;
}

/**
 * A mobile-first bottom sheet with swipe-to-dismiss gesture support.
 * Falls back gracefully on desktop.
 */
export default function BottomSheet({
  isOpen,
  onClose,
  children,
  height = "85vh",
  title,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    // Dismiss if the user swipes down by more than 100px
    if (info.offset.y > 100) {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bs-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="bs-sheet"
            ref={sheetRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            style={{ height }}
            className="fixed bottom-0 left-0 right-0 z-[70] flex flex-col
                       bg-surface rounded-t-3xl shadow-2xl overflow-hidden
                       border-t border-outline-variant/30"
          >
            {/* Drag handle */}
            <div
              className="flex-shrink-0 flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 rounded-full bg-outline-variant/60" />
              {title && (
                <span className="mt-3 font-label-lg text-on-surface-variant text-sm">
                  {title}
                </span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
