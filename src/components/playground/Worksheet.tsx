import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { RotateCcw, Trash2, ElectricAtom } from "../electric";
import FaradayAvatar from "../FaradayAvatar";
import MathField, { type MathFieldHandle } from "./MathField";
import MathText from "../MathText";
import BlocksBar from "./BlocksBar";
import OperationTray, { type TrayAction } from "./OperationTray";
import {
  applyBothSides,
  compute,
  OP_LABELS,
  SIDE_OP_SIGNS,
} from "../../services/mathEngine";

/** One line of the solution: what the board said before, and what it says now. */
interface Step {
  id: number;
  /** Brick that produced it — "−7", "נגזרת". */
  label: string;
  before: string;
  /** Board content after the step. */
  after: string;
  /** Presentation form for the log (d/dx(…)=…, all roots of a solve). */
  shown: string;
  approx?: string;
}

const opHeOf = (op: string) => OP_LABELS.find((o) => o.op === op)?.he ?? op;

// MathLive renders the placeholder in math mode, where ordinary spaces
// collapse and the words run together. NBSPs are what keep them apart.
const BOARD_PLACEHOLDER = "בנו כאן את התרגיל";

interface Props {
  /** The board card. Blocks, formulas and operation bricks all land here. */
  dropRef: React.RefObject<HTMLDivElement>;
}

/**
 * The worksheet — one board, everything aimed at it.
 *
 * The board holds the line the student is working on. They build it from lego
 * blocks and formula rows, then drag operations onto it: balance moves that hit
 * both sides at once, and the CAS operations for the parts no one should be
 * doing by hand. Each operation *replaces* the board and stacks the old line
 * above it, so the panel reads top-to-bottom like a solved exercise — not like
 * a calculator that forgets.
 *
 * The board stays editable throughout. Nothing here refuses a move: a wrong
 * turn costs one tap of ביטול.
 */
