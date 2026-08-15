import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import FaradayAvatar, { isLargePose } from "./FaradayAvatar";

/**
 * The size guard exists to catch a mistake that is invisible until someone
 * looks at a phone, so it needs to actually fire — and, just as importantly,
 * stay quiet the rest of the time.
 */

afterEach(() => vi.restoreAllMocks());

describe("full-body pose size guard", () => {
  it("warns when a full-body pose is rendered too small", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<FaradayAvatar pose="wave" px={40} />);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("wave");
  });

  it("stays quiet at a size where the face reads", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<FaradayAvatar pose="wave" px={96} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it("stays quiet for head-and-shoulders poses at any size", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<FaradayAvatar pose="idle" px={24} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not warn in fill mode, where the parent sets the size", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<FaradayAvatar pose="thumbsup" px={32} fill />);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns once per pose+size, not once per render", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rerender } = render(<FaradayAvatar pose="point" px={30} />);
    rerender(<FaradayAvatar pose="point" px={30} />);
    rerender(<FaradayAvatar pose="point" px={30} />);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("isLargePose", () => {
  it("marks the video-derived full-body poses", () => {
    expect(isLargePose("point")).toBe(true);
    expect(isLargePose("thumbsup")).toBe(true);
    expect(isLargePose("wave")).toBe(true);
  });

  it("leaves the sliced head-and-shoulders poses alone", () => {
    expect(isLargePose("idle")).toBe(false);
    expect(isLargePose("thinking")).toBe(false);
    expect(isLargePose("streak")).toBe(false);
  });
});
