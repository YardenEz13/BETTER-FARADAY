import { useMemo, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useLetterJump } from "../lib/gsapUtils";

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
  /**
   * Wraps every plain-text character in a `.jump-char` span (words stay atomic
   * for bidi/wrapping; KaTeX blocks animate as one unit) so useLetterJump can
   * stagger them in. Markup-only — pair with the hook to actually animate.
   */
  animateLetters?: boolean;
}

// Regex to find math delimiters: $$...$$, $...$, \[...\], \(...\)
const MATH_REGEX = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const wrapChars = (s: string) =>
  Array.from(s)
    .map((ch) => `<span class="jump-char">${escapeHtml(ch)}</span>`)
    .join("");

/** Per-character spans, grouped per word. Inline-block chars are bidi-atomic,
 *  so every maximal Latin/digit run gets an explicit LTR embedding — including
 *  runs glued to Hebrew inside one token (e.g. "ו-a_n=5"), which would
 *  otherwise visually reverse under the RTL base direction. */
function splitToJumpChars(text: string): string {
  return text
    .split(/(\s+)/)
    .map((token) => {
      if (!token) return "";
      if (/^\s+$/.test(token)) return escapeHtml(token);
      if (!/[֐-׿]/.test(token)) {
        const dir = /[A-Za-z0-9]/.test(token) ? ' dir="ltr"' : "";
        return `<span class="jump-word"${dir}>${wrapChars(token)}</span>`;
      }
      // Mixed token: capture group = maximal run that starts and ends with a
      // Latin/digit char (neutrals like "-" stay outside, in the RTL flow).
      const html = token
        .split(/([A-Za-z0-9](?:[^֐-׿]*[A-Za-z0-9])?)/)
        .map((part, i) =>
          !part ? "" : i % 2 === 1 ? `<span dir="ltr">${wrapChars(part)}</span>` : wrapChars(part),
        )
        .join("");
      return `<span class="jump-word">${html}</span>`;
    })
    .join("");
}

export default function MathText({ children, className, style, animateLetters }: Props) {
  const rootRef = useRef<HTMLSpanElement>(null);
  // Self-animates whenever the text changes; disabled = zero DOM work.
  useLetterJump(rootRef, [children, animateLetters], { enabled: !!animateLetters });

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
          const html = katex.renderToString(tex, {
            displayMode: true,
            throwOnError: false,
            strict: "ignore",
            output: "html",
          });
          // a formula jumps in as a single unit — never split KaTeX internals
          return animateLetters ? `<span class="jump-char">${html}</span>` : html;
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
          const html = katex.renderToString(tex, {
            displayMode: false,
            throwOnError: false,
            strict: "ignore",
            output: "html",
          });
          return animateLetters ? `<span class="jump-char">${html}</span>` : html;
        } catch {
          return part;
        }
      }

      // Plain text — escape HTML (optionally split for the letter-jump reveal)
      return animateLetters ? splitToJumpChars(part) : escapeHtml(part);
    }).join("");
  }, [children, animateLetters]);

  return (
    <span
      ref={rootRef}
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

