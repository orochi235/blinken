import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import { clearAbove, move, movedAt, on } from './move.js';

/** How high each bounce rises against the one before. */
const REBOUND = 0.4;

/**
 * How far above its place the message is, in rows, `phase` of the way through a fall from
 * `height` and `bounces` rebounds, each a parabola and each lower than the last.
 */
export function bounced(height: number, bounces: number) {
  // A bounce rises at least a row, so the last one still shows.
  const heights = Array.from({ length: bounces }, (_, k) =>
    Math.max(1, height * REBOUND ** (k + 1)),
  );
  // Under gravity, falling from h takes time in proportion to √h; a bounce rises and falls.
  const legs = [Math.sqrt(height), ...heights.map((h) => 2 * Math.sqrt(h))];
  const total = legs.reduce((a, b) => a + b, 0);
  return (phase: number) => {
    let t = phase * total;
    const [fall = 0] = legs;
    if (t < fall) return height * (1 - (t / fall) ** 2);
    t -= fall;
    for (const [k, h] of heights.entries()) {
      const leg = legs[k + 1] as number;
      if (t < leg) {
        const u = (2 * t) / leg - 1;
        return h * (1 - u * u);
      }
      t -= leg;
    }
    return 0;
  };
}

/** The message dropping in from above the sign and bouncing to rest. */
export const bounceIn = move({
  name: 'bounce-in',
  about: 'The message drops in from above and bounces to rest, each bounce lower than the last.',
  slot: 'enter',
  params: {
    ms: {
      label: 'bounce time',
      min: 300,
      max: 4000,
      step: 50,
      value: 1300,
      unit: 'ms',
      about: 'How long the fall and every bounce take together. Higher bounces more slowly.',
    },
    bounces: {
      label: 'bounces',
      min: 0,
      max: 5,
      step: 1,
      value: 3,
      about: 'How many times the message bounces before it rests. At 0 it lands dead.',
    },
  },
  patch(at, p) {
    const above = bounced(clearAbove(at), p.bounces);
    return patch<Led, Pose>(p.ms, (phase, led) => on(movedAt(at, led, -Math.round(above(phase)))), {
      writes: ['lit'],
    });
  },
});
