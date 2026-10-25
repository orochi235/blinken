import { patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import { hash } from '../hash.js';
import { modulator } from './modulator.js';

/** One loop, ms, in slots of a second that each may hold one stutter of a tube. */
const LOOP = 60_000;
const SLOT = 1000;
const SLOTS = LOOP / SLOT;
/** How long a stutter's flicker holds each state, ms. */
const FLICKER = 35;
/** Columns per tube where the spread gives every dot the same rank, as a layer's does. */
const TUBE = 6;
/** A steady tube's halo, and an out one's leftover glow. */
const HALO = 1.25;
const OUT: Partial<Pose> = { gain: 0.06, glow: 0.5 };

/**
 * Each rank of the spread a neon tube, mostly steady with now and then a stutter of flickers out;
 * how often a tube stutters is seeded, so a few are much worse than the rest. Where every dot
 * ranks the same, each run of six columns is a tube. Loops each minute.
 */
export const neon = modulator({
  name: 'neon',
  about:
    'Letters buzz like failing neon tubes, some worse than others, now and then flickering out.',
  params: {
    often: {
      label: 'how often',
      min: 0,
      max: 60,
      step: 1,
      value: 15,
      unit: '/min',
      about:
        'How many times a minute the worst letters stutter. Steadier letters stutter less; at 0 every letter holds.',
    },
    length: {
      label: 'how long',
      min: 40,
      max: 1500,
      step: 10,
      value: 300,
      unit: 'ms',
      about: 'How long a stutter lasts. Higher leaves a letter sputtering for longer.',
    },
    seed: {
      label: 'seed',
      min: 1,
      max: 99,
      step: 1,
      value: 1,
      about: 'Which letters are the bad ones. Change it to pick a different few.',
    },
  },
  writes: ['gain', 'glow'],
  on: 'dots',
  patch: (at, p, rank) => {
    const spread = at.board.dots.some((d) => rank(d) !== 0);
    const seed = Math.round(p.seed) * 7919;
    return patch<Subject, Pose>(
      LOOP,
      (phase, s) => {
        if (s.kind === 'cell') return {};
        const tube = spread ? rank(s) : Math.floor(s.x / TUBE);
        const bad = hash(tube, seed, 1) ** 3;
        const chance = (p.often / 60) * (SLOT / 1000) * bad;
        const t = phase * LOOP;
        const now = Math.floor(t / SLOT);
        for (let j = now; j > now - 3; j--) {
          const k = ((j % SLOTS) + SLOTS) % SLOTS;
          if (hash(tube, k, seed + 2) >= chance) continue;
          const start = j * SLOT + hash(tube, k, seed + 3) * SLOT;
          const end = start + p.length * (0.6 + 0.8 * hash(tube, k, seed + 4));
          if (t < start || t >= end) continue;
          const flick = Math.floor((t - start) / FLICKER);
          if (flick === 0 || hash(tube, flick, seed + 5 + k) < 0.55) return OUT;
        }
        const hum = 1 - 0.1 * bad * hash(tube, Math.floor(t / FLICKER), seed + 6);
        return { gain: hum, glow: HALO };
      },
      { writes: ['gain', 'glow'] },
    );
  },
});
