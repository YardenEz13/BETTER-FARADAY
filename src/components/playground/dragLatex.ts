// Shared drag-payload protocol for the Math Playground: blocks, formula rows
// and history results all publish their LaTeX under "text/latex" (with a
// "text/plain" fallback), and the worksheet field card consumes it on drop.

export const LATEX_MIME = "text/latex";

/** onDragStart handler that publishes a LaTeX payload. */
export function dragLatex(latex: string) {
  return (e: React.DragEvent) => {
    e.dataTransfer.setData(LATEX_MIME, latex);
    e.dataTransfer.setData("text/plain", latex);
    e.dataTransfer.effectAllowed = "copy";
  };
}

/** Read the LaTeX payload back out of a drop event (empty string if none). */
export function droppedLatex(e: React.DragEvent): string {
  return e.dataTransfer.getData(LATEX_MIME) || e.dataTransfer.getData("text/plain");
}
