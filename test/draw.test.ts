import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { haloRadius, paintBulbs, signColumns } from '@/draw.js';

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

describe('paintBulbs', () => {
  it('gives each bulb, after the dots, its cell’s pose', () => {
    const b = board(10, 7);
    const cols = signColumns(b.dots.length + b.bulbs.length);
    const cells = signColumns(b.cells.length);
    cells.lit.set([0.25, 0.5, 1]);
    cells.tint.set([1, 2, 3, 4], 4);
    paintBulbs(b, cells, cols);
    const at = b.dots.length;
    expect(cols.lit[0]).toBe(0);
    expect([...cols.lit.subarray(at, at + 4)]).toEqual([0.25, 0.5, 1, 0.25]);
    expect([...cols.tint.subarray((at + 1) * 4, (at + 2) * 4)]).toEqual([1, 2, 3, 4]);
    expect(cols.gain[at]).toBe(1);
  });
});
