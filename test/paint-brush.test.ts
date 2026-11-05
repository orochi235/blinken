import { describe, expect, it } from 'vitest';
import { GRIDS, type GridName } from '@/index.js';
import { covers, lampsOf, MAX_COLS, onGrid, SHAPES } from '../lab/paint/model.js';
import { stampBox, stampDots } from '../lab/paint/stamps.js';

/** The dots a brush covers on a square grid, as `"dx,dy"`. */
const footprint = (shape: (typeof SHAPES)[number], size: number) => {
  const out: string[] = [];
  for (let dy = -8; dy <= 8; dy++)
    for (let dx = -8; dx <= 8; dx++) if (covers(shape, size, dx, dy)) out.push(`${dx},${dy}`);
  return out;
};

describe('paint brushes', () => {
  it('cover their size across, in their shape', () => {
    expect(footprint('square', 3)).toHaveLength(9);
    expect(footprint('diamond', 3)).toHaveLength(5);
    expect(footprint('round', 5)).toHaveLength(13);
    expect(footprint('row', 5)).toEqual(['-2,0', '-1,0', '0,0', '1,0', '2,0']);
    expect(footprint('column', 3)).toEqual(['0,-1', '0,0', '0,1']);
  });

  it('keep to one row or column of triangles, centered on a triangle', () => {
    const [cx, cy] = GRIDS.triangles(10, 5);
    const hit = (shape: (typeof SHAPES)[number]) => {
      const out: [number, number][] = [];
      for (let r = 0; r < 11; r++)
        for (let k = 0; k < 21; k++) {
          const [x, y] = GRIDS.triangles(k, r);
          if (covers(shape, 5, x - cx, y - cy)) out.push([k, r]);
        }
      return out;
    };
    expect(hit('row').every(([, r]) => r === 5)).toBe(true);
    expect(hit('row')).toHaveLength(9);
    expect(hit('column').every(([k]) => k === 10)).toBe(true);
  });

  it('cover only the dot under them at size 1', () => {
    for (const shape of SHAPES) expect(footprint(shape, 1)).toEqual(['0,0']);
  });
});

describe('paint lamps', () => {
  it('turn a size and gap into a share of the pitch, fitted or not', () => {
    const base = { size: 12, gap: 4, brightness: 1, glow: 1 };
    expect(lampsOf({ ...base, fit: false })).toMatchObject({ size: 0.75, pitch: 16 });
    expect(lampsOf({ ...base, fit: true }).pitch).toBeUndefined();
  });
});

describe('paint stamps', () => {
  it('light their text where they stand, cut at the board edge', () => {
    const stamp = { id: 'a', text: 'I', face: 'standard', x: 0, y: 0, hex: 1, level: 0.5 } as const;
    const dots = stampDots(stamp, { cols: 40, rows: 10, grid: 'square' });
    expect(Object.keys(dots).length).toBeGreaterThan(0);
    expect(Object.values(dots).every((d) => d.hex === 1 && d.level === 0.5)).toBe(true);
    const cut = stampDots({ ...stamp, x: -100 }, { cols: 40, rows: 10, grid: 'square' });
    expect(cut).toEqual({});
  });

  it('lay text two triangles to a dot on the triangle tiling', () => {
    const stamp = { id: 'a', text: 'HI', face: 'standard', x: 0, y: 0, hex: 1, level: 1 } as const;
    const across = (grid: GridName) =>
      Math.max(...Object.keys(stampDots(stamp, { cols: 200, rows: 20, grid })).map(parseFloat)) + 1;
    expect(across('triangles')).toBeGreaterThanOrEqual(across('square') * 2);
    expect(stampBox(stamp, 'triangles').cols).toBeGreaterThanOrEqual(across('triangles'));
  });
});

describe('paint layouts', () => {
  it('keep their width across a change of grid', () => {
    const square = { cols: 48, rows: 32, grid: 'square' } as const;
    expect(onGrid(square, 'triangles')).toEqual({ ...square, grid: 'triangles', cols: 96 });
    expect(onGrid(onGrid(square, 'triangles'), 'hex')).toEqual({ ...square, grid: 'hex' });
    expect(onGrid({ ...square, cols: 150 }, 'triangles').cols).toBe(MAX_COLS);
  });
});
