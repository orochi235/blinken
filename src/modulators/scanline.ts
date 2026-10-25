import { patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import { bump, modulator } from './modulator.js';

/** How much the band's halo grows at its middle. */
const GLOW = 0.6;

/**
 * A bright band rolling down the rows and round to the top again, the rows outside it dimmed:
 * the roll bar of a CRT. Loops; ignores the order.
 */
export const scanline = modulator({
  name: 'scanline',
  about: 'A bright band rolls down the rows like a CRT’s, the rest a little dimmer.',
  params: {
    speed: {
      label: 'speed',
      min: 1,
      max: 60,
      step: 1,
      value: 9,
      unit: 'rows/s',
      about: 'How many rows a second the band rolls down. Higher rolls faster.',
    },
    band: {
      label: 'band height',
      min: 1,
      max: 20,
      step: 0.5,
      value: 2.5,
      unit: 'rows',
      about: 'How many rows the bright band covers. Higher makes a taller, softer band.',
    },
    dim: {
      label: 'dimming',
      min: 0,
      max: 0.9,
      step: 0.01,
      value: 0.45,
      about:
        'How much dimmer the rows outside the band are. At 0 they stay at full brightness; higher darkens them.',
    },
  },
  writes: ['gain', 'glow'],
  on: 'dots',
  patch: (at, p) => {
    const travel = at.board.rows + p.band;
    const half = p.band / 2 + 0.5;
    return patch<Subject, Pose>(
      (travel / p.speed) * 1000,
      (phase, s) => {
        if (s.kind === 'cell') return {};
        const off = Math.abs(s.y - (phase * travel - p.band / 2));
        const k = bump(Math.min(off, travel - off) / half);
        return { gain: 1 - p.dim * (1 - k), glow: 1 + GLOW * k };
      },
      { writes: ['gain', 'glow'] },
    );
  },
});
