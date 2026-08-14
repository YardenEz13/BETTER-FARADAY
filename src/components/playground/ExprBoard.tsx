import { useMemo, useState } from "react";
import { RotateCcw, Trash2, Check } from "../electric";
import { useDropZoneDrag } from "./usePointerDrag";
import PiecePalette, { PALETTE_DROP, type Piece } from "./PiecePalette";
import {
  canCollapse,
  canMoveAcross,
  clear,
  collapse,
  readySteps,
  fill,
  find,
  hasHole,
  hole,
  holes,
  isDone,
  moveAcross,
  num,
  replace,
  text,
  type Node,
} from "../../services/exprBricks";

/** What a drag carries: a fresh palette piece, or a brick already on the board. */
type Cargo = { from: "palette"; piece: Piece } | { from: "board"; id: string };

/**
 * The board you build the question on, and then solve — drag only.
 *
 * Pieces come out of the palette with holes in them (`√□`, `□²`, `□ + □`) and
 * every hole is a drop target, so an expression is assembled the way a model is:
 * one brick into one socket at a time. Once a sub-expression is all numbers it
 * lights up, and dropping it on itself — or tapping it — collapses it one step.
 * `√(5² + 12²)` becomes `13` in four moves, each one a line a student could
 * have written.
 *
 * Nothing is typed. Digits are pieces too: drop a `2` onto a `1` and you have
 * `12`, which is how multi-digit numbers get built without a keyboard.
 */
