import { bin, eq, group, hole, num, pow, root, variable, type Node } from "../../services/exprBricks";

/**
 * The parts bin doubles as a return tray: drag a brick off the board onto it
 * and the brick comes out, leaving its socket behind. Without that, a piece
 * dropped in the wrong hole could only be undone with the undo button.
 */
export const PALETTE_DROP = "__palette";

export interface Piece {
  id: string;
  /** A fresh copy every time — one palette piece feeds an unlimited board. */
  make: () => Node;
  /** What the chip shows. `□` marks the holes the piece brings with it. */
  label: string;
  wide?: boolean;
}

const DIGITS: Piece[] = Array.from({ length: 10 }, (_, d) => ({
  id: `d${d}`,
  make: () => num(d),
  label: String(d),
}));

const SYMBOLS: Piece[] = [
  { id: "x", make: () => variable("x"), label: "x" },
  { id: "n", make: () => variable("n"), label: "n" },
  { id: "a", make: () => variable("a"), label: "a" },
];

const SHAPES: Piece[] = [
  { id: "add", make: () => bin("+"), label: "□+□", wide: true },
  { id: "sub", make: () => bin("−"), label: "□−□", wide: true },
  { id: "mul", make: () => bin("×"), label: "□×□", wide: true },
  { id: "div", make: () => bin("÷"), label: "□÷□", wide: true },
  { id: "pow2", make: () => pow(hole(), num(2)), label: "□²" },
  { id: "pow", make: () => pow(), label: "□^□", wide: true },
  { id: "root", make: () => root(), label: "√□" },
  { id: "paren", make: () => group(), label: "(□)" },
  { id: "eq", make: () => eq(), label: "□=□", wide: true },
];

interface Props {
  /** The board's drag binding — pieces are dropped onto its holes. */
  bind: (cargo: { from: "palette"; piece: Piece }) => Record<string, unknown>;
}

/**
 * The parts bin. Everything the board can be built from, and the only way to
 * put anything on it — there is no keyboard anywhere in this screen.
 *
 * Two rows on purpose: digits and names on top because they are what a student
 * reaches for most, structures below because they are bigger targets and get
 * dragged less often.
 */
export default function PiecePalette({ bind }: Props) {
  const chip = (p: Piece) => (
    <button
      key={p.id}
      {...bind({ from: "palette", piece: p })}
      className={`xb-piece drag-source ${p.wide ? "xb-piece--wide" : ""}`}
    >
      {p.label}
    </button>
  );

  return (
    <div className="xb-palette flex-shrink-0" data-drop={PALETTE_DROP} dir="ltr">
      <div className="xb-palette__row">{[...DIGITS, ...SYMBOLS].map(chip)}</div>
      <div className="xb-palette__row">{SHAPES.map(chip)}</div>
    </div>
  );
}
