import { describe, expect, it } from 'vitest';
import { haloRadius } from '@/draw.js';

describe('haloRadius', () => {
  it('blooms to the dot radius at glow 1', () => {
    expect(haloRadius(4, 1)).toBe(4);
  });

  it('blooms twice as far at glow 2', () => {
    expect(haloRadius(4, 2)).toBe(8);
  });

  it('has no halo at glow 0 or below', () => {
    expect(haloRadius(4, 0)).toBe(0);
    expect(haloRadius(4, -1)).toBe(0);
  });
});
