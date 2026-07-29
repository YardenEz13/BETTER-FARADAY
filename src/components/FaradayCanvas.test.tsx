import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import FaradayCanvas from "./FaradayCanvas";

/**
 * The backdrop runs a full-screen rAF loop on every screen it appears on,
 * including phones. What matters here is that it stops when nobody can see it
 * and that a static (reduced-motion) backdrop still follows a theme swap —
 * neither is visible in a screenshot, so both get a test.
 */

let reduceMotion = false;
let ioCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
let hidden = false;

vi.mock("../lib/gsapUtils", () => ({ prefersReducedMotion: () => reduceMotion }));
vi.mock("./ThemeContext", () => ({ useTheme: () => ({ theme: "light" }) }));

/** Frames rendered since the last reset — the variant's draw() is what we count. */
let frames = 0;
vi.mock("./faraday/variants", () => ({
  makeVariant: () => {
    const draw = () => { frames++; };
    return draw;
  },
}));

beforeEach(() => {
  frames = 0;
  reduceMotion = false;
  hidden = false;
  ioCallback = null;

  // jsdom has no 2d context, and the harness bails out without one. The
  // variant is mocked, so `scale` is the only method that actually gets called.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    { scale: () => {} } as unknown as CanvasRenderingContext2D,
  );

  vi.stubGlobal("IntersectionObserver", class {
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { ioCallback = cb; }
    observe() {}
    disconnect() { ioCallback = null; }
  });
  vi.stubGlobal("ResizeObserver", class {
    observe() {} disconnect() {}
  });
  Object.defineProperty(document, "hidden", { get: () => hidden, configurable: true });

  // Drive rAF by hand so a "frame" is deterministic rather than wall-clock.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(performance.now()), 0) as unknown as number;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});

afterEach(() => {
  // Unmount BEFORE the stubs come off. Testing Library's own auto-cleanup runs
  // after this hook, by which point cancelAnimationFrame would be the real one
  // again — it would not recognise the setTimeout ids the stub handed out, so
  // the loops would survive into the next test and corrupt its frame count.
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const flush = async (ms = 30) => {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
};

describe("FaradayCanvas", () => {
  it("stops painting once the canvas scrolls off screen, and resumes", async () => {
    render(<div><FaradayCanvas variant="atom" /></div>);
    await flush();
    expect(frames).toBeGreaterThan(0);

    act(() => ioCallback?.([{ isIntersecting: false }]));
    const atPause = frames;
    await flush();
    expect(frames).toBe(atPause); // nothing drawn while off screen

    act(() => ioCallback?.([{ isIntersecting: true }]));
    await flush();
    expect(frames).toBeGreaterThan(atPause);
  });

  it("stops painting while the tab is hidden", async () => {
    render(<div><FaradayCanvas variant="atom" /></div>);
    await flush();

    hidden = true;
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    const atPause = frames;
    await flush();
    expect(frames).toBe(atPause);
  });

  it("repaints a reduced-motion backdrop when the palette swaps", async () => {
    reduceMotion = true;
    const { rerender } = render(<div><FaradayCanvas variant="atom" theme="light" /></div>);
    await flush();
    // Reduced motion paints a static frame — it must not settle into a loop.
    const afterMount = frames;
    expect(afterMount).toBeGreaterThan(0);
    await flush();
    expect(frames).toBe(afterMount);

    rerender(<div><FaradayCanvas variant="atom" theme="dark" /></div>);
    await flush();
    expect(frames).toBeGreaterThan(afterMount); // the swap repainted it
  });

  it("defaults to the design system's behind-UI opacity, and yields to a caller", () => {
    const { container, rerender } = render(<div><FaradayCanvas variant="atom" /></div>);
    expect((container.querySelector("canvas") as HTMLCanvasElement).style.opacity).toBe("0.64");

    rerender(<div><FaradayCanvas variant="atom" style={{ opacity: 0.5 }} /></div>);
    expect((container.querySelector("canvas") as HTMLCanvasElement).style.opacity).toBe("0.5");
  });
});
