import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import { litAt, move, on } from './move.js';

const CUT_MS = 1;

/** A dot switches on; an order spreads the switching into a wipe. */
export const cutOn = move({
  name: 'cut-on',
  about: 'Dots switch on to the message at once.',
  slot: 'enter',
  params: {},
  length: () => CUT_MS,
  patch: (at) =>
    patch<Led, Pose>(CUT_MS, (phase, led) => on(phase >= 0.5 && litAt(at, led)), {
      writes: ['lit'],
    }),
});

/** A dot switches off. */
export const cutOff = move({
  name: 'cut-off',
  about: 'Dots switch off at once.',
  slot: 'exit',
  params: {},
  length: () => CUT_MS,
  patch: (at) =>
    patch<Led, Pose>(CUT_MS, (phase, led) => on(phase < 0.5 && litAt(at, led)), {
      writes: ['lit'],
    }),
});

/** The message standing still. */
export const stand = move({
  name: 'stand',
  about: 'The message stands still.',
  slot: 'active',
  params: { ms: { label: 'length', min: 100, max: 10000, step: 100, value: 1000, unit: 'ms' } },
  length: (_, p) => p.ms,
  patch: (at, p) => patch<Led, Pose>(p.ms, (_, led) => on(litAt(at, led)), { writes: ['lit'] }),
});
