import type { EffectSpec } from './effects.js';
import type { ModPiece } from './pieces.js';

/** A modulator looping under the whole program, at a weight against the text's 1. */
export interface LayerSpec extends ModPiece {
  /** Its weight when on. Default 1. */
  readonly weight?: number;
}

const effects = {
  hold: {
    name: 'hold',
    about: 'Stands centered, wiping on and off by column and flashing midway.',
    order: { by: 'column', lag: 14 },
    enter: { move: 'cut-on' },
    // One flash pass over the whole hold: steady, three quick flashes in the middle third, steady.
    active: [{ move: 'stand' }, { mod: 'flash', params: { flashes: 3, from: 1 / 3, to: 2 / 3 } }],
    exit: { move: 'cut-off' },
    hold: 3600,
  },
  scroll: {
    name: 'scroll',
    about: 'Crosses the sign a column at a time.',
    active: { move: 'scroll-across' },
  },
  flip: {
    name: 'flip',
    about: 'Letters unfold, tumble end over end one after another, and fold away.',
    order: { by: 'letter', lag: 90 },
    enter: { move: 'unfold' },
    active: { move: 'tumble', params: { turns: 2 } },
    exit: { move: 'fold' },
    hold: 3000,
  },
  roll: {
    name: 'roll',
    about: 'Each letter spins through random glyphs like a slot reel, landing left to right.',
    enter: { move: 'reel-in', order: { by: 'letter', lag: 140 } },
    active: { move: 'stand' },
    exit: { move: 'roll-away' },
    hold: 1800,
  },
  fall: {
    name: 'fall',
    about: 'Columns drop in from above at random, then fall out the bottom.',
    enter: { move: 'drop-in', order: { by: 'random', lag: 9, seed: 1 } },
    active: { move: 'stand' },
    exit: { move: 'drop-out', order: { by: 'random', lag: 9, seed: 2 } },
    hold: 1700,
  },
  matris: {
    name: 'matris',
    about:
      'Streams of dots rain down every column and leave the message behind, then wash it away.',
    enter: { move: 'rain-in' },
    active: { move: 'stand' },
    exit: { move: 'rain-out' },
    hold: 2000,
  },
  tile: {
    name: 'tile',
    about: 'Repeats the message in tilted brick rows, neighbors scrolling opposite ways.',
    active: { move: 'tile' },
    hold: 9000,
  },
} as const satisfies Record<string, EffectSpec>;

const layers = {
  sparkle: { mod: 'sparkle' },
  chase: { mod: 'chase' },
  rainbow: { mod: 'hue-cycle', spread: { by: 'column' }, params: { rate: 0.4, phase: 0.015 } },
} as const satisfies Record<string, LayerSpec>;

export type EffectName = keyof typeof effects;
export type LayerName = keyof typeof layers;
/** The six built-in text effects, by name. */
export const EFFECTS: Readonly<Record<EffectName, EffectSpec>> = effects;
/** The three built-in layers, by name. */
export const LAYERS: Readonly<Record<LayerName, LayerSpec>> = layers;
