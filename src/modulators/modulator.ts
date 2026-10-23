import { type Patch, type WaveShape, waveAt } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import type { Placed } from '../orders.js';
import type { NumberParam, Params, Values } from '../params.js';
import type { Channel } from '../planes.js';

/** One channel of the sign driven along a curve over time, phased over the sign by an order. */
export interface Modulator<P extends Params = Params> {
  readonly kind: 'modulator';
  readonly name: string;
  readonly about: string;
  readonly params: P;
  /** The channels `patch` writes, and no others. */
  readonly writes: readonly Channel[];
  /** What it plays on: the dots of the sign, or the three cells of the border. */
  readonly on: 'dots' | 'cells';
  /** Its duration is one cycle (or one pass). `rank` gives each subject a phase shift, never a start delay, so a loop has no warm-up. */
  patch(at: Placed, p: Values<P>, rank: (s: Subject) => number): Patch<Subject, Pose>;
}

/** Declares a modulator, keeping its params' keys in the type `patch` sees. */
export const modulator = <P extends Params>(m: Omit<Modulator<P>, 'kind'>): Modulator<P> => ({
  kind: 'modulator',
  ...m,
});

/** Cycles per second of a looping modulator. */
export const RATE: NumberParam = {
  label: 'rate',
  min: 0.1,
  max: 10,
  step: 0.1,
  value: 1,
  unit: 'Hz',
};

/** How far a modulator swings its channel, as a fraction of its full range. */
export const depth = (value: number): NumberParam => ({
  label: 'depth',
  min: 0,
  max: 1,
  step: 0.01,
  value,
});

/** How much one rank of the order shifts a modulator's curve. */
export const phasePerStep = (value: number): NumberParam => ({
  label: 'phase per step',
  min: 0,
  max: 0.25,
  step: 0.005,
  value,
  unit: 'cycles',
});

/** One cycle of a looping modulator at `rate`, in ms. */
export const cycleMs = (rate: number) => 1000 / rate;

/** A wave's value at `x` cycles as 0..1, starting where it is lowest or at its midpoint rising. */
export const unitAt = (shape: WaveShape, x: number) => (waveAt(shape, x) + 1) / 2;
