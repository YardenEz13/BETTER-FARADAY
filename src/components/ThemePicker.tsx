import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import BottomSheet from "./BottomSheet";

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
      <div dir="rtl" className="px-5 pb-8">
        <p className="text-on-surface-variant text-sm font-body-md mb-6 leading-relaxed">
          שאלות שיעורי הבית שלך יוצגו בהקשר של הנושא שתבחר — המתמטיקה נשארת זהה, רק הסיפור משתנה! 🎉
        </p>

        <div className="grid grid-cols-2 gap-3">
          {HOMEWORK_THEMES.map((theme, idx) => {
            const isSelected = currentTheme === theme.id;
            return (
              <motion.button
                key={theme.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => selectTheme(theme.id)}
                className={`relative flex flex-col items-start gap-1 p-4 rounded-2xl border-2 text-right transition-all active:scale-95
                  ${isSelected
                    ? "border-primary bg-primary/10 shadow-[0_0_12px_var(--color-primary)/30]"
                    : "border-outline-variant/40 bg-surface-container hover:border-primary/40 hover:bg-primary/5"
                  }`}
              >
                {isSelected && (
                  <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check size={12} className="text-on-primary" />
                  </div>
                )}
                <span className="text-xl">{theme.label.split(" ")[0]}</span>
                <span className={`font-label-lg text-sm ${isSelected ? "text-primary" : "text-on-surface"}`}>
                  {theme.label.split(" ").slice(1).join(" ")}
                </span>
                <span className="text-xs text-on-surface-variant leading-snug">
                  {theme.description}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Clear theme option */}
        {currentTheme && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            onClick={() => selectTheme(undefined)}
            className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-outline-variant/50 text-on-surface-variant hover:text-error hover:border-error/40 transition-all"
          >
            <X size={16} />
            <span className="font-label-lg text-sm">הסר נושא</span>
          </motion.button>
        )}
      </div>
    </BottomSheet>
  );
}
