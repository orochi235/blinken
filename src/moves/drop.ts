import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import type { Placed } from '../orders.js';
import { litAt, move, on } from './move.js';

/** How far a dot falls from or to: past the text's top or bottom. */
const fall = (at: Placed) => at.text.rows + 1;

const DROP_PARAM = {
  label: 'drop time',
  min: 100,
  max: 1500,
  step: 25,
  value: 350,
  unit: 'ms',
  about: 'How long the fall takes. Higher drops more slowly.',
};

/** The message dropping in from above, speeding up as it comes. */
export const dropIn = move({
  name: 'drop-in',
  about: 'The message drops in from above.',
  slot: 'enter',
  params: { ms: DROP_PARAM },
  patch(at, p) {
    const drop = fall(at);
    return patch<Led, Pose>(
      p.ms,
      (phase, led) => on(litAt(at, led, 0, Math.round(-drop * (1 - phase ** 2)))),
      { writes: ['lit'] },
    );
  },
});

/** The message falling out of the bottom under gravity. */
export const dropOut = move({
  name: 'drop-out',
  about: 'The message falls out the bottom.',
  slot: 'exit',
  params: { ms: DROP_PARAM },
  patch(at, p) {
    const drop = fall(at);
    return patch<Led, Pose>(
      p.ms,
      (phase, led) => on(litAt(at, led, 0, Math.round(drop * phase ** 2))),
      { writes: ['lit'] },
    );
  },
});
