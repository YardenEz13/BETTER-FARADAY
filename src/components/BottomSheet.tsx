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
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="bs-sheet"
            ref={sheetRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            style={{
              height,
              boxShadow: '0 -8px 40px rgba(0,0,0,0.18), 0 -2px 0 rgba(23,201,100,0.08)',
            }}
            className="fixed bottom-0 left-0 right-0 z-[70] flex flex-col
                       bg-surface rounded-t-3xl overflow-hidden
                       border-t-2 border-outline"
          >
            {/* Drag handle area */}
            <div
              className="flex-shrink-0 flex flex-col items-center pt-4 pb-3 cursor-grab active:cursor-grabbing touch-none bg-surface"
              onPointerDown={(e) => dragControls.start(e)}
            >
              {/* Thick pill handle */}
              <div className="w-12 h-1.5 rounded-full bg-outline-variant/70" />
              {title && (
                <span className="mt-3 font-semibold text-on-surface text-base" style={{ fontFamily: 'Assistant, sans-serif' }}>
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


