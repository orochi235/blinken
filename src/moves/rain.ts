import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import { hash } from '../hash.js';
import type { Placed } from '../orders.js';
import type { Values } from '../params.js';
import { litAt, move } from './move.js';

const RAIN_PARAMS = {
  ms: { label: 'rain time', min: 300, max: 6000, step: 50, value: 2200, unit: 'ms' },
  drops: { label: 'drops', min: 1, max: 8, step: 1, value: 3 },
  tail: { label: 'tail', min: 1, max: 20, step: 1, value: 3, unit: 'dots' },
  spread: { label: 'stagger', min: 0, max: 0.9, step: 0.05, value: 0.6 },
  churn: { label: 'churn', min: 0, max: 60, step: 1, value: 24 },
};
type Rain = Values<typeof RAIN_PARAMS>;

/**
 * `drops` streams per column, each starting at its own random delay and falling past the bottom
 * with its tail; `shown(led, passed)` says whether a dot shows the message once some drop has or
 * while none has passed it.
 */
function rain(at: Placed, p: Rain, shown: (led: Led, passed: boolean) => boolean) {
  const rows = at.board.rows;
  const delays = Array.from({ length: at.board.cols }, (_, x) =>
    Array.from({ length: p.drops }, (_, j) => p.spread * hash(x, j, rows)),
  );
  return (phase: number, led: Led) => {
    let passed = false;
    let lit = 0;
    for (const delay of delays[led.x] ?? []) {
      const u = Math.min(1, Math.max(0, (phase - delay) / (1 - p.spread)));
      const behind = Math.floor(-1 + u * (rows + p.tail + 1)) - led.y;
      if (behind > 0) passed = true;
      if (behind === 0) lit = 1;
      else if (behind > 0 && behind <= p.tail) {
        // The tail fades from the head and churns like a column of changing glyphs.
        const flick = hash(led.x, led.y, Math.floor(phase * p.churn)) < 0.7 ? 1 : 0.3;
        lit = Math.max(lit, (1 - behind / (p.tail + 1)) * flick);
      }
    }
    return { lit: shown(led, passed) ? 1 : lit };
  };
}

/** Streams of falling dots down every column, each leaving the message lit where it passed. */
export const rainIn = move({
  name: 'rain-in',
  about: 'Streams of dots fall down every column, leaving the message behind them.',
  slot: 'enter',
  params: RAIN_PARAMS,
  patch(at, p) {
    const draw = rain(at, p, (led, passed) => passed && litAt(at, led));
    return patch<Led, Pose>(p.ms, draw, { writes: ['lit'] });
  },
});

/** Streams of falling dots down every column, each washing the message away as it passes. */
export const rainOut = move({
  name: 'rain-out',
  about: 'Streams of dots fall down every column, washing the message away.',
  slot: 'exit',
  params: RAIN_PARAMS,
  patch(at, p) {
    const draw = rain(at, p, (led, passed) => !passed && litAt(at, led));
    return patch<Led, Pose>(p.ms, draw, { writes: ['lit'] });
  },
});
