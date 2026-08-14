import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** How long a nudge stays up. Long enough to read, short enough to forgive. */
const NUDGE_MS = 2800;

/**
 * The board you build the question on, and then solve.
 *
 * Two ways to place a piece, because a phone in one hand and a phone on a desk
 * want different things:
 *
 *   drag — pick a piece up and drop it where it goes
 *   tap  — tap the piece to pick it up, tap the target to put it down
 *
 * Both run through the same `place`, so they can never drift apart. Once a
 * sub-expression is all numbers it lights up, and tapping it collapses it one
 * step: `√(5² + 12²)` becomes `13` in four moves.
 *
 * A piece that cannot go where it was aimed says so rather than doing nothing —
 * silence reads as a broken app, which is exactly how it was first reported.
 */
export default function ExprBoard() {
  const [tree, setTree] = useState<Node>(() => hole());
  const [past, setPast] = useState<Node[]>([]);
  const [done, setDone] = useState(0);
  /** The piece picked up by tapping, waiting for somewhere to go. */
  const [held, setHeld] = useState<Piece | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const nudgeTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(nudgeTimer.current), []);

  const say = useCallback((message: string) => {
    setNudge(message);
    window.clearTimeout(nudgeTimer.current);
    nudgeTimer.current = window.setTimeout(() => setNudge(null), NUDGE_MS);
  }, []);

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
    setNudge(null);
    if (next.kind !== "hole" && isDone(next) && !isDone(tree)) setDone((n) => n + 1);
  };

  /**
   * Put a palette piece somewhere. One place for both gestures.
   *
   *   empty socket              → fills it
   *   digit onto a whole number → grows it (1 then 2 is 12)
   *   anything already built    → wraps it, the brick sliding into the
   *                               piece's first socket
   */
  const place = (targetId: string, piece: Piece) => {
    const target = find(tree, targetId);
    if (!target) return;
    const node = piece.make();

    if (target.kind === "hole") {
      commit(fill(tree, targetId, node));
      return;
    }

    if (node.kind === "num" && target.kind === "num") {
      if (node.value.d === 1 && target.value.d === 1) {
        const grown = Number(`${target.value.n}${node.value.n}`);
        if (Number.isSafeInteger(grown)) commit(fill(tree, targetId, num(grown)));
        else say("המספר הזה כבר ארוך מדי.");
        return;
      }
      // 10/7 with a 3 dropped on it: appending is meaningless and a digit has
      // no socket to wrap with, so name the way forward instead of stalling.
      say("אי אפשר להוסיף ספרה למספר הזה. גררו עליו ‎+‎ או ‎×‎ כדי לחבר אליו משהו.");
      return;
    }

    const [socket] = holes(node);
    if (socket) {
      commit(replace(tree, targetId, replace(node, socket, target)));
      return;
    }

    // A bare piece (a digit, an x) onto a built brick — nothing to wrap into.
    say("החלק הזה נכנס רק לריבוע ריק. גררו קודם פעולה כמו ‎+‎ או ‎√‎.");
  };

  const dropOnNode = (targetId: string, cargo: Cargo) => {
    if (cargo.from === "board" && targetId === PALETTE_DROP) {
      commit(clear(tree, cargo.id));
      return;
    }
    if (cargo.from === "palette") {
      if (targetId === PALETTE_DROP) return; // dropped straight back in the bin
      place(targetId, cargo.piece);
      return;
    }

    // A brick already on the board, dragged onto the other side of an equals.
    if (canMoveAcross(tree, cargo.id)) {
      const eqNode = tree as Extract<Node, { kind: "eq" }>;
      if (targetId === eqNode.left.id || targetId === eqNode.right.id) {
        commit(moveAcross(tree, cargo.id));
        return;
      }
    }
    if (targetId !== cargo.id) say("אפשר להעביר לצד השני רק איבר שלם של המשוואה.");
  };

  /** Tapping a brick on the board: put down what you're holding, or compute. */
  const tapNode = (id: string) => {
    if (held) {
      place(id, held);
      setHeld(null);
      return;
    }
    const node = find(tree, id);
    if (!node) return;
    if (canCollapse(node)) {
      commit(collapse(tree, id));
      return;
    }
    if (node.kind !== "hole" && ready.size > 0) {
      say("הלבנה הזו עוד לא מוכנה. התחילו מהלבנים הזוהרות.");
    }
  };

  const bindDrag = useDropZoneDrag<Cargo>({
    onDrop: dropOnNode,
    onTap: (cargo) => {
      if (cargo.from === "palette") {
        // Tap to pick up, tap again to put back.
        setHeld((h) => (h?.id === cargo.piece.id ? null : cargo.piece));
        setNudge(null);
        return;
      }
      tapNode(cargo.id);
    },
  });

  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    setTree(prev);
    setNudge(null);
  };

  const reset = () => {
    setPast([]);
    setTree(hole());
    setHeld(null);
    setNudge(null);
  };

  /* ── rendering the tree ── */

  const render = (n: Node): React.ReactNode => {
    if (n.kind === "hole") {
      return (
        <button
          key={n.id}
          data-drop={n.id}
          onClick={() => tapNode(n.id)}
          className="xb-hole"
          aria-label="ריבוע ריק"
        >
          □
        </button>
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

  const hint = () => {
    if (nudge) return nudge;
    if (held) return `${held.label} ביד — הקישו לאן להניח אותו.`;
    if (tree.kind === "hole") return "הקישו על חלק מלמטה, או גררו אותו אל הריבוע.";
    if (finished) return "זהו — אין יותר מה לחשב.";
    if (ready.size > 0) return "הלבנים הזוהרות מוכנות לחישוב — הקישו עליהן.";
    return "המשיכו למלא את הריבועים.";
  };

  return (
    <div className="flex flex-col h-full min-h-0" dir="rtl">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div
          className={`xb-board ${finished ? "xb-board--done" : ""} ${
            held ? "xb-board--placing" : ""
          }`}
          dir="ltr"
        >
          {render(tree)}
        </div>

        <p className={`brick-hint ${nudge ? "brick-hint--nudge" : ""}`} role="status">
          {hint()}
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

      <PiecePalette bind={bindDrag} heldId={held?.id ?? null} />

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
