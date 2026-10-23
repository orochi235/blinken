import { patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import { hash } from '../hash.js';
import { modulator } from './modulator.js';

/** Stray dots lighting for a moment, from a hash of where and when. Loops; ignores the order. */
export const sparkle = modulator({
  name: 'sparkle',
  about: 'Stray dots light for a moment at random.',
  params: {
    rate: {
      label: 'lit at once',
      min: 0,
      max: 0.1,
      step: 0.001,
      value: 0.0067,
      unit: '%',
      scale: 100,
    },
    frame: { label: 'twinkle', min: 10, max: 500, step: 5, value: 50, unit: 'ms' },
  },
  writes: ['lit'],
  on: 'dots',
  patch: (_at, p) => {
    const below = 1 - p.rate;
    const frames = Math.max(1, Math.round(1000 / p.frame));
    return patch<Subject, Pose>(
      frames * p.frame,
      (phase, s) => {
        if (s.kind === 'cell') return { lit: 0 };
        const h = hash(s.x, s.y, Math.floor(phase * frames));
        return { lit: h > below ? (h - below) / p.rate : 0 };
      },
      { writes: ['lit'] },
    );
  },
});
