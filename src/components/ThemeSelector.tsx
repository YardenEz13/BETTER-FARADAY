import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion } from "framer-motion";
import { Check, X } from "./electric";
import BottomSheet from "./ui/BottomSheet";

// Preset themes the student can choose from
export const HOMEWORK_THEMES = [
  { id: "כדורגל", label: "⚽ כדורגל", description: "שחקנים, מועדונים, ליגות" },
  { id: "חברים", label: "☕ חברים", description: 'דמויות מהסדרה "Friends"' },
  { id: "מינקראפט", label: "⛏️ מינקראפט", description: "בניה, כריה, הרפתקאות" },
  { id: "מוזיקה פופ", label: "🎵 מוזיקה", description: "אמנים, אלבומים, פסטיבלים" },
  { id: "כדורסל", label: "🏀 כדורסל", description: "NBA, שחקנים, קבוצות" },
  { id: "הארי פוטר", label: "🧙 הארי פוטר", description: "קסם, הוגוורטס, דמויות" },
  { id: "מרוצים", label: "🏎️ מרוצים", description: "F1, מכוניות, מסלולים" },
  { id: "בישול", label: "🍳 בישול", description: "מתכונים, מסעדות, שפים" },
  { id: "ריקוד", label: "💃 ריקוד", description: "טנגו, היפ הופ, בלט" },
  { id: "חלל", label: "🚀 חלל", description: "כוכבים, חללית, NASA" },
] as const;

interface ThemePickerProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  currentTheme?: string | null;
}

export default function ThemePicker({
  isOpen,
  onClose,
  studentId,
  currentTheme,
}: ThemePickerProps) {
  const updateTheme = useMutation(api.classroom.updateStudentTheme);

  async function selectTheme(themeId: string | undefined) {
    await updateTheme({
      studentId: studentId as Id<"students">,
      theme: themeId,
    });
    onClose();
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="בחר נושא לשיעורי הבית שלך" height="80vh">
      <div dir="rtl" className="px-5 pb-10">
        <p className="text-on-surface-variant text-sm mb-6 leading-relaxed" style={{ fontFamily: 'Assistant, sans-serif' }}>
          שאלות שיעורי הבית שלך יוצגו בהקשר של הנושא שתבחר — המתמטיקה נשארת זהה, רק הסיפור משתנה! 🎉
        </p>

        {/* Theme grid — large clay-card tiles */}
        <div className="grid grid-cols-2 gap-4">
          {HOMEWORK_THEMES.map((theme, idx) => {
            const isSelected = currentTheme === theme.id;
            return (
              <motion.button
                key={theme.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => selectTheme(theme.id)}
                className={`relative flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 text-center transition-all active:scale-95 select-none ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-outline-variant bg-surface-container hover:border-primary/50 hover:bg-primary/5"
                }`}
                style={{
                  boxShadow: isSelected
                    ? 'var(--shadow-clay-primary)'
                    : 'var(--shadow-clay)',
                  minHeight: '110px',
                }}
              >
                {/* Green check badge on selected */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md"
                  >
                    <Check size={13} className="text-white" strokeWidth={3} />
                  </motion.div>
                )}

                {/* Large emoji icon */}
                <span className="text-4xl leading-none">
                  {theme.label.split(" ")[0]}
                </span>

                {/* Theme name */}
                <span
                  className={`font-bold text-sm leading-tight ${isSelected ? "text-primary" : "text-on-surface"}`}
                  style={{ fontFamily: 'Assistant, sans-serif' }}
                >
                  {theme.label.split(" ").slice(1).join(" ")}
                </span>

                {/* Description */}
                <span className="text-xs text-on-surface-variant leading-snug">
                  {theme.description}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Clear theme — ghost clay button */}
        {currentTheme && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42 }}
            onClick={() => selectTheme(undefined)}
            className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-outline-variant/60 text-on-surface-variant hover:text-error hover:border-error/50 hover:bg-error/5 transition-all"
            style={{ fontFamily: 'Assistant, sans-serif', boxShadow: 'var(--shadow-clay)' }}
          >
            <X size={16} />
            <span className="font-semibold text-sm">הסר נושא</span>
          </motion.button>
        )}
      </div>
    </BottomSheet>
  );
}

