import { describe, expect, it } from 'vitest';
import { BLUR_FROM, blurSamples, MAX_SAMPLES } from '@/mechanical/blur.js';

const sum = (xs: readonly { weight: number }[]) => xs.reduce((a, s) => a + s.weight, 0);

describe('a reel blur', () => {
  it('draws a reel at rest or turning slowly once, where it stands', () => {
    for (const travel of [0, 0.3, BLUR_FROM, -BLUR_FROM]) {
      expect(blurSamples(4.25, travel)).toEqual([{ pos: 4.25, weight: 1 }]);
    }
  });

  it('spans the whole frame from twice the threshold, ending where the reel stands', () => {
    const s = blurSamples(10, 2);
    expect(s).toHaveLength(7);
    expect(s[0]?.pos).toBeCloseTo(8);
    expect(s.at(-1)?.pos).toBe(10);
    const steps = s.slice(1).map((x, i) => x.pos - (s[i]?.pos ?? 0));
    for (const d of steps) expect(d).toBeCloseTo(1 / 3);
  });

  it('fades in, spanning only part of the frame just past the threshold', () => {
    const s = blurSamples(10, 1.5);
    expect(s).toHaveLength(4);
    expect(s[0]?.pos).toBeCloseTo(10 - 0.75);
    const just = blurSamples(10, 1.01);
    expect(just).toHaveLength(2);
    expect(just[0]?.pos).toBeCloseTo(10 - 0.0101);
    expect(just[1]?.weight).toBeCloseTo(1 - 0.01 / 3);
    expect(sum(s)).toBeCloseTo(1);
  });

  it('weighs each position more the nearer it is to now, summing to one', () => {
    const s = blurSamples(0, 3);
    expect(sum(s)).toBeCloseTo(1);
    for (let i = 1; i < s.length; i++) {
      expect(s[i]?.weight).toBeGreaterThan(s[i - 1]?.weight ?? 0);
    }
    for (const [i, x] of s.entries()) expect(x.weight).toBeCloseTo((i + 1) / 36);
  });

  it('caps its positions however fast the reel turns', () => {
    for (const travel of [3, 10, 400]) expect(blurSamples(0, travel)).toHaveLength(MAX_SAMPLES);
    expect(blurSamples(0, 400)[0]?.pos).toBe(-400);
  });

  it('spans back along a reel turning the other way', () => {
    const s = blurSamples(5, -2);
    expect(s[0]?.pos).toBeCloseTo(7);
    expect(s.at(-1)?.pos).toBe(5);
  });
});
