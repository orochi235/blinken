import { describe, expect, it } from 'vitest';
import { MODULATORS } from '@/modulators/index.js';
import { MOVES } from '@/moves/index.js';
import { type Params, values } from '@/params.js';

const params = {
  speed: { label: 'Speed', min: 0, max: 10, step: 1, value: 4, about: 'How fast.' },
  mode: { label: 'Mode', choices: ['a', 'b'], value: 'a', about: 'Which mode.' },
  tints: { label: 'Tints', colors: [0xff0000, 0x00ff00], about: 'Which tints.' },
} satisfies Params;

describe('values', () => {
  it('gives the default for a value of the wrong kind, NaN among them', () => {
    const bad = { speed: Number.NaN, mode: 'z', tints: [] } as never;
    expect(values({ params }, bad)).toEqual(values({ params }));
    expect(values({ params }, { speed: 'fast' } as never).speed).toBe(4);
  });

  it('fills defaults for every kind and keeps given values', () => {
    expect(values({ params })).toEqual({ speed: 4, mode: 'a', tints: [0xff0000, 0x00ff00] });
    expect(values({ params }, { speed: 7, mode: 'b', tints: [1] })).toEqual({
      speed: 7,
      mode: 'b',
      tints: [1],
    });
  });

  it('clamps a number setting to its range', () => {
    expect(values(MODULATORS.dim, { sweep: 1 }).sweep).toBe(0.95);
    expect(values({ params }, { speed: -3 }).speed).toBe(0);
    expect(values({ params }, { speed: 11 }).speed).toBe(10);
  });
});

describe('about', () => {
  it('explains every setting of every move and modulator in a sentence or two', () => {
    for (const thing of [...Object.values(MOVES), ...Object.values(MODULATORS)])
      for (const [key, param] of Object.entries(thing.params))
        expect(param.about, `${thing.name}.${key}`).toMatch(/^[A-Z].{10,240}\.$/);
  });
});
