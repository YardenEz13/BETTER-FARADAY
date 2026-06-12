import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import MathText from "./MathText";

describe("MathText Component", () => {
  it("should render plain Hebrew text without modification", () => {
    render(<MathText>שלום לכולם, ברוכים הבאים</MathText>);
    const element = screen.getByText("שלום לכולם, ברוכים הבאים");
    expect(element).toBeInTheDocument();
  });

  it("should render inline math expressions using KaTeX", () => {
    const { container } = render(<MathText>האיבר הכללי הוא $a_n = a_1 + (n-1)d$ בסדרה.</MathText>);
    
    // KaTeX outputs math HTML structures (like katex-html, mathml, etc.)
    expect(container.querySelector(".katex")).toBeInTheDocument();
    expect(container.querySelector(".katex-html")).toBeInTheDocument();
    
    // It should render the plain text parts as well
    expect(container.textContent).toContain("האיבר הכללי הוא");
    expect(container.textContent).toContain("בסדרה.");
  });

  it("should render display math expressions with displayMode=true", () => {
    const { container } = render(
      <MathText>{"חישוב הגבול: $$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$"}</MathText>
    );
    expect(container.querySelector(".katex-display")).toBeInTheDocument();
    expect(container.textContent).toContain("חישוב הגבול:");
  });

  it("should escape plain text and not inject arbitrary HTML", () => {
    const { container } = render(<MathText>{"<script>alert('xss')</script>"}</MathText>);
    // It should render as escaped text
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toBe("<script>alert('xss')</script>");
  });
});

