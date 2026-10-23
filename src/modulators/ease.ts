import { keys, patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import type { ChoiceParam, NumberParam } from '../params.js';
import type { Channel } from '../planes.js';
import { depth, type Modulator, modulator, phasePerStep } from './modulator.js';

const MS: NumberParam = {
  label: 'length',
  min: 100,
  max: 10000,
  step: 100,
  value: 1500,
  unit: 'ms',
};
const EASE: ChoiceParam = {
  label: 'easing',
  choices: ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'],
  value: 'ease-in-out',
};

interface Spec {
  name: string;
  about: string;
  channel: Channel;
  /** Channel values at the start and end of a pass, and the peak between if it comes back. */
  stops(depth: number): { at: number; value: number }[];
  depth: number;
}

/** A modulator that plays its channel once along an easing over `length`, ranks shifting it later. */
const eased = (s: Spec): Modulator =>
  modulator({
    name: s.name,
    about: s.about,
    params: { ms: MS, easing: EASE, depth: depth(s.depth), phase: phasePerStep(0.01) },
    writes: [s.channel],
    on: 'dots',
    length: (_at, p) => p.ms as number,
    patch: (_at, v, rank) => {
      const p = v as { ms: number; easing: string; depth: number; phase: number };
      const inner = keys<Subject, Pose>(
        p.ms,
        s
          .stops(p.depth)
          .map(({ at, value }) => ({ at, delta: { [s.channel]: value } as Partial<Pose> })),
        { ease: p.easing as 'linear' },
      );
      return patch<Subject, Pose>(
        p.ms,
        (phase, subject, setting) => {
          const u = Math.min(1, Math.max(0, phase - rank(subject) * p.phase));
          return inner.at(u, subject, setting);
        },
        { writes: [s.channel] },
      );
    },
  });

/** Gain falling once from full to `1 - depth`. */
export const dim = eased({
  name: 'dim',
  about: 'Dots fade down and stay down.',
  channel: 'gain',
  stops: (d) => [
    { at: 0, value: 1 },
    { at: 1, value: 1 - d },
  ],
  depth: 0.7,
});

/** Chroma falling once from full to `1 - depth`. */
export const desaturate = eased({
  name: 'desaturate',
  about: 'Colors drain toward gray.',
  channel: 'chroma',
  stops: (d) => [
    { at: 0, value: 1 },
    { at: 1, value: 1 - d },
  ],
  depth: 1,
});

/** Glow rising to `1 + depth` at mid-pass and settling back. */
export const flare = eased({
  name: 'flare',
  about: 'The halos flare up and settle.',
  channel: 'glow',
  stops: (d) => [
    { at: 0, value: 1 },
    { at: 0.5, value: 1 + d },
    { at: 1, value: 1 },
  ],
  depth: 1,
});
