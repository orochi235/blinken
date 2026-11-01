import { describe, expect, it } from 'vitest';
import { covers, lampsOf, SHAPES } from '../lab/paint/model.js';
import { stampDots } from '../lab/paint/stamps.js';

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
});