const Worksheet = forwardRef<MathFieldHandle, Props>(function Worksheet({ dropRef }, ref) {
  const fieldRef = useRef<MathFieldHandle>(null);
  const [latex, setLatex] = useState("");
  const [variable, setVariable] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const idRef = useRef(0);

  useImperativeHandle(ref, () => ({
    insertLatex: (l) => fieldRef.current?.insertLatex(l),
    focus: () => fieldRef.current?.focus(),
    getValue: () => fieldRef.current?.getValue() ?? latex,
  }));

  /** Put a line on the board, keeping the field element in sync. */
  const setBoard = (l: string) => {
    setLatex(l);
    fieldRef.current?.focus();
  };

  const act = async (action: TrayAction) => {
    const before = fieldRef.current?.getValue() || latex;
    const label =
      action.kind === "side"
        ? `${SIDE_OP_SIGNS[action.op]}${action.operand.trim() || "?"}`
        : opHeOf(action.op);
    if (busy) return;

    setBusy(label);
    const result =
      action.kind === "side"
        ? await applyBothSides(before, action.op, action.operand)
        : await compute(action.op, before, variable.trim() || undefined);
    setBusy(null);

    if (result.error) {
      setNote({ text: result.error, ok: false });
      return;
    }
    // The bare form is what stays solvable: `3x^2`, not `d/dx(x^3)=3x^2`.
    // `פתור` is the exception — its presentation form *is* the answer line
    // (`x₁=2, x₂=3`), and a lone root on the board is a dead end.
    const after =
      action.kind === "cas" && action.op === "solve"
        ? result.latex
        : result.reuseLatex ?? result.latex;
    // Bump the id out here, not inside the updater: StrictMode runs updaters
    // twice in dev and the step numbers would skip.
    const id = ++idRef.current;
    setNote(null);
    setSteps((s) => [
      ...s,
      { id, label, before, after, shown: result.latex, approx: result.approx },
    ]);
    setBoard(after);
  };

  const undo = () => {
    const last = steps[steps.length - 1];
    if (!last) return;
    setSteps((s) => s.slice(0, -1));
    setNote(null);
    setBoard(last.before);
  };

  /** Tap a line in the path to go back to it — everything after it is dropped. */
  const rewindTo = (step: Step) => {
    setSteps((s) => s.slice(0, s.findIndex((x) => x.id === step.id) + 1));
    setNote(null);
    setBoard(step.after);
  };

  const clear = () => {
    setSteps([]);
    setNote(null);
    setBoard("");
  };

  return (
    <div className="flex flex-col h-full min-h-0" dir="rtl">
      {/* Build the line: lego blocks, tapped or dragged onto the board */}
      <BlocksBar onInsert={(l) => fieldRef.current?.insertLatex(l)} dropRef={dropRef} />

      {/* ── the board ── */}
      <div
        ref={dropRef}
        className="worksheet-drop mt-1.5 rounded-2xl border-2 border-outline-variant bg-surface-container-lowest p-2 transition-all focus-within:border-primary"
      >
        <MathField
          ref={fieldRef}
          value={latex}
          onChange={setLatex}
          onEnter={() => act({ kind: "cas", op: "evaluate" })}
          placeholder={BOARD_PLACEHOLDER}
        />
      </div>

      <div
        className={`min-h-[1.35rem] px-1 pt-1.5 font-label-lg ${
          note ? (note.ok ? "text-primary-dark" : "text-error") : "text-transparent"
        }`}
      >
        {note?.text ?? "·"}
      </div>

      {/* Operate on the line */}
      <OperationTray
        dropRef={dropRef}
        onAction={act}
        busy={busy}
        variable={variable}
        onVariableChange={setVariable}
      />

      {/* ── the path ── */}
      <div className="flex-1 overflow-y-auto mt-3 flex flex-col gap-2 pe-1">
        {steps.length === 0 ? (
          <div
            className="flex items-start gap-3.5 rounded-2xl border-2 border-dashed border-outline p-4 mx-1 text-on-surface-variant font-body-md"
            style={{ lineHeight: 1.7 }}
          >
            <span
              className="flex-shrink-0 rounded-full border-2 border-primary overflow-hidden glow-primary"
              style={{ width: 44, height: 44 }}
            >
              <FaradayAvatar px={44} fill fit="cover" />
            </span>
            <div>
              <b className="text-on-surface">איך זה עובד?</b>
              <br />
              בנו את התרגיל על הלוח מהבלוקים ומה<b>נוסחאות</b> — ואז גררו עליו פעולה. <b>+ − × ÷</b>{" "}
              פועלות על <b>שני צדי המשוואה</b> יחד, ו<b>נגזרת</b>, <b>אינטגרל</b>, <b>פתור</b> או{" "}
              <b>פרק לגורמים</b> עושות את החלק הכבד. כל פעולה מחליפה את הלוח והשורה הקודמת נערמת
              כאן — הקישו עליה כדי לחזור אליה.
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 px-1 mb-0.5 text-on-surface-variant">
              <ElectricAtom size={14} glow={0.3} animated={false} />
              <span className="label-mono">הדרך שלכם · THE PATH</span>
            </div>
            {steps.map((s, i) => ({ s, n: i + 1 })).reverse().map(({ s, n }) => (
              <button
                key={s.id}
                onClick={() => rewindTo(s)}
                title="חזרה לשורה הזו"
                className="hist-pop rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-start hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-md"
                    style={{ fontSize: "11px" }}
                    dir="ltr"
                  >
                    {s.label}
                  </span>
                  <span className="font-mono text-on-surface-variant" style={{ fontSize: "10px" }}>
                    שלב {n}
                  </span>
                </div>
                <div dir="ltr" className="text-on-surface overflow-x-auto math-card">
                  <MathText>{`$$${s.shown}$$`}</MathText>
                  {s.approx && (
                    <div
                      className="text-center text-on-surface-variant font-mono"
                      style={{ fontSize: "12px" }}
                    >
                      ≈ {s.approx}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-1.5 pt-2 mt-1 border-t border-outline-variant/60 flex-shrink-0">
        <button onClick={undo} disabled={!steps.length} className="chip-btn">
          <RotateCcw size={15} /> ביטול
        </button>
        <button
          onClick={clear}
          disabled={!steps.length && !latex}
          className="chip-btn"
        >
          <Trash2 size={15} /> לוח נקי
        </button>
      </div>
    </div>
  );
});

export default Worksheet;
