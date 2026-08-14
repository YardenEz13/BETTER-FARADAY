import { useState } from "react";
import { Check, X } from "../electric";
import {
  equation,
  eqText,
  rat,
  term,
  type Equation,
  type Term,
} from "../../services/algebraBricks";

interface Props {
  /** `null` cancels; an equation replaces the board. */
  onDone: (eq: Equation | null) => void;
}

/** What the next tap is building up. */
interface Pending {
  digits: string;
  negative: boolean;
}

const EMPTY: Pending = { digits: "", negative: false };

/**
 * Type your own equation in bricks, not LaTeX.
 *
 * Digits pile into the brick you are holding; `x` turns it into an x-term; the
 * sign keys commit it and start the next one. It is a calculator layout on
 * purpose — everyone already knows where the digits are, and the point of this
 * panel is to get out of the way fast so the dragging can start.
 */
export default function BrickKeypad({ onDone }: Props) {
  const [left, setLeft] = useState<Term[]>([]);
  const [right, setRight] = useState<Term[]>([]);
  const [onRight, setOnRight] = useState(false);
  const [pending, setPending] = useState<Pending>(EMPTY);

  const terms = onRight ? right : left;
  const setTerms = onRight ? setRight : setLeft;

  /** Commit whatever is being held, as a term of the given power. */
  const commit = (pow: number) => {
    const magnitude = pending.digits === "" ? 1 : Number(pending.digits);
    if (pow === 0 && pending.digits === "") return; // a bare sign is not a term
    setTerms([...terms, term(rat(pending.negative ? -magnitude : magnitude), pow)]);
    setPending(EMPTY);
  };

  const digit = (d: string) =>
    setPending((p) => ({ ...p, digits: (p.digits + d).slice(0, 4) }));

  const sign = (negative: boolean) => {
    // A sign key both closes the number being held and opens the next one.
    if (pending.digits !== "") commit(0);
    setPending({ digits: "", negative });
  };

  const back = () => {
    if (pending.digits !== "") {
      setPending((p) => ({ ...p, digits: p.digits.slice(0, -1) }));
      return;
    }
    if (terms.length) {
      setTerms(terms.slice(0, -1));
      return;
    }
    if (onRight) setOnRight(false);
  };

  /** An empty side renders as nothing here; the placeholder is the caller's job. */
  const preview = (side: Term[]) =>
    side.length === 0 ? "" : eqText(equation(side, [term(rat(0))])).split(" = ")[0];

  /**
   * The number being typed, shown with the sign it will land with — a `+` only
   * once there is something for it to be added to.
   */
  const heldText = (side: Term[]) => {
    const sign = pending.negative ? "−" : side.length > 0 ? "+" : "";
    if (pending.digits === "") return pending.negative ? "−" : "";
    return `${sign}${pending.digits}`;
  };

  const ready = left.length > 0 && right.length > 0;

  return (
    <div className="keypad">
      <div className="keypad__preview" dir="ltr">
        {(["L", "R"] as const).map((s) => {
          const active = (s === "R") === onRight;
          const side = s === "L" ? left : right;
          const held = active ? heldText(side) : "";
          // The held number stands in for the placeholder: showing "… 17" reads
          // as two things when it is one thing being typed.
          const showPlaceholder = side.length === 0 && !held;
          return (
            <span key={s} className="contents">
              {s === "R" && <span className="keypad__eq">=</span>}
              {showPlaceholder ? (
                <span className={active ? "keypad__active" : ""}>…</span>
              ) : (
                side.length > 0 && (
                  <span className={active ? "keypad__active" : ""}>{preview(side)}</span>
                )
              )}
              {held && <span className="keypad__held">{held}</span>}
            </span>
          );
        })}
      </div>

      <div className="keypad__grid" dir="ltr">
        {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0"].map((d) => (
          <button key={d} onClick={() => digit(d)} className="lego lego--atom">
            {d}
          </button>
        ))}
        <button onClick={() => commit(1)} className="lego lego--atom lego--key">x</button>
        <button onClick={() => commit(2)} className="lego lego--atom lego--key">x²</button>
        <button onClick={() => sign(false)} className="lego lego--atom lego--key">+</button>
        <button onClick={() => sign(true)} className="lego lego--atom lego--key">−</button>
        <button
          onClick={() => {
            if (pending.digits !== "") commit(0);
            setOnRight(true);
          }}
          disabled={onRight}
          className="lego lego--atom lego--key"
        >
          =
        </button>
        <button onClick={back} className="lego lego--atom lego--key">⌫</button>
      </div>

      <div className="flex gap-1.5 mt-2">
        <button
          onClick={() => {
            const l = pending.digits !== "" && !onRight ? [...left, term(rat(pending.negative ? -Number(pending.digits) : Number(pending.digits)))] : left;
            const r = pending.digits !== "" && onRight ? [...right, term(rat(pending.negative ? -Number(pending.digits) : Number(pending.digits)))] : right;
            if (!l.length || !r.length) return;
            onDone(equation(l, r));
          }}
          disabled={!ready && pending.digits === ""}
          className="chip-btn chip-btn--primary"
        >
          <Check size={15} /> לוח
        </button>
        <button onClick={() => onDone(null)} className="chip-btn">
          <X size={15} /> ביטול
        </button>
      </div>
    </div>
  );
}
