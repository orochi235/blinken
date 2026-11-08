import { anchorOf, extend, press, reachAt } from './across.js';
import { wordAt } from './flow.js';
import { cellAt, type One, type Pressing } from './text-cells.js';

// The browser selects nothing reliably across separately placed cells, so a press is read here,
// a whole cell at a time: drag, double-click for a word, triple-click for it all.

/** The first and last cell of the word shown in cell `k` of `r`, or null on a blank. */
function wordCells(r: One, k: number): readonly [number, number] | null {
  const i = r.places.indexOf(k);
  const w = i >= 0 ? wordAt([...r.copied], i) : null;
  if (!w) return null;
  const cells = r.places.slice(w[0], w[1]).filter((p) => p >= 0);
  return [Math.min(...cells), Math.max(...cells)];
}

/** Selects all of `r`. */
export const all = (c: Pressing, r: One) =>
  extend(c.doc, r.reach, r.cells.length - 1, { r: r.reach, k: 0 });

/** A press on a readout that isn't typed into. */
export function pressRead(c: Pressing, r: One, e: MouseEvent): void {
  const { doc } = c;
  // Focused, so the keyboard reaches it: Cmd+A selects it, as in a field.
  r.group.focus({ preventScroll: true });
  const k = cellAt(r, e.clientX, e.clientY);
  if (e.detail >= 3) {
    all(c, r);
    return;
  }
  if (e.detail === 2) {
    const w = wordCells(r, k);
    if (w) extend(doc, r.reach, w[1], { r: r.reach, k: w[0] });
    return;
  }
  // Shift+click extends from the last press, in this readout or another; a drag runs on into
  // whichever readout the pointer reaches, as across text, and stays with the last it reached.
  if (e.shiftKey && anchorOf(doc)) extend(doc, r.reach, k);
  else press(doc, { r: r.reach, k });
  const from = anchorOf(doc);
  let over = r.reach;
  const x0 = e.clientX;
  c.drag((m) => {
    over = reachAt(doc, m.clientX, m.clientY) ?? over;
    const to = over.cellAt(m.clientX, m.clientY);
    if (over === from?.r && Math.abs(m.clientX - x0) < 3 && to === from.k) return;
    extend(doc, over, to);
  });
}
