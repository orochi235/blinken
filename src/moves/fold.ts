import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import { ROWS } from '../font.js';
import type { Placed } from '../orders.js';
import { move, rowOf } from './move.js';

const MID = (ROWS - 1) / 2;
const QUARTER = Math.PI / 2;
const FOLD_PARAM = {
  label: 'fold time',
  min: 50,
  max: 1000,
  step: 10,
  value: 300,
  unit: 'ms',
  about: 'How long the letters take to turn between flat and edge on. Higher turns more slowly.',
};

/** Draws a letter turned `angle` radians about its horizontal middle; edge on it is a line. */
function turned(at: Placed) {
  const { text } = at;
  const any = Array.from({ length: text.cols }, (_, x) =>
    Array.from({ length: ROWS }, (_, y) => text.lit(x, y)).some(Boolean),
  );
  return (led: Led, angle: number) => {
    const row = rowOf(led);
    const x = led.x - at.left;
    if (row < 0) return { lit: 0 };
    const s = Math.cos(angle);
    if (Math.abs(s) < 0.18) return { lit: row === MID && any[x] ? 1 : 0 };
    return { lit: text.lit(x, Math.round(MID + (row - MID) / s)) ? 1 : 0 };
  };
}

/** Letters open from edge on to flat. */
export const unfold = move({
  name: 'unfold',
  about: 'Letters unfold from edge on to flat.',
  slot: 'enter',
  params: { ms: FOLD_PARAM },
  patch(at, p) {
    const draw = turned(at);
    return patch<Led, Pose>(p.ms, (phase, led) => draw(led, QUARTER * (1 - phase)), {
      writes: ['lit'],
    });
  },
});

/** Letters close from flat to edge on and vanish. */
export const fold = move({
  name: 'fold',
  about: 'Letters fold from flat to edge on and vanish.',
  slot: 'exit',
  params: { ms: FOLD_PARAM },
  patch(at, p) {
    const draw = turned(at);
    return patch<Led, Pose>(
      p.ms,
      (phase, led) => (phase >= 1 ? { lit: 0 } : draw(led, QUARTER * phase)),
      {
        writes: ['lit'],
      },
    );
  },
});

/** Letters turn end over end in the middle third of the pass, standing upright either side. */
export const tumble = move({
  name: 'tumble',
  about: 'Letters stand, turn end over end, and stand again.',
  slot: 'active',
  params: {
    ms: {
      label: 'length',
      min: 200,
      max: 10000,
      step: 100,
      value: 1200,
      unit: 'ms',
      about:
        'How long one pass lasts. The letters tumble in its middle third and stand still either side.',
    },
    turns: {
      label: 'turns',
      min: 0,
      max: 6,
      step: 1,
      value: 2,
      about: 'How many times each letter turns end over end. At 0 they stand still.',
    },
  },
  patch(at, p) {
    const draw = turned(at);
    // Tumbling in the middle third only, upright either side.
    const turn = (phase: number) => {
      const u = 3 * phase - 1;
      return u > 0 && u < 1 ? 2 * Math.PI * p.turns * u : 0;
    };
    return patch<Led, Pose>(p.ms, (phase, led) => draw(led, turn(phase)), { writes: ['lit'] });
  },
});
