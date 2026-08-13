import { useRef } from "react";

// Shared drag protocol for the Math Playground. Pointer events, not HTML5
// drag-and-drop: `draggable` never fires on touch, so on a phone — which is
// where these students actually are — the old blocks could only be tapped. One
// hook drives blocks, formula rows, past results and operation bricks alike.
//
// Tap and drag lead to the same place: `onActivate`. A drag that ends off the
// target is a cancel, and it must not also register as a tap.

/** How far outside the target still counts as a hit. Thumbs on a moving bus. */
const HIT_PAD = 24;
/** Movement past this many px (taxicab) turns a tap into a drag. */
const DRAG_SLOP = 6;
/**
 * Put on the target element while a drag hovers it. Toggled on the DOM node
 * rather than through React state: several sources (blocks, formulas, results)
 * share one target, and routing every pointermove through a setState would mean
 * prop-drilling a setter to each of them and re-rendering the sheet at 60fps.
 */
const HOT_CLASS = "drop-target--hot";

interface Options<T> {
  /** The drop zone. Anything released over it (± HIT_PAD) activates. */
  targetRef: React.RefObject<HTMLElement | null>;
  onActivate: (payload: T) => void;
}

interface Session {
  id: number;
  x: number;
  y: number;
  moved: boolean;
}

export interface DragBindings {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onLostPointerCapture: (e: React.PointerEvent<HTMLElement>) => void;
  onClick: () => void;
}

/**
 * Returns `bind(payload)` — spread it onto any element to make it draggable
 * onto `targetRef`. Pair it with the `.drag-source` class, which supplies the
 * `touch-action: none` that keeps a drag from scrolling the sheet instead.
 */
export function usePointerDrag<T>({ targetRef, onActivate }: Options<T>) {
  const session = useRef<Session | null>(null);
  // A drag that landed already fired onActivate; swallow the click that follows.
  const swallowClick = useRef(false);

  const isOver = (e: React.PointerEvent) => {
    const r = targetRef.current?.getBoundingClientRect();
    if (!r) return false;
    return (
      e.clientX > r.left - HIT_PAD &&
      e.clientX < r.right + HIT_PAD &&
      e.clientY > r.top - HIT_PAD &&
      e.clientY < r.bottom + HIT_PAD
    );
  };

  const end = (el: HTMLElement) => {
    session.current = null;
    el.classList.remove("drag-source--lifted");
    el.style.transform = "";
    targetRef.current?.classList.remove(HOT_CLASS);
  };

  return (payload: T): DragBindings => ({
    onPointerDown: (e) => {
      const el = e.currentTarget;
      // Capture keeps the moves coming after the pointer leaves the brick. It
      // throws on an untracked pointerId; a drag without capture still works,
      // so never let that take the tap down with it.
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* no capture — pointermove still bubbles while the button is held */
      }
      session.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    },
    onPointerMove: (e) => {
      const d = session.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) > DRAG_SLOP) {
        d.moved = true;
        e.currentTarget.classList.add("drag-source--lifted");
      }
      if (!d.moved) return;
      e.currentTarget.style.transform = `translate(${dx}px, ${dy}px)`;
      targetRef.current?.classList.toggle(HOT_CLASS, isOver(e));
    },
    onPointerUp: (e) => {
      const d = session.current;
      if (!d || d.id !== e.pointerId) return;
      const dropped = d.moved && isOver(e);
      swallowClick.current = d.moved;
      end(e.currentTarget);
      if (dropped) onActivate(payload);
    },
    onLostPointerCapture: (e) => {
      if (session.current) {
        swallowClick.current = session.current.moved;
        end(e.currentTarget);
      }
    },
    onClick: () => {
      if (swallowClick.current) {
        swallowClick.current = false;
        return;
      }
      onActivate(payload);
    },
  });
}
