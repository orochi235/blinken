import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import { ROWS } from '../font.js';
import { move } from './move.js';

/** The message repeated over the whole sign in tilted brick rows, neighbors scrolling opposite ways; one pass is one period, so it loops without a seam. */
export const tile = move({
  name: 'tile',
  about: 'Repeats the message in tilted brick rows, neighbors scrolling opposite ways.',
  slot: 'active',
  params: {
    angle: {
      label: 'tilt',
      min: -60,
      max: 60,
      step: 1,
      value: 30,
      unit: '°',
      about:
        'How steeply the rows of text slant. At 0 they run level; negative slants the other way.',
    },
    step: {
      label: 'column time',
      min: 10,
      max: 300,
      step: 5,
      value: 60,
      unit: 'ms',
      about: 'How long the rows wait before moving one column. Higher scrolls more slowly.',
    },
    gap: {
      label: 'gap',
      min: 0,
      max: 30,
      step: 1,
      value: 6,
      unit: 'cols',
      about: 'How many blank columns separate each copy of the message from the next along a row.',
    },
    leading: {
      label: 'row gap',
      min: 1,
      max: 6,
      step: 1,
      value: 2,
      unit: 'rows',
      about: 'How many blank rows separate one row of text from the next.',
    },
    brick: {
      label: 'brick offset',
      min: 0,
      max: 1,
      step: 0.05,
      value: 0.5,
      about:
        'How far every other row is shifted along, as a share of one copy, like courses of bricks. At 0 the copies line up in columns.',
    },
  },
  fits: (b) => b.lines > 1,
  patch(at, p) {
    const { board: b, text } = at;
    const period = text.cols + p.gap;
    const ms = Math.max(1, period) * p.step;
    const pitch = ROWS + p.leading;
    const a = (p.angle * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const cx = b.cols / 2;
    const cy = b.rows / 2;
    return patch<Led, Pose>(
      ms,
      (phase, led) => {
        if (period <= 0) return { lit: 0 };
        const dx = led.x - cx;
        const dy = led.y - cy;
        // Along the rows rises to the right; across them points down the sign.
        const along = dx * c - dy * s;
        const across = dx * s + dy * c;
        const r = Math.floor(across / pitch);
        const y = Math.floor(across - r * pitch);
        if (y >= ROWS) return { lit: 0 };
        const odd = r % 2 !== 0;
        const moved = phase * period;
        const col = Math.floor(along + (odd ? p.brick * period - moved : moved));
        const x = ((col % period) + period) % period;
        return { lit: text.lit(x, y) ? 1 : 0 };
      },
      { writes: ['lit'] },
    );
  },
});
