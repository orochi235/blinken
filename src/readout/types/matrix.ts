import { STANDARD } from '../../glyphs/standard.js';
import { type DisplayType, textCoding } from '../type.js';
import { disc, light } from './kit.js';

const COLS = 5;
const ROWS = 7;
/** A glyph's columns and the blank one after it, so the grid runs on unbroken from cell to cell. */
const PITCH = COLS + 1;

const lights = Array.from({ length: PITCH * ROWS }, (_, i) => {
  const [x, y] = [i % PITCH, Math.floor(i / PITCH)];
  return light(`${x},${y}`, disc(1 + x * 2, 1 + y * 2, 0.8));
});

const table = Object.fromEntries(
  Object.entries(STANDARD).map(([ch, rows]) => [
    ch,
    rows
      .flatMap((row, y) => [...row].map((c, x) => (c === '#' ? `${x},${y}` : '')))
      .filter(Boolean)
      .join(' '),
  ]),
);

/** A 5 × 7 dot matrix per character, in blinken's standard face, a blank column between characters. */
export const matrix: DisplayType = {
  name: 'matrix',
  cell: { width: PITCH * 2, height: ROWS * 2, lights },
  gap: 0,
  ends: 'round',
  socket: 'segment',
  glow: 1,
  align: 'left',
  ...textCoding(table),
  selection: 'invert',
};
