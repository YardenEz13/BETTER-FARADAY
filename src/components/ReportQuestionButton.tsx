import { useState } from "react";
import { useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AlertTriangle, Check, X } from "./electric";
import { errorMessage } from "../lib/errors";

/**
 * "Something's wrong with this question" — the content-correctness backstop.
 *
 * Every question in the bank is machine-authored and nothing can prove an
 * answer key right automatically, so the student staring at it is the
 * detector. Reports land in `questionReports` and surface on the teacher
 * dashboard, which turns a wrong answer key into a same-day fix instead of a
 * pilot post-mortem finding.
 *
 * Deliberately quiet: a ghost button that only opens the reason picker when
 * pressed, so it never competes with the answer choices.
 */
const REASONS = [
  { key: "wrong_answer" as const, label: "התשובה הנכונה שגויה" },
  { key: "unclear" as const, label: "השאלה לא ברורה" },
  { key: "broken_math" as const, label: "הנוסחאות לא מוצגות נכון" },
  { key: "other" as const, label: "אחר" },
];

export default function ReportQuestionButton({ questionId, studentId, route }: {
  questionId: string;
  studentId?: Id<"students">;
  route: string;
}) {
  const report = useMutation(api.questionReports.report);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const send = async (reason: typeof REASONS[number]["key"]) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await report({ questionId, studentId, reason, note: note.trim() || undefined, route });
      setSent(true);
      setOpen(false);
    } catch (e) {
      setErr(errorMessage(e, "הדיווח לא נשלח. נסו שוב."));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Check size={14} /> תודה, הדיווח נשלח
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-on-surface-variant hover:text-error transition-colors"
      >
        <AlertTriangle size={14} /> {open ? "ביטול" : "משהו לא תקין בשאלה?"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-outline bg-surface-container-low p-3.5">
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    disabled={busy}
                    onClick={() => send(r.key)}
                    className="rounded-xl border-2 border-outline bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:border-error hover:text-error disabled:opacity-50"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                placeholder="פרטים (לא חובה)"
                className="w-full rounded-xl border-2 border-outline bg-surface px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
              />
              {err && (
                <div role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-error">
                  <X size={12} /> {err}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
