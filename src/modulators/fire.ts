import { oklab, patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import { hash } from '../hash.js';
import { modulator, outweigh } from './modulator.js';

/** Bottom to top: embers, flame, tips. */
const STOPS = [0x9e0f06, 0xe8330c, 0xff7a12, 0xffd23f].map(oklab);
/** How far the flames rise in one loop, in rows, and the noise lattice's height in rows. */
const RISE = 24;
const CELL = 1.5;

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise at (`x`, `y`) in lattice cells, 0 to 1, repeating every `period` cells down `y`. */
function noise(x: number, y: number, period: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const at = (i: number, j: number) => hash(i, ((j % period) + period) % period, period);
  const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
  const low = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
  return top + (low - top) * fy;
}

function ramp(u: number): number[] {
  const x = Math.min(1, Math.max(0, u)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const a = STOPS[i] as number[];
  const b = STOPS[i + 1] as number[];
  return a.map((v, k) => v + ((b[k] as number) - v) * (x - i));
}

/**
 * Lit dots colored by height, deep red at the bottom row to yellow at the top, flickering in gain
 * and heat along noise that rises through the rows. Loops; ignores the order.
 */
export const fire = modulator({
  name: 'fire',
  about: 'Dots burn in a rising flicker, deep red at the bottom to yellow at the top.',
  params: {
    heat: {
      label: 'heat',
      min: 0.5,
      max: 30,
      step: 0.5,
      value: 6,
      unit: 'rows/s',
      about: 'How fast the flames rise through the rows. Higher burns faster and wilder.',
    },
    intensity: {
      label: 'intensity',
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.6,
      about:
        'How hard the flames flicker. At 0 the dots hold their colors steady; higher lets them gutter and flare.',
    },
  },
  writes: ['gain', 'tint'],
  on: 'dots',
  patch: (at, p) => {
    const rows = Math.max(1, at.board.rows - 1);
    const period = RISE / CELL;
    return patch<Subject, Pose>(
      (RISE / p.heat) * 1000,
      (phase, s) => {
        if (s.kind === 'cell') return {};
        const y = (s.y + phase * RISE) / CELL;
        const n =
          0.65 * noise(s.x / 2.5, y, period) + 0.35 * noise(s.x / 1.2 + 31, y * 2, period * 2);
        const up = 1 - s.y / rows;
        const ragged = 0.55 + 0.45 * up;
        const gain = 1 - p.intensity * ragged * (1 - n) ** 1.6;
        return {
          gain,
          tint: outweigh(ramp(up + (n - 0.5) * 0.6 * p.intensity)),
        };
      },
      { writes: ['gain', 'tint'] },
    );
  },
});
