import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Loader as Loader2, CornerDownLeft, ArrowUp, Trash2, ElectricAtom } from "../electric";
import FaradayAvatar from "../FaradayAvatar";
import MathField, { type MathFieldHandle } from "./MathField";
import MathText from "../MathText";
import BlocksBar from "./BlocksBar";
import { dragLatex, droppedLatex } from "./dragLatex";
import { compute, OP_LABELS, type MathOp, type MathResult } from "../../services/mathEngine";

interface HistItem {
  id: number;
  op: MathOp;
  opHe: string;
  input: string;
  result: MathResult;
  createdAt: number;
}

const opHeOf = (op: MathOp) => OP_LABELS.find((o) => o.op === op)?.he ?? op;

/**
 * The "no pen & paper" surface: one editable math field, an action bar wired to
 * the CAS engine, and a stacked history of computed steps (newest on top). The
 * single MathField is forwarded up so the formula drawer can insert into it.
 * Blocks, formulas and past results are all draggable onto the field card.
 */
const Worksheet = forwardRef<MathFieldHandle, object>(function Worksheet(_props, ref) {
  const fieldRef = useRef<MathFieldHandle>(null);
  const [latex, setLatex] = useState("");
  const [variable, setVariable] = useState("");
  const [busyOp, setBusyOp] = useState<MathOp | null>(null);
  const [dragOver, setDragOver] = useState(false);
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
      { id: ++idRef.current, op, opHe: opHeOf(op), input: src, result, createdAt: Date.now() },
      ...h,
    ]);
  };

  const loadIntoField = (l: string) => {
    setLatex(l);
    fieldRef.current?.focus();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const l = droppedLatex(e);
    if (l) fieldRef.current?.insertLatex(l);
  };

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Lego blocks — tap or drag to build the expression */}
      <BlocksBar onInsert={(l) => fieldRef.current?.insertLatex(l)} />

      {/* Active field — also the drop target for blocks / formulas / results */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`mt-1.5 rounded-2xl border-2 bg-surface-container-lowest p-2 transition-all focus-within:border-primary ${
          dragOver ? "border-primary" : "border-outline-variant"
        }`}
        style={dragOver ? { boxShadow: "0 0 20px color-mix(in srgb, var(--color-primary) 32%, transparent)" } : undefined}
      >
        <MathField
          ref={fieldRef}
          value={latex}
          onChange={setLatex}
          onEnter={() => run("evaluate")}
          placeholder="הקלידו ביטוי, גררו בלוקים לכאן, או בחרו נוסחה…"
        />
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {OP_LABELS.map(({ op, he }) => (
          <button
            key={op}
            onClick={() => run(op)}
            disabled={!!busyOp}
            className={`chip-btn ${op === "evaluate" ? "chip-btn--primary" : ""}`}
          >
            {busyOp === op && <Loader2 size={14} className="animate-spin" />}
            {op === "evaluate" ? `= ${he}` : he}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ms-auto px-2 py-1 rounded-lg bg-surface-container border border-outline-variant">
          <span className="font-label-md text-on-surface-variant" style={{ fontSize: "12px" }}>משתנה</span>
          <input
            value={variable}
            onChange={(e) => setVariable(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 1))}
            placeholder="x"
            dir="ltr"
            className="w-7 text-center bg-transparent border-none outline-none text-primary font-mono font-bold"
            style={{ fontSize: "14px" }}
          />
        </div>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto mt-3 flex flex-col gap-2 pe-1">
        {history.length === 0 && (
          <div className="flex items-start gap-3.5 rounded-2xl border-2 border-dashed border-outline p-4 mx-1 text-on-surface-variant font-body-md" style={{ lineHeight: 1.7 }}>
            <span className="flex-shrink-0 rounded-full border-2 border-primary overflow-hidden glow-primary" style={{ width: 44, height: 44 }}>
              <FaradayAvatar px={44} fill fit="cover" />
            </span>
            <div>
              <b className="text-on-surface">איך זה עובד?</b>
              <br />
              גררו בלוקים אל השדה (או הקישו עליהם), כתבו ביטוי או משוואה — ובחרו פעולה: <b>חשב</b> לתוצאה
              מספרית, <b>פתור</b> למשוואות, <b>נגזרת</b> ו<b>אינטגרל</b> לחדו״א. כל תוצאה נערמת כאן — הקישו
              עליה (או גררו אותה חזרה לשדה) כדי להמשיך לחשב איתה.
            </div>
          </div>
        )}
        {history.length > 0 && (
          <div className="flex items-center gap-1.5 px-1 mb-0.5 text-on-surface-variant">
            <ElectricAtom size={14} glow={0.3} animated={false} />
            <span className="label-mono">מחברת מעבדה · LAB NOTEBOOK</span>
          </div>
        )}
        {history.map((h) => (
          <div key={h.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 hist-pop">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-md" style={{ fontSize: "11px" }}>
                  {h.opHe}
                </span>
                <span className="font-mono text-on-surface-variant" style={{ fontSize: "10px" }}>
                  ניסוי #{h.id}
                </span>
              </div>
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
              <button
                draggable
                onDragStart={dragLatex(h.result.reuseLatex ?? h.result.latex)}
                onClick={() => loadIntoField(h.result.reuseLatex ?? h.result.latex)}
                title="המשך מהתוצאה — לחיצה או גרירה חזרה לשדה"
                className="mt-1 w-full flex items-center justify-between gap-2 rounded-xl px-2 py-1 -mx-1 text-start hover:bg-primary/8 active:scale-[0.99] transition-all cursor-grab active:cursor-grabbing"
              >
                <div dir="ltr" className="text-on-surface overflow-x-auto flex-1 math-card">
                  <MathText>{`$$${h.result.latex}$$`}</MathText>
                  {h.result.approx && (
                    <div className="text-center text-on-surface-variant font-mono" style={{ fontSize: "12px" }}>
                      ≈ {h.result.approx}
                    </div>
                  )}
                </div>
                <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant">
                  <ArrowUp size={15} />
                </span>
              </button>
            )}

            <div className="flex justify-end mt-1">
              <span className="font-mono text-on-surface-variant" style={{ fontSize: "10px" }}>
                {new Date(h.createdAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
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
