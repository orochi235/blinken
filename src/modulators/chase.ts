import { oklab, patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import { modulator } from './modulator.js';

const BULB = oklab(0xffe2b0);

/** The theater chase on the border: one cell of three lit, stepping a cell each beat. Loops. */
export const chase = modulator({
  name: 'chase',
  about: 'The border’s theater chase: every third bulb lit, stepping each beat.',
  params: {
    beat: {
      label: 'beat',
      min: 40,
      max: 1000,
      step: 10,
      value: 180,
      unit: 'ms',
      about: 'How long the lit bulbs wait before stepping to the next. Higher chases more slowly.',
    },
    dim: {
      label: 'unlit glow',
      min: 0,
      max: 0.5,
      step: 0.01,
      value: 0.1,
      about:
        'How bright the bulbs between the lit ones stay. At 0 they go dark; higher keeps them glowing.',
    },
  },
  writes: ['lit', 'tint'],
  on: 'cells',
  patch: (_at, p) =>
    patch<Subject, Pose>(
      p.beat * 3,
      (phase, s) => {
        if (s.kind !== 'cell') return {};
        const beat = Math.floor(phase * 3);
        return { lit: (s.i + 3 - beat) % 3 === 0 ? 1 : p.dim, tint: BULB };
      },
      { writes: ['lit', 'tint'] },
    ),
});
