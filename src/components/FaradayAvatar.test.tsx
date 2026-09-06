import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import FaradayAvatar from "./FaradayAvatar";

/**
 * What is left worth testing here is the fallback and the blink pairing. The
 * full-body size guard this file used to cover is gone with the poses that
 * needed it — every pose is a head crop now, so there is no size at which one
 * of them turns to mush.
 */

describe("FaradayAvatar", () => {
  it("renders the requested pose", () => {
    render(<FaradayAvatar pose="thinking" px={64} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/faraday-thinking.png");
  });

  it("falls back to the Bot icon when the art fails to load", () => {
    const { container } = render(<FaradayAvatar pose="happy" px={64} />);
    fireEvent.error(container.querySelector("img")!);
    // The fallback is an inline SVG, so no <img> should survive.
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("stacks the blink frame under idle, and only under idle", () => {
    const { container: idle } = render(<FaradayAvatar pose="idle" px={64} />);
    expect(idle.querySelector('img[src="/faraday-blink.png"]')).not.toBeNull();

    const { container: happy } = render(<FaradayAvatar pose="happy" px={64} />);
    expect(happy.querySelector('img[src="/faraday-blink.png"]')).toBeNull();
  });
});