export default function ExprBoard() {
  const [tree, setTree] = useState<Node>(() => hole());
  const [past, setPast] = useState<Node[]>([]);
  const [done, setDone] = useState(0);

    // Only the innermost steps are offered, so one tap is one readable line.
  const ready = useMemo(() => new Set(readySteps(tree)), [tree]);
  const finished = useMemo(() => tree.kind !== "hole" && isDone(tree), [tree]);
  /**
   * The path is the *solution*, not the assembly. Half-built states are real
   * undo history but they are not lines anyone would write down, so the log
   * starts once the expression is whole.
   */
  const solutionLines = useMemo(() => {
    const out: string[] = [];
    for (const step of [...past, tree]) {
      if (step.kind === "hole" || hasHole(step)) continue;
      const line = text(step);
      if (out[out.length - 1] !== line) out.push(line);
    }
    return out;
  }, [past, tree]);

  const commit = (next: Node) => {
    if (text(next) === text(tree)) return;
    setPast((p) => [...p, tree]);
    setTree(next);
    if (next.kind !== "hole" && isDone(next) && !isDone(tree)) setDone((n) => n + 1);
  };

  /** A digit landing on a number appends to it — that is how 12 gets built. */
  const dropOnNode = (targetId: string, cargo: Cargo) => {
    if (cargo.from === "board" && targetId === PALETTE_DROP) {
      commit(clear(tree, cargo.id));
      return;
    }
    const target = find(tree, targetId);
    if (!target) return;

    if (cargo.from === "palette") {
      const piece = cargo.piece.make();

      // A digit onto a whole number grows it: 1 then 2 is 12.
      if (target.kind === "num" && piece.kind === "num" && piece.value.d === 1 && target.value.d === 1) {
        const grown = Number(`${target.value.n}${piece.value.n}`);
        if (Number.isSafeInteger(grown)) commit(fill(tree, targetId, num(grown)));
        return;
      }

      // An empty socket just takes the piece.
      if (target.kind === "hole") {
        commit(fill(tree, targetId, piece));
        return;
      }

      // Onto something already built: wrap it. The brick you dropped on slides
      // into the new piece's first socket, so `10/7` with a `□+□` dropped on it
      // becomes `10/7 + □`, and a `√□` makes it `√(10/7)`.
      //
      // Without this the board could only ever grow into holes that already
      // existed, so the moment you finished a sub-expression you could never
      // attach anything to it — you had to clear the board and start again.
      const [socket] = holes(piece);
      if (socket) commit(replace(tree, targetId, replace(piece, socket, target)));
      return;
    }

    // A brick already on the board, dragged onto the other side of an equals.
    if (canMoveAcross(tree, cargo.id)) {
      const eqNode = tree as Extract<Node, { kind: "eq" }>;
      const side = targetId === eqNode.left.id || targetId === eqNode.right.id;
      if (side) commit(moveAcross(tree, cargo.id));
    }
  };

  const bindDrag = useDropZoneDrag<Cargo>({
    onDrop: dropOnNode,
    onTap: (cargo) => {
      if (cargo.from !== "board") return;
      const node = find(tree, cargo.id);
      if (node && canCollapse(node)) commit(collapse(tree, cargo.id));
    },
  });

  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    setTree(prev);
  };

  const reset = () => {
    setPast([]);
    setTree(hole());
  };

  /* ── rendering the tree ── */

  const render = (n: Node): React.ReactNode => {
    if (n.kind === "hole") {
      return (
        <span key={n.id} data-drop={n.id} className="xb-hole">
          □
        </span>
      );
    }

    const collapsable = ready.has(n.id);
    const leafish = n.kind === "num" || n.kind === "var";

    const body = (() => {
      switch (n.kind) {
        case "num":
          return <span className="xb-lit">{text(n)}</span>;
        case "var":
          return <span className="xb-lit xb-lit--var">{n.name}</span>;
        case "bin":
          return (
            <>
              {render(n.a)}
              <span className="xb-op">{n.op}</span>
              {render(n.b)}
            </>
          );
        case "pow":
          return (
            <>
              {render(n.base)}
              <sup className="xb-sup">{render(n.exp)}</sup>
            </>
          );
        case "root":
          return (
            <>
              <span className="xb-radical">√</span>
              <span className="xb-under">{render(n.of)}</span>
            </>
          );
        case "group":
          return (
            <>
              <span className="xb-paren">(</span>
              {render(n.of)}
              <span className="xb-paren">)</span>
            </>
          );
        case "eq":
          return (
            <>
              <span data-drop={n.left.id} className="xb-side">
                {render(n.left)}
              </span>
              <span className="xb-equals">=</span>
              <span data-drop={n.right.id} className="xb-side">
                {render(n.right)}
              </span>
            </>
          );
        default:
          return null;
      }
    })();

    if (n.kind === "eq") {
      return (
        <span key={n.id} className="xb-node xb-node--eq">
          {body}
        </span>
      );
    }

    return (
      <span
        key={n.id}
        {...bindDrag({ from: "board", id: n.id })}
        data-drop={n.id}
        className={`xb-node drag-source ${leafish ? "xb-node--leaf" : ""} ${
          collapsable ? "xb-node--ready" : ""
        }`}
        title={collapsable ? "הקישו כדי לחשב" : undefined}
      >
        {body}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0" dir="rtl">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={`xb-board ${finished ? "xb-board--done" : ""}`} dir="ltr">
          {render(tree)}
        </div>

        <p className="brick-hint">
          {tree.kind === "hole"
            ? "גררו חלקים מלמטה אל הריבוע כדי לבנות את התרגיל."
            : finished
              ? "זהו — אין יותר מה לחשב."
              : ready.size > 0
                ? "הלבנים הזוהרות מוכנות לחישוב — הקישו עליהן."
                : "המשיכו למלא את הריבועים."}
        </p>

        {solutionLines.length > 1 && (
          <div className="brick-path">
            {solutionLines.map((line, i) => (
              <div
                key={i}
                className={`brick-line ${i === solutionLines.length - 1 ? "brick-line--now" : ""}`}
              >
                <span className="brick-line__n">{i + 1}</span>
                <span dir="ltr">{line}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <PiecePalette bind={bindDrag} />

      <div className="flex flex-wrap gap-1.5 pt-2 mt-1 border-t border-outline-variant/60 flex-shrink-0">
        <button onClick={undo} disabled={!past.length} className="chip-btn">
          <RotateCcw size={15} /> אחורה
        </button>
        <button onClick={reset} disabled={tree.kind === "hole"} className="chip-btn">
          <Trash2 size={15} /> לוח נקי
        </button>
        <span className="chip-btn pointer-events-none ms-auto" title="תרגילים שסיימתם">
          <Check size={15} className="text-primary" />
          <span className="font-mono">{done}</span>
        </span>
      </div>
    </div>
  );
}
