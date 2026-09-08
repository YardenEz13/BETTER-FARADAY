import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FocusModeProvider, FocusToggle, useFocusMode } from "./FocusModeContext";

/**
 * Focus mode has two consumers that can drift apart: the pages read the boolean
 * from the hook, and index.css reads data-focus off <html>. These lock the
 * contract between them, plus the persistence the whole mode rests on — a
 * student who turns it on and reloads must not land back in the loud UI.
 */

function Probe() {
  const { focus } = useFocusMode();
  return <span data-testid="state">{focus ? "on" : "off"}</span>;
}

const renderMode = () =>
  render(
    <FocusModeProvider>
      <FocusToggle />
      <Probe />
    </FocusModeProvider>,
  );

const toggle = () => fireEvent.click(screen.getByRole("button"));
const state = () => screen.getByTestId("state").textContent;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-focus");
});

describe("focus mode", () => {
  it("defaults off, with no data-focus on the document", () => {
    renderMode();
    expect(state()).toBe("off");
    expect(document.documentElement.hasAttribute("data-focus")).toBe(false);
  });

  it("toggling on flips the hook, the document attribute and storage together", () => {
    renderMode();
    toggle();
    expect(state()).toBe("on");
    expect(document.documentElement.getAttribute("data-focus")).toBe("on");
    expect(localStorage.getItem("faraday_focus_mode")).toBe("on");
  });

  it("toggling back off clears the attribute the CSS keys off", () => {
    renderMode();
    toggle();
    toggle();
    expect(state()).toBe("off");
    expect(document.documentElement.hasAttribute("data-focus")).toBe(false);
    expect(localStorage.getItem("faraday_focus_mode")).toBe("off");
  });

  it("restores a stored preference on mount", () => {
    localStorage.setItem("faraday_focus_mode", "on");
    renderMode();
    expect(state()).toBe("on");
    expect(document.documentElement.getAttribute("data-focus")).toBe("on");
  });

  it("exposes the toggle's state to assistive tech", () => {
    renderMode();
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
    toggle();
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });
});
