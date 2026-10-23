import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import type { Placed } from '../orders.js';
import type { Values } from '../params.js';
import { move, rowOf } from './move.js';

const PARAMS = {
  direction: { label: 'direction', choices: ['left', 'right'], value: 'left' },
  step: { label: 'column time', min: 10, max: 200, step: 1, value: 45, unit: 'ms' },
} as const;
type Scroll = Values<typeof PARAMS>;

/** Where the message's left edge is, relative to column 0, at the start and end of each crossing. */
const edges = (at: Placed, p: Scroll) => {
  const left = p.direction === 'left';
  return {
    off: left ? at.board.cols : -at.text.cols,
    away: left ? -at.text.cols : at.board.cols,
  };
};

/** The message sliding a whole column at a time from `from` to `to`, its left edge in dot columns. */
function slide(at: Placed, p: Scroll, from: number, to: number) {
  const steps = Math.abs(to - from);
  const sign = Math.sign(to - from);
  return patch<Led, Pose>(
    Math.max(1, steps) * p.step,
    (phase, led) => {
      const moved = Math.min(steps, Math.floor(phase * steps));
      const row = rowOf(led);
      return { lit: row >= 0 && at.text.lit(led.x - (from + sign * moved), row) ? 1 : 0 };
    },
    { writes: ['lit'] },
  );
}

const crossing = (p: Scroll, from: number, to: number) => Math.max(1, Math.abs(to - from)) * p.step;

/** The message sliding in from one edge to rest with its left edge at column 0. */
export const scrollIn = move({
  name: 'scroll-in',
  about: 'Slides in from an edge, stopping with its left edge at column 0.',
  slot: 'enter',
  params: PARAMS,
  length: (at, p) => crossing(p, edges(at, p).off, 0),
  patch: (at, p) => slide(at, p, edges(at, p).off, 0),
});

/** The message sliding out of an edge from column 0. */
export const scrollOut = move({
  name: 'scroll-out',
  about: 'Slides out to an edge, starting with its left edge at column 0.',
  slot: 'exit',
  params: PARAMS,
  length: (at, p) => crossing(p, 0, edges(at, p).away),
  patch: (at, p) => slide(at, p, 0, edges(at, p).away),
});

/** The message crossing the whole sign, in at one edge and out at the other. */
export const scrollAcross = move({
  name: 'scroll-across',
  about: 'Crosses the sign, in at one edge and out at the other.',
  slot: 'active',
  params: PARAMS,
  length: (at, p) => crossing(p, edges(at, p).off, edges(at, p).away),
  patch: (at, p) => slide(at, p, edges(at, p).off, edges(at, p).away),
});
