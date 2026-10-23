import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';

describe('board border', () => {
  for (const [cols, rows] of [
    [80, 7],
    [81, 8],
    [12, 15],
    [1, 1],
    [200, 31],
  ] as const) {
    it(`closes a three-cell chase with a bulb on every corner at ${cols} × ${rows}`, () => {
      const b = board(cols, rows);
      const at = b.bulbs.map((l) => `${l.x},${l.y}`);
      expect(b.bulbs.length % 3).toBe(0);
      for (const corner of [
        [-1.5, -1.5],
        [cols + 0.5, -1.5],
        [cols + 0.5, rows + 0.5],
        [-1.5, rows + 0.5],
      ])
        expect(at).toContain(corner.join(','));
      // Neighbors along a side sit evenly apart, near 2.
      const gaps = b.bulbs.map((l, i) => {
        const n = b.bulbs[(i + 1) % b.bulbs.length] as typeof l;
        return Math.hypot(n.x - l.x, n.y - l.y);
      });
      for (const g of gaps) expect(g).toBeGreaterThan(1.3);
      for (const g of gaps) expect(g).toBeLessThan(3.1);
    });
  }
});
