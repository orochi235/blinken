import { patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import { modulator } from './modulator.js';

const TAU = Math.PI * 2;

/**
 * A hue field drifting slowly over the sign: three sines across columns and rows, each turning a
 * whole number of times a loop so the loop closes. Ignores the order.
 */
export const aurora = modulator({
  name: 'aurora',
  about: 'Colors drift slowly across the sign in soft, shifting bands, like the northern lights.',
  params: {
    speed: {
      label: 'speed',
      min: 0.01,
      max: 1,
      step: 0.01,
      value: 0.05,
      unit: 'Hz',
      about: 'How many times a second the colors drift through a whole loop. Higher drifts faster.',
    },
    scale: {
      label: 'scale',
      min: 3,
      max: 120,
      step: 1,
      value: 24,
      unit: 'columns',
      about: 'How wide the bands of color are. Higher makes broader, gentler bands.',
    },
    range: {
      label: 'hue range',
      min: 0,
      max: 360,
      step: 1,
      value: 150,
      unit: '°',
      about:
        'How far round the color wheel the drift reaches, in degrees, centered on the message’s own color. Higher brings in more colors.',
    },
  },
  writes: ['hue'],
  on: 'dots',
  patch: (at, p) => {
    const tall = Math.max(1, at.board.rows);
    return patch<Subject, Pose>(
      1000 / p.speed,
      (phase, s) => {
        if (s.kind === 'cell') return {};
        const x = s.x / p.scale;
        const y = s.y / tall;
        const t = phase * TAU;
        const f =
          0.5 * Math.sin(TAU * x + t) +
          0.3 * Math.sin(TAU * (x * 1.7 + y * 0.6) - 2 * t + 1.3) +
          0.2 * Math.sin(TAU * (x * 0.55 - y * 1.1) + t + 2.1);
        return { hue: (p.range / 2) * f };
      },
      { writes: ['hue'] },
    );
  },
});
