import { patch, type WaveShape } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import type { ChoiceParam, Params } from '../params.js';
import type { Channel } from '../planes.js';
import {
  cycleMs,
  depth,
  type Modulator,
  modulator,
  phasePerStep,
  RATE,
  unitAt,
} from './modulator.js';

const shapeParam = (choices: readonly string[], value: string): ChoiceParam => ({
  label: 'shape',
  choices,
  value,
});

interface Spec {
  name: string;
  about: string;
  channel: Channel;
  /** The channel's value for the wave's `u`, 0..1, at the given depth. */
  of(u: number, depth: number): number;
  /** The shapes a setting may choose between, or one fixed shape. */
  shape: readonly string[] | WaveShape;
  depth: number;
  phase: number;
  /** Cycles to shift the wave by, so its 0..1 starts where the channel should. */
  start?: number;
}

const swing = (s: Spec): Modulator => {
  const choices = typeof s.shape === 'string' ? undefined : s.shape;
  const params = {
    ...(choices ? { shape: shapeParam(choices, choices[0] as string) } : {}),
    rate: RATE,
    depth: depth(s.depth),
    phase: phasePerStep(s.phase),
  };
  return modulator<Params>({
    name: s.name,
    about: s.about,
    params,
    writes: [s.channel],
    on: 'dots',
    length: (_at, p) => cycleMs(p.rate as number),
    patch: (_at, v, rank) => {
      const p = v as { rate: number; depth: number; phase: number; shape?: string };
      const shape = (typeof s.shape === 'string' ? s.shape : p.shape) as WaveShape;
      const start = s.start ?? 0;
      return patch<Subject, Pose>(
        cycleMs(p.rate),
        (phase, subject) => {
          const u = unitAt(shape, phase + rank(subject) * p.phase + start);
          return { [s.channel]: s.of(u, p.depth) } as Partial<Pose>;
        },
        { writes: [s.channel] },
      );
    },
  });
};

/** Gain on and off: full, then dark for the other half of the cycle. */
export const flash = swing({
  name: 'flash',
  about: 'Dots blink off and on.',
  channel: 'gain',
  of: (u, d) => 1 - d * (1 - u),
  shape: 'square',
  depth: 1,
  phase: 0.02,
});

/** Gain easing down and back up. */
export const pulse = swing({
  name: 'pulse',
  about: 'Dots swell and fade.',
  channel: 'gain',
  of: (u, d) => 1 - d * (1 - u),
  shape: ['sine', 'triangle', 'square'],
  depth: 0.6,
  phase: 0.02,
});

/** Hue turning a full circle times depth each cycle. */
export const hueCycle = swing({
  name: 'hue-cycle',
  about: 'Colors turn round the wheel.',
  channel: 'hue',
  of: (u, d) => 360 * d * u,
  shape: 'saw',
  depth: 1,
  phase: 0.01,
  start: -0.5,
});

/** Glow swelling and settling. */
export const bloom = swing({
  name: 'bloom',
  about: 'The halos breathe in and out.',
  channel: 'glow',
  of: (u, d) => 1 + d * u,
  shape: 'sine',
  depth: 1,
  phase: 0.01,
});
