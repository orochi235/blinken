import { describe, expect, it } from 'vitest';
import { GRIDS, gridOf } from '@/grid.js';

const apart = (a: readonly [number, number], b: readonly [number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('grids', () => {
  it('sets a hex grid’s six neighbors of a dot a pitch away', () => {
    const at = GRIDS.hex(5, 3);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
    ] as const)
      expect(apart(at, GRIDS.hex(5 + dx, 3 + dy))).toBeCloseTo(1);
  });

  it('takes a grid by name or as its own function, square by default', () => {
    const own = (x: number, y: number) => [x * 2, y] as const;
    expect(gridOf()).toBe(GRIDS.square);
    expect(gridOf('hex')).toBe(GRIDS.hex);
    expect(gridOf(own)).toBe(own);
  });
});
