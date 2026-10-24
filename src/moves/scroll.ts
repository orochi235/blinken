import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import type { Placed } from '../orders.js';
import type { Values } from '../params.js';
import { move, rowOf } from './move.js';

const PARAMS = {
  direction: {
    label: 'direction',
    choices: ['left', 'right'],
    value: 'left',
    about: 'Which way the message travels.',
  },
  step: {
    label: 'column time',
    min: 10,
    max: 200,
    step: 1,
    value: 45,
    unit: 'ms',
    about: 'How long the message waits before moving one column. Higher scrolls more slowly.',
  },
} as const;
type Scroll = Values<typeof PARAMS>;

/** Where the message's left edge is, in dot columns, off the sign at each end and standing. */
const edges = (at: Placed, p: Scroll) => {
  const left = p.direction === 'left';
  return {
    off: left ? at.board.cols : -at.text.cols,
    away: left ? -at.text.cols : at.board.cols,
    rest: at.left,
  };
};

const crossing = (p: Scroll, from: number, to: number) => Math.max(1, Math.abs(to - from)) * p.step;

/** The message sliding a whole column at a time, its left edge going from `from` to `to`. */
function slide(at: Placed, p: Scroll, from: number, to: number) {
  const steps = Math.abs(to - from);
  const sign = Math.sign(to - from);
  return patch<Led, Pose>(
    crossing(p, from, to),
    (phase, led) => {
      const moved = Math.min(steps, Math.floor(phase * steps));
      const row = rowOf(led);
      return { lit: row >= 0 && at.text.lit(led.x - (from + sign * moved), row) ? 1 : 0 };
    },
    { writes: ['lit'] },
  );
}

/** The message sliding in from one edge to rest where `stand` shows it. */
export const scrollIn = move({
  name: 'scroll-in',
  about: 'Slides in from an edge and stops where the message stands.',
  slot: 'enter',
  params: PARAMS,
  wide: true,
  patch: (at, p) => slide(at, p, edges(at, p).off, edges(at, p).rest),
});

/** The message sliding out of an edge from where `stand` shows it. */
export const scrollOut = move({
  name: 'scroll-out',
  about: 'Slides out to an edge, starting where the message stands.',
  slot: 'exit',
  params: PARAMS,
  wide: true,
  patch: (at, p) => slide(at, p, edges(at, p).rest, edges(at, p).away),
});

/** The message crossing the whole sign, in at one edge and out at the other. */
export const scrollAcross = move({
  name: 'scroll-across',
  about: 'Crosses the sign, in at one edge and out at the other.',
  slot: 'active',
  params: PARAMS,
  wide: true,
  patch: (at, p) => slide(at, p, edges(at, p).off, edges(at, p).away),
});
