import { patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import { depth, modulator, phasePerStep } from './modulator.js';

const SHARE = { min: 0, max: 1, step: 0.01, unit: 'of the pass' };

/**
 * Gain blinking off within a window of each pass: `flashes` beats across it, each dark for its
 * second half. At its defaults the window is the whole pass and it blinks once a pass: once a
 * second, or once over the hold in an active slot that has one.
 */
export const flash = modulator({
  name: 'flash',
  about: 'Dots blink off and on, a number of times within a window of each pass.',
  params: {
    ms: {
      label: 'length',
      min: 100,
      max: 10000,
      step: 100,
      value: 1000,
      unit: 'ms',
      about: 'How long one pass lasts before the blinking repeats.',
    },
    flashes: {
      label: 'flashes',
      min: 0,
      max: 12,
      step: 1,
      value: 1,
      about: 'How many times the dots blink within the window. Higher blinks faster.',
    },
    from: {
      label: 'from',
      ...SHARE,
      value: 0,
      about: 'Where in each pass the blinking starts, as a share of the pass.',
    },
    to: {
      label: 'to',
      ...SHARE,
      value: 1,
      about: 'Where in each pass the blinking stops, as a share of the pass.',
    },
    depth: depth(1, 'How dark a blink goes. At 1 the dots switch fully off; lower only dims them.'),
    phase: phasePerStep(0.02),
  },
  writes: ['gain'],
  on: 'dots',
  patch: (_at, p, rank) => {
    const window = p.to - p.from;
    return patch<Subject, Pose>(
      p.ms,
      (phase, s) => {
        const u = phase + rank(s) * p.phase;
        const w = (u - Math.floor(u) - p.from) / window;
        const dark = window > 0 && w >= 0 && w < 1 && (w * p.flashes) % 1 >= 0.5;
        return { gain: dark ? 1 - p.depth : 1 };
      },
      { writes: ['gain'] },
    );
  },
});
