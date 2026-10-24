import { describe, expect, it } from 'vitest';
import { KIT } from '@/board.js';
import { PLANES, planeOf } from '@/planes.js';

describe('planes', () => {
  it('puts every channel of the kit on exactly one plane', () => {
    const all = Object.values(PLANES).flat().sort();
    expect(all).toEqual(Object.keys(KIT).sort());
    expect(planeOf('invert')).toBe('shape');
  });

  it('names the plane a channel is on', () => {
    expect(planeOf('hue')).toBe('color');
    expect(planeOf('gain')).toBe('brightness');
  });
});
