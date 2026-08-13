import { useState } from "react";
import { usePointerDrag } from "./usePointerDrag";
import { OP_LABELS, SIDE_OP_SIGNS, type MathOp, type SideOp } from "../../services/mathEngine";

/** What a brick does when it lands on the board. */
export type TrayAction =
  | { kind: "side"; op: SideOp; operand: string }
  | { kind: "cas"; op: MathOp };

interface Props {
  /** The board. Every brick here is dragged onto it. */
  dropRef: React.RefObject<HTMLDivElement>;
  onAction: (action: TrayAction) => void;
  /** Label of the op currently running, so its brick can show it. */
  busy: string | null;
  /** Variable for derivative / integral / solve. */
  variable: string;
  onVariableChange: (v: string) => void;
}

/**
 * The operations half of the worksheet: balance moves and CAS operations, all
 * as draggable bricks aimed at the same board.
 *
 * The balance row is four operator bricks plus **one** shared operand field —
 * a per-brick input would mean four keyboards for one move. Set the number
 * once, then drag the operator you want; the operand is free-form LaTeX, so
 * `2x`, `\sqrt{3}` and `\frac{1}{2}` are all fair game, not just integers.
 */
export default function OperationTray({
  dropRef,
  onAction,
  busy,
  variable,
  onVariableChange,
}: Props) {
  const [operand, setOperand] = useState("");
  const bind = usePointerDrag<TrayAction>({ targetRef: dropRef, onActivate: onAction });

  return (
    <div className="flex flex-col gap-2 mt-2">
      {/* ── both sides ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-mono text-on-surface-variant">שני הצדדים</span>
        {(Object.keys(SIDE_OP_SIGNS) as SideOp[]).map((op) => (
          <button
            key={op}
            {...bind({ kind: "side", op, operand })}
            dir="ltr"
            title={`${SIDE_OP_SIGNS[op]} על שני צדי המשוואה`}
            className="op-brick drag-source"
          >
            {SIDE_OP_SIGNS[op]}
          </button>
        ))}
        <input
          value={operand}
          onChange={(e) => setOperand(e.target.value)}
          placeholder="7"
          dir="ltr"
          aria-label="המספר או הביטוי לפעולה"
          className="operand-field"
        />
      </div>

      {/* ── CAS ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-mono text-on-surface-variant">פעולות</span>
        {OP_LABELS.map(({ op, he }) => (
          <button
            key={op}
            {...bind({ kind: "cas", op })}
            className={`op-brick op-brick--he drag-source ${busy === he ? "op-brick--busy" : ""}`}
          >
            {op === "evaluate" ? `= ${he}` : he}
          </button>
        ))}
        <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-container border border-outline-variant">
          <span className="font-label-md text-on-surface-variant">משתנה</span>
          <input
            value={variable}
            onChange={(e) => onVariableChange(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 1))}
            placeholder="x"
            dir="ltr"
            className="w-7 text-center bg-transparent border-none outline-none text-primary font-mono font-bold"
            style={{ fontSize: "14px" }}
          />
        </label>
      </div>
    </div>
  );
}
