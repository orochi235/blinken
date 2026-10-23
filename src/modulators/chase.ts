import { patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import { modulator } from './modulator.js';

/** The theater chase on the border: one cell of three lit, stepping a cell each beat. Loops. */
export const chase = modulator({
  name: 'chase',
  about: 'The border’s theater chase: every third bulb lit, stepping each beat.',
  params: {
    beat: { label: 'beat', min: 40, max: 1000, step: 10, value: 180, unit: 'ms' },
    dim: { label: 'unlit glow', min: 0, max: 0.5, step: 0.01, value: 0.1 },
  },
  writes: ['lit'],
  on: 'cells',
  length: (_at, p) => p.beat * 3,
  patch: (_at, p) =>
    patch<Subject, Pose>(
      p.beat * 3,
      (phase, s) => {
        if (s.kind !== 'cell') return { lit: 0 };
        const beat = Math.floor(phase * 3);
        return { lit: (s.i + 3 - beat) % 3 === 0 ? 1 : p.dim };
      },
      { writes: ['lit'] },
    ),
});
