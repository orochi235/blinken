import { patch, type WaveShape } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import { cycleMs, depth, modulator, phasePerStep, RATE, unitAt } from './modulator.js';

/**
 * `invert` swinging between 0 and `depth`, or held at `depth` when steady: lit dots go dark and
 * dark dots light. Spread by column, a wave sweeps the swap across the sign.
 */
export const invert = modulator({
  name: 'invert',
  about: 'Swaps lit and dark dots, held or swinging back and forth.',
  params: {
    shape: {
      label: 'shape',
      choices: ['steady', 'square', 'sine', 'triangle'],
      value: 'steady',
      about:
        'Steady holds the sign swapped; square flips it back and forth, and sine and triangle fade between the two.',
    },
    rate: { ...RATE, value: 0.5 },
    depth: depth(
      1,
      'How far the swap goes. At 1 lit and dark trade places; lower only grays them toward each other.',
    ),
    phase: phasePerStep(0),
  },
  writes: ['invert'],
  on: 'dots',
  patch: (_at, p, rank) =>
    patch<Subject, Pose>(
      cycleMs(p.rate),
      (phase, s) => ({
        invert:
          p.shape === 'steady'
            ? p.depth
            : p.depth * unitAt(p.shape as WaveShape, phase + rank(s) * p.phase),
      }),
      { writes: ['invert'] },
    ),
});
