import { useMemo, useState } from "react";
import { Search, X } from "./electric";
import BottomSheet from "./ui/BottomSheet";
import { THEOREMS, normalizeHebrew } from "../../convex/geometryTheorems";

/**
 * The theorem bank, browsable — tap a theorem to drop its formal name into the
 * justification field.
 *
 * Offered, never required: the grader accepts a student's own wording (see
 * convex/geometryTheorems.ts), so this is for the student who would rather
 * pick the right name than recall it, not a gate in front of the answer.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPick: (canonicalHe: string) => void;
}

export default function TheoremPicker({ isOpen, onClose, onPick }: Props) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = normalizeHebrew(query);
    const hits = needle
      ? THEOREMS.filter((t) =>
          normalizeHebrew(t.canonicalHe).includes(needle) ||
          t.aliases.some((a) => normalizeHebrew(a).includes(needle)))
      : THEOREMS;
    const byGroup = new Map<string, typeof THEOREMS>();
    for (const t of hits) {
      const list = byGroup.get(t.group) ?? [];
      list.push(t);
      byGroup.set(t.group, list);
    }
    return [...byGroup.entries()];
  }, [query]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="מאגר המשפטים" height="80vh">
      <div dir="rtl" className="px-5 pb-10 flex flex-col gap-4">
        <p className="text-on-surface-variant text-body-sm leading-relaxed">
          אפשר גם לכתוב את ההצדקה במילים שלך — הבדיקה מזהה את המשפט, לא את הניסוח.
        </p>

        <div className="relative">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-on-surface-variant pointer-events-none" />
          <input
            className="w-full bg-surface border-2 border-outline rounded-xl ps-10 pe-9 py-2.5 text-on-surface text-body-md focus:border-primary focus:outline-none"
            placeholder="חיפוש משפט…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            dir="rtl"
          />
          {query && (
            <button
              type="button"
              aria-label="ניקוי חיפוש"
              onClick={() => setQuery("")}
              className="absolute top-1/2 -translate-y-1/2 end-3 text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {groups.length === 0 && (
          <p className="text-on-surface-variant text-body-sm py-6 text-center">
            לא נמצא משפט מתאים — אפשר פשוט לכתוב את ההצדקה במילים שלך.
          </p>
        )}

        {groups.map(([group, list]) => (
          <section key={group} className="flex flex-col gap-2">
            <h4 className="label-mono text-label-lg text-primary">{group}</h4>
            {list.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onPick(t.canonicalHe); onClose(); }}
                className="text-start px-4 py-3 rounded-xl bg-surface border-2 border-outline hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
              >
                <div className="text-on-surface text-body-md font-semibold leading-snug">{t.canonicalHe}</div>
              </button>
            ))}
          </section>
        ))}
      </div>
    </BottomSheet>
  );
}
