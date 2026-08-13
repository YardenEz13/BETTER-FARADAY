import MathText from "../MathText";
import { usePointerDrag } from "./usePointerDrag";

/**
 * "Math lego" — the pieces the line on the board is built from. Two rows:
 * numbers and signs on top, structures below. Tap to insert at the caret, or
 * drag onto the board; both work with one thumb, which is the point — solving
 * on the bus should never need a LaTeX keyboard.
 */
interface Block {
  id: string;
  /** What gets inserted at the caret (MathLive placeholders = tap-through). */
  insert: string;
  /** KaTeX preview shown on the chip (□ marks the holes). */
  show: string;
  labelHe?: string;
}

/** Digits and signs — the literal "drag a number onto it" row. */
const ATOMS: Block[] = [
  ...Array.from({ length: 10 }, (_, n) => ({ id: `d${n}`, insert: `${n}`, show: `${n}` })),
  { id: "plus",  insert: "+",        show: "+" },
  { id: "minus", insert: "-",        show: "-" },
  { id: "times", insert: "\\cdot ",  show: "\\cdot" },
  { id: "over",  insert: "/",        show: "\\div" },
  { id: "eq",    insert: "=",        show: "=" },
  { id: "x",     insert: "x",        show: "x" },
  { id: "y",     insert: "y",        show: "y" },
];

/** Structures — the pieces with holes in them. */
const SHAPES: Block[] = [
  { id: "frac",  insert: "\\frac{\\placeholder{}}{\\placeholder{}}", show: "\\frac{\\square}{\\square}", labelHe: "שבר" },
  { id: "sqrt",  insert: "\\sqrt{\\placeholder{}}",                  show: "\\sqrt{\\square}",           labelHe: "שורש" },
  { id: "pow",   insert: "^{\\placeholder{}}",                       show: "\\square^{n}",               labelHe: "חזקה" },
  { id: "paren", insert: "\\left(\\placeholder{}\\right)",           show: "(\\square)",                 labelHe: "סוגריים" },
  { id: "pi",    insert: "\\pi",                                     show: "\\pi",                       labelHe: "פאי" },
  { id: "sin",   insert: "\\sin\\left(\\placeholder{}\\right)",      show: "\\sin",                      labelHe: "סינוס" },
  { id: "cos",   insert: "\\cos\\left(\\placeholder{}\\right)",      show: "\\cos",                      labelHe: "קוסינוס" },
  { id: "ln",    insert: "\\ln\\left(\\placeholder{}\\right)",       show: "\\ln",                       labelHe: "לוגריתם" },
];

interface Props {
  onInsert: (latex: string) => void;
  /** The board blocks are dropped onto. */
  dropRef: React.RefObject<HTMLElement | null>;
}

export default function BlocksBar({ onInsert, dropRef }: Props) {
  const bind = usePointerDrag<string>({ targetRef: dropRef, onActivate: onInsert });

  return (
    <div className="flex flex-col gap-1.5" dir="ltr">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible px-0.5">
        {ATOMS.map((b) => (
          <button key={b.id} {...bind(b.insert)} className="lego lego--atom drag-source">
            <MathText>{`$${b.show}$`}</MathText>
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible pb-1.5 px-0.5">
        {SHAPES.map((b) => (
          <button key={b.id} {...bind(b.insert)} title={b.labelHe} className="lego drag-source">
            <MathText>{`$${b.show}$`}</MathText>
            <span className="font-label-md text-on-surface-variant" style={{ fontSize: "10px" }}>
              {b.labelHe}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
