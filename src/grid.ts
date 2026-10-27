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
