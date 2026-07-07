import MathText from "../MathText";

/**
 * "Math lego" — one row of big tappable building blocks that insert LaTeX
 * skeletons (with MathLive placeholders) into the worksheet field. Built for
 * thumbs: solving on the bus should be tap-tap-tap, not LaTeX typing. Scrolls
 * horizontally on phones, wraps on desktop.
 */
interface Block {
  id: string;
  /** What gets inserted at the caret (MathLive placeholders = tap-through). */
  insert: string;
  /** KaTeX preview shown on the chip (□ marks the holes). */
  show: string;
  labelHe: string;
}

const BLOCKS: Block[] = [
  { id: "frac",  insert: "\\frac{\\placeholder{}}{\\placeholder{}}", show: "\\frac{\\square}{\\square}", labelHe: "שבר" },
  { id: "sqrt",  insert: "\\sqrt{\\placeholder{}}",                  show: "\\sqrt{\\square}",           labelHe: "שורש" },
  { id: "pow",   insert: "^{\\placeholder{}}",                       show: "\\square^{n}",               labelHe: "חזקה" },
  { id: "paren", insert: "\\left(\\placeholder{}\\right)",           show: "(\\square)",                 labelHe: "סוגריים" },
  { id: "x",     insert: "x",                                        show: "x",                          labelHe: "נעלם" },
  { id: "eq",    insert: "=",                                        show: "=",                          labelHe: "שוויון" },
  { id: "pi",    insert: "\\pi",                                     show: "\\pi",                       labelHe: "פאי" },
  { id: "sin",   insert: "\\sin\\left(\\placeholder{}\\right)",      show: "\\sin",                      labelHe: "סינוס" },
  { id: "cos",   insert: "\\cos\\left(\\placeholder{}\\right)",      show: "\\cos",                      labelHe: "קוסינוס" },
  { id: "ln",    insert: "\\ln\\left(\\placeholder{}\\right)",       show: "\\ln",                       labelHe: "לוגריתם" },
];

export default function BlocksBar({ onInsert }: { onInsert: (latex: string) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible pb-1" dir="ltr">
      {BLOCKS.map((b) => (
        <button
          key={b.id}
          onClick={() => onInsert(b.insert)}
          title={b.labelHe}
          className="chip-btn flex-shrink-0 min-w-[3rem]"
        >
          <MathText>{`$${b.show}$`}</MathText>
        </button>
      ))}
    </div>
  );
}
