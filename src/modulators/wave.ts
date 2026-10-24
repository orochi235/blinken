import { patch, type WaveShape } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import type { ChoiceParam, NumberParam, Params } from '../params.js';
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
  about:
    'The curve each cycle follows: sine swells smoothly, triangle rises and falls at a steady pace, and square jumps between full and low.',
});

interface Spec {
  name: string;
  about: string;
  channel: Channel;
  /** The channel's value for the wave's `u`, 0..1, at the given amount. */
  of(u: number, amount: number): number;
  /** The shapes a setting may choose between, or one fixed shape. */
  shape: readonly string[] | WaveShape;
  /** How far the wave swings its channel, and the param key it is set by. */
  amount: { key: string; param: NumberParam };
  phase: number;
  /** Cycles to shift the wave by, so its 0..1 starts where the channel should. */
  start?: number;
}

const swing = (s: Spec): Modulator => {
  const choices = typeof s.shape === 'string' ? undefined : s.shape;
  const params = {
    ...(choices ? { shape: shapeParam(choices, choices[0] as string) } : {}),
    rate: RATE,
    [s.amount.key]: s.amount.param,
    phase: phasePerStep(s.phase),
  };
  return modulator<Params>({
    name: s.name,
    about: s.about,
    params,
    writes: [s.channel],
    on: 'dots',
    patch: (_at, v, rank) => {
      const p = v as { rate: number; phase: number; shape?: string } & Record<string, number>;
      const shape = (typeof s.shape === 'string' ? s.shape : p.shape) as WaveShape;
      const start = s.start ?? 0;
      return patch<Subject, Pose>(
        cycleMs(p.rate),
        (phase, subject) => {
          const u = unitAt(shape, phase + rank(subject) * p.phase + start);
          return { [s.channel]: s.of(u, p[s.amount.key] as number) } as Partial<Pose>;
        },
        { writes: [s.channel] },
      );
    },
  });
};

/** Gain easing down and back up. */
export const pulse = swing({
  name: 'pulse',
  about: 'Dots swell and fade.',
  channel: 'gain',
  of: (u, d) => 1 - d * (1 - u),
  shape: ['sine', 'triangle', 'square'],
  amount: {
    key: 'depth',
    param: depth(
      0.6,
      'How far the dots fade at the low point. At 0 they hold steady; at 1 they go fully dark.',
    ),
  },
  phase: 0.02,
});

/** Hue turning `arc` degrees round the wheel each cycle. */
export const hueCycle = swing({
  name: 'hue-cycle',
  about: 'Colors turn round the wheel.',
  channel: 'hue',
  of: (u, arc) => arc * u,
  shape: 'saw',
  amount: {
    key: 'arc',
    param: {
      label: 'arc',
      min: 0,
      max: 360,
      step: 1,
      value: 360,
      unit: '°',
      about:
        'How far round the color wheel the hue turns each cycle, in degrees. At 360 it goes all the way round.',
    },
  },
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
  amount: {
    key: 'depth',
    param: depth(1, 'How much the halos grow at their fullest. Higher makes a bigger glow.'),
  },
  phase: 0.01,
});
