import { describe, expect, it } from 'vitest';
import { PLANES, planeOf } from '@/planes.js';

describe('planes', () => {
  it('puts every channel of the kit on exactly one plane', () => {
    const all = Object.values(PLANES).flat().sort();
    expect(all).toEqual(['chroma', 'gain', 'glow', 'hue', 'lit', 'tint']);
  });

  it('names the plane a channel is on', () => {
    expect(planeOf('hue')).toBe('color');
    expect(planeOf('gain')).toBe('brightness');
  });
});
