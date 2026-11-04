import { oklab, patch } from '@msb235/blits';
import type { Pose, Subject } from '../board.js';
import type { ColorsParam } from '../params.js';
import { cycleMs, depth, modulator, phasePerStep, RATE, unitAt } from './modulator.js';
import { RANK, rankAt, shader, unitOf } from './shader.js';

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

/** The two colors a two-color blend runs between, in OKLab: its first two, or its first twice. */
const endsOf = (colors: readonly number[]): [number[], number[]] => [
  oklab(colors[0] ?? 0xffffff),
  oklab(colors[1] ?? colors[0] ?? 0xffffff),
];

/** The tint `k` of the way from `a` to `b`, each an OKLab color whole. */
const blend = (a: readonly number[], b: readonly number[], k: number) =>
  a.map((v, i) => v + ((b[i] ?? v) - v) * k);

const TWO = shader({
  params: ['aL', 'aa', 'ab', 'bL', 'ba', 'bb', 'depth', 'phase', 'by', 'cols'],
  wgsl: `let k = bree_unit(0.0, ph + ${RANK} * params.phase) * params.depth;
out.tint = array<f32, 4>(0.0, 0.0, 0.0, 0.0);
if (subject.cell < 0.5) {
  out.tint = array<f32, 4>(params.aL + (params.bL - params.aL) * k, params.aa + (params.ba - params.aa) * k, params.ab + (params.bb - params.ab) * k, 1.0);
}`,
  at: (ph, s, p) => {
    if (s.kind === 'cell') return { tint: [0, 0, 0, 0] };
    const k = unitOf(0, ph + rankAt(p, s) * (p.phase as number)) * (p.depth as number);
    return { tint: blend([p.aL, p.aa, p.ab, 1] as number[], [p.bL, p.ba, p.bb, 1] as number[], k) };
  },
  writes: ['tint'],
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
    const [a, b] = endsOf(p.colors);
    return patch<Subject, Pose>(
      cycleMs(p.rate),
      (phase, subject) => {
        const u = unitAt('sine', phase + rank(subject) * p.phase);
        return { tint: blend(a, b, u * p.depth) };
      },
      { writes: ['tint'] },
    );
  },
  shader: (_at, p, rank) => {
    if (!rank) return null;
    const [[aL = 0, aa = 0, ab = 0], [bL = 0, ba = 0, bb = 0]] = endsOf(p.colors);
    return TWO(cycleMs(p.rate), {
      aL,
      aa,
      ab,
      bL,
      ba,
      bb,
      depth: p.depth,
      phase: p.phase,
      ...rank,
    });
  },
});
