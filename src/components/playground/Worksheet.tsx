import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Loader2, CornerDownLeft, ArrowUp, Trash2 } from "lucide-react";
import MathField, { type MathFieldHandle } from "./MathField";
import MathText from "../MathText";
import { compute, OP_LABELS, type MathOp, type MathResult } from "../../services/mathEngine";

interface HistItem {
  id: number;
  op: MathOp;
  opHe: string;
  input: string;
  result: MathResult;
}

const opHeOf = (op: MathOp) => OP_LABELS.find((o) => o.op === op)?.he ?? op;

/**
 * The "no pen & paper" surface: one editable math field, an action bar wired to
 * the CAS engine, and a stacked history of computed steps (newest on top). The
 * single MathField is forwarded up so the formula drawer can insert into it.
 */
const Worksheet = forwardRef<MathFieldHandle, {}>(function Worksheet(_props, ref) {
  const fieldRef = useRef<MathFieldHandle>(null);
  const [latex, setLatex] = useState("");
  const [variable, setVariable] = useState("");
  const [busyOp, setBusyOp] = useState<MathOp | null>(null);
  const [history, setHistory] = useState<HistItem[]>([]);
  const idRef = useRef(0);

  useImperativeHandle(ref, () => ({
    insertLatex: (l) => fieldRef.current?.insertLatex(l),
    focus: () => fieldRef.current?.focus(),
    getValue: () => fieldRef.current?.getValue() ?? latex,
  }));

  const run = async (op: MathOp) => {
    const src = fieldRef.current?.getValue() || latex;
    if (!src.trim() || busyOp) return;
    setBusyOp(op);
    const result = await compute(op, src, variable.trim() || undefined);
    setBusyOp(null);
    setHistory((h) => [
      { id: ++idRef.current, op, opHe: opHeOf(op), input: src, result },
      ...h,
    ]);
  };

  const loadIntoField = (l: string) => {
    setLatex(l);
    fieldRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Active field */}
      <div className="rounded-2xl border-2 border-outline-variant bg-surface-container-lowest p-2 focus-within:border-primary transition-colors">
        <MathField
          ref={fieldRef}
          value={latex}
          onChange={setLatex}
          onEnter={() => run("evaluate")}
          placeholder="הקלידו ביטוי או משוואה…"
        />
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {OP_LABELS.map(({ op, he }) => (
          <button
            key={op}
            onClick={() => run(op)}
            disabled={!!busyOp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-container/30 border border-primary/40 text-primary font-label-md hover:bg-primary hover:text-on-primary active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {busyOp === op && <Loader2 size={14} className="animate-spin" />}
            {he}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ms-auto px-2 py-1 rounded-lg bg-surface-container border border-outline-variant">
          <span className="font-label-md text-on-surface-variant" style={{ fontSize: "12px" }}>משתנה</span>
          <input
            value={variable}
            onChange={(e) => setVariable(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 1))}
            placeholder="x"
            dir="ltr"
            className="w-7 text-center bg-transparent border-none outline-none text-on-surface font-mono"
            style={{ fontSize: "14px" }}
          />
        </div>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto mt-3 flex flex-col gap-2 pe-1">
        {history.length === 0 && (
          <div className="text-center text-on-surface-variant font-body-md py-8 px-4">
            הקלידו ביטוי, הוסיפו נוסחה מהרשימה, ובחרו פעולה — התוצאות יופיעו כאן.
          </div>
        )}
        {history.map((h) => (
          <div key={h.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-md" style={{ fontSize: "11px" }}>
                {h.opHe}
              </span>
              <button
                onClick={() => loadIntoField(h.input)}
                title="טען חזרה לעריכה"
                className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors"
                style={{ fontSize: "11px" }}
              >
                <CornerDownLeft size={13} /> טען
              </button>
            </div>

            <div dir="ltr" className="text-on-surface-variant text-start overflow-x-auto" style={{ fontSize: "13px" }}>
              <MathText>{`$${h.input}$`}</MathText>
            </div>

            {h.result.error ? (
              <div className="mt-1.5 text-error font-body-md">{h.result.error}</div>
            ) : (
              <div className="mt-1 flex items-start justify-between gap-2">
                <div dir="ltr" className="text-on-surface overflow-x-auto flex-1">
                  <MathText>{`$$${h.result.latex}$$`}</MathText>
                </div>
                <button
                  onClick={() => loadIntoField(h.result.latex)}
                  title="המשך מהתוצאה"
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <ArrowUp size={15} />
                </button>
              </div>
            )}
          </div>
        ))}
        {history.length > 0 && (
          <button
            onClick={() => setHistory([])}
            className="self-center flex items-center gap-1.5 mt-1 mb-2 px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 font-label-md transition-colors"
          >
            <Trash2 size={14} /> נקה הכל
          </button>
        )}
      </div>
    </div>
  );
});

export default Worksheet;
