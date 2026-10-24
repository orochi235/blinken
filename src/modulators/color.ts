import { oklab, patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import type { ColorsParam } from '../params.js';
import { cycleMs, depth, modulator, phasePerStep, RATE, unitAt } from './modulator.js';

/** Tint stepping through its colors in order, each held for one step. */
export const palette = modulator({
  name: 'palette',
  about: 'Dots step through a list of colors.',
  params: {
    colors: {
      label: 'colors',
      colors: [0xff3b30, 0xffcc00, 0x34c759, 0x0a84ff],
      about:
        'The colors the dots step through, in order. Add or remove swatches to change the list.',
    } as ColorsParam,
    step: {
      label: 'step',
      min: 50,
      max: 2000,
      step: 10,
      value: 400,
      unit: 'ms',
      about: 'How long each color shows before the next. Higher steps more slowly.',
    },
    phase: phasePerStep(0.05),
  },
  writes: ['tint'],
  on: 'dots',
  patch: (_at, p, rank) => {
    const tints = p.colors.map(oklab);
    const n = Math.max(1, tints.length);
    return patch<Subject, Pose>(
      p.step * n,
      (phase, subject) => {
        const tint =
          tints[
            Math.min(n - 1, Math.floor(unitAt('saw', phase + rank(subject) * p.phase - 0.5) * n))
          ];
        return tint ? { tint } : {};
      },
      { writes: ['tint'] },
    );
  },
});

/** Tint blending between the first two of its colors along a sine. */
export const twoColor = modulator({
  name: 'two-color',
  about: 'Dots blend back and forth between two colors.',
  params: {
    colors: {
      label: 'colors',
      colors: [0xff3b30, 0x0a84ff],
      about: 'The two colors the dots blend between. Only the first two are used.',
    } as ColorsParam,
    rate: RATE,
    depth: depth(
      1,
      'How far toward the second color the blend reaches. At 1 it goes all the way; lower stays nearer the first.',
    ),
    phase: phasePerStep(0.01),
  },
  writes: ['tint'],
  on: 'dots',
  patch: (_at, p, rank) => {
    const a = oklab(p.colors[0] ?? 0xffffff);
    const b = oklab(p.colors[1] ?? p.colors[0] ?? 0xffffff);
    return patch<Subject, Pose>(
      cycleMs(p.rate),
      (phase, subject) => {
        const u = unitAt('sine', phase + rank(subject) * p.phase);
        const k = u * p.depth;
        return { tint: a.map((v, i) => v + ((b[i] ?? v) - v) * k) };
      },
      { writes: ['tint'] },
    );
  },
});
