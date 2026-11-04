import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { frameOf, GRIDS } from '@/grid.js';
import { BLOOM, BULB_COLOR, DOT_COLOR, HOUSING } from '@/render/bloom-params.js';
import { LED, lightTable, SHAPES } from '@/render/lights.js';

describe('lightTable', () => {
  const b = board(3, 2);
  const leds = [...b.dots, ...b.bulbs];
  const grid = GRIDS.hex;
  const t = lightTable(b, leds, grid);
  const { left, top, across, down } = frameOf(b, grid);

  it('places each light at its grid point from the frame’s top left', () => {
    expect(t.n).toBe(leds.length);
    expect(t.frame).toEqual({ across, down });
    for (const [i, led] of leds.entries()) {
      const [x, y] = grid(led.x, led.y);
      expect(t.at[i * 2]).toBeCloseTo(x - left, 5);
      expect(t.at[i * 2 + 1]).toBeCloseTo(y - top, 5);
    }
  });

  it('gives bulbs their shape and a larger radius', () => {
    for (const [i, led] of leds.entries()) {
      expect(t.shape[i]).toBe(led.kind === 'bulb' ? SHAPES.bulb : SHAPES.dot);
      expect(t.radius[i]).toBeCloseTo(led.kind === 'bulb' ? 7 / 12 : 6 / 12, 6);
    }
  });

  it('shares one material and the housing and bloom constants', () => {
    expect(LED).toEqual({ name: 'led', core: 0.45, coreTint: 0xfff4e0, coreAlpha: 0.55 });
    expect(BLOOM.spread).toBe(0.9);
    expect([HOUSING, DOT_COLOR, BULB_COLOR]).toEqual([0x0d0a08, 0x21150f, 0x2b2118]);
  });
});
