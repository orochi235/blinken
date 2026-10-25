import { patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import { bump, modulator } from './modulator.js';

/** The longest a glint takes to cross the sign, ms. */
const SWEEP = 1100;
/**
 * At the glint's middle: how much the halos grow, how much color drains toward white, and how
 * brightly it catches the dots nothing lights. A gain above 1 draws no brighter, so it lifts these.
 */
const GLOW = 2.5;
const PALE = 0.65;
const SHEEN = 0.3;

/** A leaning glint sweeping across the sign at the start of each cycle. Loops; ignores the order. */
export const shimmer = modulator({
  name: 'shimmer',
  about: 'A slanted glint of light sweeps across the sign now and then.',
  params: {
    every: {
      label: 'how often',
      min: 800,
      max: 15000,
      step: 100,
      value: 4000,
      unit: 'ms',
      about: 'How long from one glint to the next. Higher waits longer between them.',
    },
    width: {
      label: 'width',
      min: 1,
      max: 20,
      step: 0.5,
      value: 3.5,
      unit: 'columns',
      about: 'How wide the glint is. Higher makes a broader sweep of light.',
    },
    angle: {
      label: 'angle',
      min: -60,
      max: 60,
      step: 1,
      value: 30,
      unit: '°',
      about:
        'How far the glint leans from upright. At 0 it stands straight; above 0 its top leans right, below 0 left.',
    },
  },
  writes: ['lit', 'glow', 'chroma'],
  on: 'dots',
  patch: (at, p) => {
    const { cols, rows } = at.board;
    const slope = Math.tan((p.angle * Math.PI) / 180);
    const from = -p.width - Math.max(0, (rows - 1) * slope);
    const to = cols - 1 + p.width - Math.min(0, (rows - 1) * slope);
    const sweep = Math.min(p.every, SWEEP) / p.every;
    return patch<Subject, Pose>(
      p.every,
      (phase, s) => {
        if (s.kind === 'cell') return {};
        const k =
          phase < sweep
            ? bump(
                (s.x + (rows - 1 - s.y) * slope - (from + (to - from) * (phase / sweep))) / p.width,
              )
            : 0;
        return { lit: SHEEN * k, glow: 1 + GLOW * k, chroma: 1 - PALE * k };
      },
      { writes: ['lit', 'glow', 'chroma'] },
    );
  },
});
