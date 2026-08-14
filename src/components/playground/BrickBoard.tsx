import { useCallback, useMemo, useRef, useState } from "react";
import { RotateCcw, RefreshCw, Check } from "../electric";
import { usePointerDrag } from "./usePointerDrag";
import BrickKeypad from "./BrickKeypad";
import {
  canDivideOut,
  divideOut,
  eqText,
  isSolved,
  moveAcross,
  sampleEquation,
  termBody,
  termSign,
  type Equation,
  type SideName,
  type Term,
} from "../../services/algebraBricks";

/** What a drag is carrying: a brick, and which side it was picked up from. */
interface Grab {
  side: SideName;
  id: string;
  /** The coefficient is being pulled off rather than the whole term. */
  coefficient: boolean;
}

/**
 * The board is the lego.
 *
 * Every term is a brick. Pick one up, drop it on the other side of the equals,
 * and it lands with its sign flipped and the like terms already merged — one
 * gesture per algebra step, nothing to type, no tool to choose. Once a term is
 * alone on its side, its coefficient becomes a second brick you can pull off
 * the same way, and it crosses as a divisor.
 *
 * That is the whole interface. There is no operation tray because there is no
 * operation to pick: the rule is "cross the equals and you invert", and the
 * board demonstrates it every time rather than naming it.
 */
export default function BrickBoard() {
  const [start, setStart] = useState<Equation>(() => sampleEquation());
  const [history, setHistory] = useState<Equation[]>([]);
  const [building, setBuilding] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [justLanded, setJustLanded] = useState<string | null>(null);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const eq = history.length ? history[history.length - 1] : start;
  const solved = useMemo(() => isSolved(eq), [eq]);

  const push = useCallback(
    (next: Equation, landedId: string | null) => {
      if (eqText(next) === eqText(eq)) return; // gesture was a no-op
      setHistory((h) => [...h, next]);
      setJustLanded(landedId);
      window.setTimeout(() => setJustLanded(null), 420);
      if (isSolved(next)) setSolvedCount((n) => n + 1);
    },
    [eq],
  );

  const drop = useCallback(
    (grab: Grab, onto: SideName) => {
      if (grab.side === onto) return; // dropped back where it came from
      const next = grab.coefficient
        ? divideOut(eq, grab.side, grab.id)
        : moveAcross(eq, grab.side, grab.id);
      push(next, grab.id);
    },
    [eq, push],
  );

  // One drag hook per landing zone: a brick from the left aims at the right
  // half of the board and vice versa, so the target is always "the other side".
  const bindToRight = usePointerDrag<Grab>({
    targetRef: rightRef,
    onActivate: (g) => drop(g, "R"),
  });
  const bindToLeft = usePointerDrag<Grab>({
    targetRef: leftRef,
    onActivate: (g) => drop(g, "L"),
  });

  const undo = () => {
    if (!history.length) return;
    if (solved) setSolvedCount((n) => Math.max(0, n - 1));
    setHistory((h) => h.slice(0, -1));
  };

  const deal = (next?: Equation) => {
    setStart(next ?? sampleEquation());
    setHistory([]);
    setJustLanded(null);
  };

  const renderSide = (side: SideName) => {
    const terms = eq[side];
    const bind = side === "L" ? bindToRight : bindToLeft;
    return terms.map((t: Term, i: number) => {
      const splitCoefficient = canDivideOut(eq, side, t.id);
      const sign = termSign(t);
      const showSign = i > 0 || sign === "−";
      return (
        <span className="brick-group" key={t.id}>
          {showSign && <span className="brick-sign">{sign}</span>}
          {splitCoefficient ? (
            // Alone on its side: the coefficient becomes its own brick, so the
            // student can see there is something left to take off.
            <span className="brick-split">
              <button
                {...bind({ side, id: t.id, coefficient: true })}
                className="brick brick--coef drag-source"
                aria-label={`הזיזו את המקדם ${Math.abs(t.c.n)} לצד השני`}
              >
                {Math.abs(t.c.n)}
              </button>
              <span className="brick brick--x brick--locked">
                {termBody({ ...t, c: { n: 1, d: 1 } })}
              </span>
            </span>
          ) : (
            <button
              {...bind({ side, id: t.id, coefficient: false })}
              className={`brick drag-source ${t.pow > 0 ? "brick--x" : "brick--num"} ${
                justLanded === t.id ? "brick--landed" : ""
              }`}
              aria-label={`הזיזו ${termBody(t)} לצד השני`}
            >
              {termBody(t)}
            </button>
          )}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0" dir="rtl">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* ── the board ── */}
        <div className={`brick-board ${solved ? "brick-board--solved" : ""}`}>
          <div ref={leftRef} className="brick-side">
            {renderSide("L")}
          </div>
          <span className="brick-equals">=</span>
          <div ref={rightRef} className="brick-side">
            {renderSide("R")}
          </div>
        </div>

        <p className="brick-hint">
          {solved
            ? "פתרתם. x לבד בצד אחד — זה כל המשחק."
            : "הרימו לבנה והניחו אותה בצד השני. היא תעבור עם סימן הפוך."}
        </p>

        {building && (
          <BrickKeypad
            onDone={(next) => {
              setBuilding(false);
              if (next) deal(next);
            }}
          />
        )}

        {/* ── the path ── */}
        {history.length > 0 && (
          <div className="brick-path">
            {[start, ...history].map((step, i) => (
              <div key={i} className={`brick-line ${i === history.length ? "brick-line--now" : ""}`}>
                <span className="brick-line__n">{i + 1}</span>
                <span dir="ltr">{eqText(step)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── controls ── */}
      <div className="flex flex-wrap gap-1.5 pt-2 mt-1 border-t border-outline-variant/60 flex-shrink-0">
        <button onClick={undo} disabled={!history.length} className="chip-btn">
          <RotateCcw size={15} /> אחורה
        </button>
        <button onClick={() => deal()} className="chip-btn">
          <RefreshCw size={15} /> משוואה אחרת
        </button>
        <button onClick={() => setBuilding((b) => !b)} className={`chip-btn ${building ? "chip-btn--active" : ""}`}>
          משוואה משלכם
        </button>
        <span className="chip-btn pointer-events-none ms-auto" title="משוואות שפתרתם">
          <Check size={15} className="text-primary" />
          <span className="font-mono">{solvedCount}</span>
        </span>
      </div>
    </div>
  );
}
