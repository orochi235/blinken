import { patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import { hash } from '../hash.js';
import { modulator } from './modulator.js';

const FRAME = 50;
/** One loop, ms: a minute, so `often` counts bursts in it. */
const LOOP = 60_000;
/** Frames per chance of a burst; a burst lasts one to three of them. */
const SLOT = 5;
const SLOTS = LOOP / FRAME / SLOT;
const CALM: Partial<Pose> = { hue: 0, gain: 1, invert: 0 };

/**
 * Rare bursts a frame or a few long in which bands of rows, each over a stretch of columns, turn
 * hard round the hue and some drop out or invert. Seeded; loops each minute; ignores the order.
 */
export const glitch = modulator({
  name: 'glitch',
  about: 'Now and then bands of rows tear: their color jumps, and some drop out or flip.',
  params: {
    often: {
      label: 'how often',
      min: 1,
      max: 120,
      step: 1,
      value: 10,
      unit: '/min',
      about: 'About how many bursts there are a minute. Higher glitches more.',
    },
    strength: {
      label: 'how strong',
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.7,
      about:
        'How hard a burst hits: how far its bands turn the color, how many rows it catches, and how many drop out or flip. Higher is harsher.',
    },
    seed: {
      label: 'seed',
      min: 1,
      max: 99,
      step: 1,
      value: 1,
      about: 'Which run of bursts plays. Change it for a different pattern of glitches.',
    },
  },
  writes: ['hue', 'gain', 'invert'],
  on: 'dots',
  patch: (at, p) => {
    const { cols } = at.board;
    const seed = Math.round(p.seed) * 7919;
    const chance = p.often / SLOTS;
    return patch<Subject, Pose>(
      LOOP,
      (phase, s) => {
        if (s.kind === 'cell') return {};
        const f = Math.floor(phase * (LOOP / FRAME));
        const slot = Math.floor(f / SLOT);
        if (hash(slot, seed, 1) >= chance) return CALM;
        const len = 1 + Math.floor(hash(slot, seed, 2) * 3);
        const from = Math.floor(hash(slot, seed, 3) * (SLOT - len + 1));
        const k = f - slot * SLOT - from;
        if (k < 0 || k >= len) return CALM;
        const tall = 1 + Math.floor(hash(f, seed, 4) * 3);
        const band = Math.floor((s.y + Math.floor(hash(f, seed, 5) * tall)) / tall);
        const roll = (n: number) => hash(band, f, seed + n);
        if (roll(10) >= 0.3 + 0.5 * p.strength) return CALM;
        const start = roll(11) * cols * 0.7;
        if (s.x < start || s.x > start + cols * (0.3 + 0.7 * roll(12))) return CALM;
        const turn = (roll(13) < 0.5 ? -1 : 1) * (50 + 130 * p.strength);
        const mode = roll(14);
        return {
          hue: turn,
          gain: mode < 0.3 * p.strength ? 0 : 1,
          invert: mode >= 0.3 * p.strength && mode < 0.6 * p.strength ? 1 : 0,
        };
      },
      { writes: ['hue', 'gain', 'invert'] },
    );
  },
});
