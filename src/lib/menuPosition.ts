/**
 * Placement math for menus that are portalled to <body>.
 *
 * A dropdown rendered inside a column with `overflow-y-auto` gets sliced off at
 * the column's edge — an absolutely-positioned child cannot escape a scrolling
 * ancestor. The fix is to portal the menu out and position it from the button's
 * viewport rect, which means doing the clamping by hand.
 */

/**
 * Left offset (px, viewport coords) for a menu of `menuW` dropped from a button
 * whose right edge is at `buttonRight`. Aligns the menu's right edge with the
 * button's — the natural drop direction in this RTL app — then clamps so it
 * cannot start off the left edge or run past the right one.
 *
 * On a viewport narrower than the menu the left clamp wins: better to overhang
 * the right than to open with the first characters already off-screen.
 */
export function menuLeftFor(
  buttonRight: number,
  viewportW: number,
  menuW: number,
  gap = 8
): number {
  const ideal = buttonRight - menuW;
  const maxLeft = viewportW - menuW - gap;
  return Math.max(gap, Math.min(ideal, maxLeft));
}
