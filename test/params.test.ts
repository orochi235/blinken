import { describe, expect, it } from 'vitest';
import { MODULATORS } from '@/modulators/index.js';
import { type Params, values } from '@/params.js';

const params = {
  speed: { label: 'Speed', min: 0, max: 10, step: 1, value: 4 },
  mode: { label: 'Mode', choices: ['a', 'b'], value: 'a' },
  tints: { label: 'Tints', colors: [0xff0000, 0x00ff00] },
} satisfies Params;

describe('values', () => {
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
