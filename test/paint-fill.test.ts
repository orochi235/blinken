import { describe, expect, it } from 'vitest';
import { floodFill } from '../lab/paint/fill.js';
import type { GridName } from '../src/index.js';

const red = { hex: 0xff0000, level: 1 };
const blue = { hex: 0x0000ff, level: 1 };
const layout = (grid: GridName) => ({ cols: 8, rows: 6, grid });

describe('flood fill', () => {
  it('fills an unlit square board from one corner to every dot', () => {
    expect(Object.keys(floodFill({}, layout('square'), [0, 0], red))).toHaveLength(48);
  });

  it('stops at a diagonal line on the square grid', () => {
    const wall = { '0,2': blue, '1,1': blue, '2,0': blue };
    const p = floodFill(wall, layout('square'), [0, 0], red);
    expect(Object.keys(p).sort()).toEqual(['0,0', '0,1', '0,2', '1,0', '1,1', '2,0']);
  });

  it('recolors only the region lit like the start, and erases with null', () => {
    const p = { '1,1': red, '2,1': red, '4,1': red };
    expect(floodFill(p, layout('square'), [1, 1], blue)).toEqual({
      '1,1': blue,
      '2,1': blue,
      '4,1': red,
    });
    expect(floodFill(p, layout('square'), [1, 1], null)).toEqual({ '4,1': red });
  });

  it('returns the picture itself when nothing would change', () => {
    const p = { '1,1': red };
    expect(floodFill(p, layout('square'), [1, 1], red)).toBe(p);
    expect(floodFill(p, layout('square'), [20, 1], blue)).toBe(p);
  });

  it('reaches four neighbors on square, six on hex and three on triangles', () => {
    expect(countNeighbors('square', [3, 3])).toBe(4);
    expect(countNeighbors('hex', [3, 3])).toBe(6);
    expect(countNeighbors('triangles', [3, 3])).toBe(3);
    expect(countNeighbors('triangles', [4, 3])).toBe(3);
  });
});

/** How many dots join `at`'s region when each, alone, is lit like it on a board of another color. */
function countNeighbors(grid: GridName, [x, y]: [number, number]): number {
  const green = { hex: 0x00ff00, level: 1 };
  const board: Record<string, { hex: number; level: number }> = {};
  for (let i = 0; i < 48; i++) board[`${i % 8},${Math.floor(i / 8)}`] = green;
  board[`${x},${y}`] = red;
  let joined = 0;
  for (const k of Object.keys(board)) {
    if (k === `${x},${y}`) continue;
    const trial = { ...board, [k]: red };
    const out = floodFill(trial, { cols: 8, rows: 6, grid }, [x, y], blue);
    if (out[k]?.hex === blue.hex) joined++;
  }
  return joined;
}
