import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * MathText — Renders text with inline LaTeX math expressions.
 * 
 * Supports:
 * - Inline math: $...$  or \(...\)
 * - Display math: $$...$$ or \[...\]
 * 
 * Non-math text is rendered as-is. Hebrew text flows naturally in RTL.
 */
interface Props {
  children: string;
  className?: string;
  style?: React.CSSProperties;
}

// Regex to find math delimiters: $$...$$, $...$, \[...\], \(...\)
const MATH_REGEX = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;

export default function MathText({ children, className, style }: Props) {
  const rendered = useMemo(() => {
    if (!children) return "";
    
    const parts = children.split(MATH_REGEX);
    
    return parts.map((part) => {
      // Display math: $$...$$ or \[...\]
      if (
        (part.startsWith("$$") && part.endsWith("$$")) ||
        (part.startsWith("\\[") && part.endsWith("\\]"))
      ) {
        const tex = part.startsWith("$$")
          ? part.slice(2, -2).trim()
          : part.slice(2, -2).trim();
        try {
          return katex.renderToString(tex, {
            displayMode: true,
            throwOnError: false,
            strict: "ignore",
            output: "html",
          });
        } catch {
          return part;
        }
      }

      // Inline math: $...$ or \(...\)
      if (
        (part.startsWith("$") && part.endsWith("$") && part.length > 2) ||
        (part.startsWith("\\(") && part.endsWith("\\)"))
      ) {
        const tex = part.startsWith("$")
          ? part.slice(1, -1).trim()
          : part.slice(2, -2).trim();
        try {
          return katex.renderToString(tex, {
            displayMode: false,
            throwOnError: false,
            strict: "ignore",
            output: "html",
          });
        } catch {
          return part;
        }
      }

      // Plain text — escape HTML
      return part
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }).join("");
  }, [children]);

  return (
    <span
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}
