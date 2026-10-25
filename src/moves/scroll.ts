import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import type { Placed } from '../orders.js';
import type { Values } from '../params.js';
import { LOOSE, move } from './move.js';

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

/**
 * The message sliding a whole column at a time, its left edge going from each leg's start to its
 * end in turn: a later leg starts where the one before left the sign, at the other edge.
 */
function slide(at: Placed, p: Scroll, ...legs: (readonly [number, number])[]) {
  const steps = legs.map(([from, to]) => Math.abs(to - from));
  const total = steps.reduce((a, b) => a + b, 0);
  /** The left edge `k` columns into the slide. */
  const edgeAt = (k: number) => {
    for (const [i, [from, to]] of legs.entries()) {
      const n = steps[i] as number;
      if (k <= n || i === legs.length - 1) return from + Math.sign(to - from) * Math.min(k, n);
      k -= n;
    }
    return 0;
  };
  return patch<Led, Pose>(
    Math.max(1, total) * p.step,
    (phase, led) => {
      const x = edgeAt(Math.min(total, Math.floor(phase * total)));
      const row = at.rowOf(led);
      return { lit: row >= 0 ? at.text.level(led.x - x, row) : 0 };
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
  patch: (at, p) => slide(at, p, [edges(at, p).off, edges(at, p).rest]),
});

/** The message sliding out of an edge from where `stand` shows it. */
export const scrollOut = move({
  name: 'scroll-out',
  about: 'Slides out to an edge, starting where the message stands.',
  slot: 'exit',
  params: PARAMS,
  wide: true,
  patch: (at, p) => slide(at, p, [edges(at, p).rest, edges(at, p).away]),
});

/**
 * The message crossing the whole sign, in at one edge and out at the other. After an enter move it
 * starts where that left the message standing, and before an exit move it comes round again to
 * stand there, so the effect never jumps.
 */
export const scrollAcross = move({
  name: 'scroll-across',
  about:
    'Crosses the sign, in at one edge and out at the other, carrying on from where an enter move leaves the message and coming back round for an exit move.',
  slot: 'active',
  params: PARAMS,
  wide: true,
  patch: (at, p, joins = LOOSE) => {
    const { off, away, rest } = edges(at, p);
    const start = joins.from ? rest : off;
    if (!joins.to) return slide(at, p, [start, away]);
    return start === rest ? slide(at, p, [rest, away], [off, rest]) : slide(at, p, [off, rest]);
  },
});
