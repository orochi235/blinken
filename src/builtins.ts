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
    params: {
      flashes: {
        label: 'flashes',
        about: 'How many times the message blinks in the middle of its hold.',
        to: ['active.1.flashes'],
      },
    },
  },
  scroll: {
    name: 'scroll',
    about: 'Crosses the sign a column at a time.',
    active: { move: 'scroll-across' },
    params: {
      speed: {
        label: 'column time',
        about: 'How long the message waits before moving one column. Higher scrolls more slowly.',
        to: ['active.0.step'],
      },
    },
  },
  flip: {
    name: 'flip',
    about: 'Letters unfold, tumble end over end one after another, and fold away.',
    order: { by: 'letter', lag: 90 },
    enter: { move: 'unfold' },
    active: { move: 'tumble', params: { turns: 2 } },
    exit: { move: 'fold' },
    hold: 3000,
    params: {
      turns: {
        label: 'turns',
        about: 'How many times each letter tumbles end over end while it stands.',
        to: ['active.0.turns'],
      },
      fold: {
        label: 'fold time',
        about: 'How long each letter takes to unfold coming on and to fold going.',
        to: ['enter.0.ms', 'exit.0.ms'],
      },
    },
  },
  roll: {
    name: 'roll',
    about: 'Each letter spins through random glyphs like a slot reel, landing left to right.',
    enter: { move: 'reel-in', order: { by: 'letter', lag: 140 } },
    active: { move: 'stand' },
    exit: { move: 'roll-away' },
    hold: 1800,
    params: {
      stagger: {
        label: 'stagger',
        about: 'How long each letter’s reel waits after the one before it lands.',
        to: ['enter.0.lag'],
      },
      glyphs: {
        label: 'glyphs',
        about: 'How many random characters roll past before a letter lands. Higher spins faster.',
        to: ['enter.0.glyphs'],
      },
    },
  },
  fall: {
    name: 'fall',
    about: 'Columns drop in from above at random, then fall out the bottom.',
    enter: { move: 'drop-in', order: { by: 'random', lag: 9, seed: 1 } },
    active: { move: 'stand' },
    exit: { move: 'drop-out', order: { by: 'random', lag: 9, seed: 2 } },
    hold: 1700,
    params: {
      drop: {
        label: 'drop time',
        about: 'How long a column takes to fall, coming on and going. Higher drops more slowly.',
        to: ['enter.0.ms', 'exit.0.ms'],
      },
      scatter: {
        label: 'scatter',
        about:
          'How long each column waits after the one before it. At 0 every column falls together.',
        to: ['enter.0.lag', 'exit.0.lag'],
      },
    },
  },
  matris: {
    name: 'matris',
    about:
      'Streams of dots rain down every column and leave the message behind, then wash it away.',
    enter: { move: 'rain-in' },
    active: { move: 'stand' },
    exit: { move: 'rain-out' },
    hold: 2000,
    params: {
      rain: {
        label: 'rain time',
        about: 'How long the rain takes to leave the message, and to wash it away.',
        to: ['enter.0.ms', 'exit.0.ms'],
      },
      drops: {
        label: 'drops',
        about: 'How many streams fall down each column.',
        to: ['enter.0.drops', 'exit.0.drops'],
      },
    },
  },
  tile: {
    name: 'tile',
    about: 'Repeats the message in tilted brick rows, neighbors scrolling opposite ways.',
    active: { move: 'tile' },
    hold: 9000,
    params: {
      tilt: {
        label: 'tilt',
        about: 'How far the brick rows lean.',
        to: ['active.0.angle'],
      },
      speed: {
        label: 'column time',
        about: 'How long the rows wait before moving one column. Higher scrolls more slowly.',
        to: ['active.0.step'],
      },
    },
  },
} as const satisfies Record<string, EffectSpec>;

const layers = {
  sparkle: { mod: 'sparkle' },
  rainbow: { mod: 'hue-cycle', spread: { by: 'column' }, params: { rate: 0.4, phase: 0.015 } },
  invert: { mod: 'invert' },
} as const satisfies Record<string, LayerSpec>;

export type EffectName = keyof typeof effects;
export type LayerName = keyof typeof layers;
/** The six built-in text effects, by name. */
export const EFFECTS: Readonly<Record<EffectName, EffectSpec>> = effects;
/** The built-in layers, by name. */
export const LAYERS: Readonly<Record<LayerName, LayerSpec>> = layers;
