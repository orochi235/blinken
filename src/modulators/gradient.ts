import { mixHex, oklab, patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import type { ColorsParam } from '../params.js';
import { modulator, outweigh } from './modulator.js';

/**
 * A still ramp of tint through its colors, left to right or top to bottom, each pair blended
 * round the hue so the middle never passes through gray. Ignores the order.
 */
export const gradient = modulator({
  name: 'gradient',
  about: 'A still blend of colors across the sign, from one edge to the other.',
  params: {
    colors: {
      label: 'colors',
      colors: [0xff2d6f, 0xffb31a],
      about:
        'The colors the ramp runs through, first to last. Two blend edge to edge; add swatches for more stops.',
    } as ColorsParam,
    direction: {
      label: 'direction',
      choices: ['across', 'down'],
      value: 'across',
      about:
        'Across runs the colors from the left edge to the right; down runs them from the top row to the bottom.',
    },
  },
  writes: ['tint'],
  on: 'dots',
  patch: (at, p) => {
    const stops = p.colors.length ? p.colors : [0xffffff];
    const down = p.direction === 'down';
    const span = Math.max(1, (down ? at.board.rows : at.board.cols) - 1);
    const tints = Array.from({ length: span + 1 }, (_, j) => {
      const x = (j / span) * (stops.length - 1);
      const i = Math.min(Math.max(0, stops.length - 2), Math.floor(x));
      const a = stops[i] as number;
      return outweigh(oklab(mixHex(a, stops[i + 1] ?? a, x - i)));
    });
    return patch<Subject, Pose>(
      1000,
      (_phase, s) => {
        if (s.kind === 'cell') return {};
        const j = Math.round(down ? s.y : s.x);
        return { tint: tints[Math.min(span, Math.max(0, j))] as number[] };
      },
      { writes: ['tint'] },
    );
  },
});
