import { useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import MathText from "../MathText";
import { FORMULA_BANK } from "../../data/formulaBank";

interface Props {
  /** Insert a formula's LaTeX into the active math field. */
  onInsert: (latex: string) => void;
}

/**
 * Collapsible, searchable נוסחאות sheet. Each row renders the formula with KaTeX
 * (via MathText) and inserts it on click.
 */
export default function FormulaDrawer({ onInsert }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(FORMULA_BANK[0]?.id ?? null);

  const q = query.trim();
  const filtered = useMemo(() => {
    if (!q) return FORMULA_BANK;
    return FORMULA_BANK.map((cat) => ({
      ...cat,
      items: cat.items.filter((it) => it.nameHe.includes(q) || it.latex.includes(q)),
    })).filter((cat) => cat.items.length > 0);
  }, [q]);

  // When searching, show every matching category expanded.
  const isOpen = (id: string) => (q ? true : open === id);

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container border border-outline-variant mb-2">
        <Search size={16} className="text-on-surface-variant flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש נוסחה…"
          className="w-full bg-transparent border-none outline-none text-on-surface font-body-md placeholder:text-on-surface-variant/70"
          style={{ fontSize: "14px" }}
        />
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto pe-1 flex flex-col gap-1.5">
        {filtered.length === 0 && (
          <div className="text-center text-on-surface-variant font-body-md py-8">
            לא נמצאו נוסחאות
          </div>
        )}
        {filtered.map((cat) => (
          <div key={cat.id} className="rounded-xl border border-outline-variant overflow-hidden bg-surface-container-lowest">
            <button
              onClick={() => setOpen((o) => (o === cat.id ? null : cat.id))}
              className="w-full flex items-center justify-between px-3 py-2.5 text-on-surface hover:bg-surface-variant/40 transition-colors"
            >
              <span className="font-label-lg font-semibold">{cat.titleHe}</span>
              <ChevronDown
                size={18}
                className={`text-on-surface-variant transition-transform ${isOpen(cat.id) ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen(cat.id) && (
              <div className="flex flex-col">
                {cat.items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => onInsert(it.insertLatex ?? it.latex)}
                    title="הוסף לדף העבודה"
                    className="flex flex-col items-start gap-1 px-3 py-2.5 border-t border-outline-variant/50 text-start hover:bg-primary/10 active:scale-[0.99] transition-all"
                  >
                    <span className="font-label-md text-on-surface-variant">{it.nameHe}</span>
                    <span dir="ltr" className="text-on-surface">
                      <MathText>{`$${it.latex}$`}</MathText>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
