import type { Board } from './board.js';

/**
 * Where a dot at column `x`, row `y` is drawn, in dot pitches; a border bulb between places is
 * drawn by the same rule. Neighboring dots should land about a pitch apart. Only the shape is
 * read: the sign is fitted to wherever its dots land.
 */
export type Grid = (x: number, y: number) => readonly [number, number];

/**
 * The grids a sign can be given by name. `square` sets each row under the last; `hex` sets each
 * half a dot left of the one above, rows √3/2 apart, so every dot has six neighbors a pitch away
 * and columns run on a slant, leaning the text like italics.
 */
export const GRIDS = {
  square: (x, y) => [x, y],
  hex: (x, y) => [x - y / 2, (y * Math.sqrt(3)) / 2],
} as const satisfies Record<string, Grid>;

export type GridName = keyof typeof GRIDS;

export const gridOf = (grid: GridName | Grid = 'square'): Grid =>
  typeof grid === 'function' ? grid : GRIDS[grid];

/**
 * The sign's extent on `grid`, in pitches: its top left corner, and how far it runs across and
 * down. A point `p` pitches in sits at `p - left` (or `- top`) of the canvas's pitch-sized units.
 */
export function frameOf(
  b: Board,
  grid: Grid = GRIDS.square,
): { left: number; top: number; across: number; down: number } {
  // One pass rather than spreading every dot into Math.min, which a large sign overflows.
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const d of b.dots) {
    const [x, y] = grid(d.x, d.y);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const pad = b.margin + 0.5;
  const left = x0 - pad;
  const top = y0 - pad;
  return { left, top, across: x1 + pad - left, down: y1 + pad - top };
}
