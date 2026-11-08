import { describe, expect, it } from 'vitest';
import { board, everyOf } from '@/board.js';
import { steadyOf } from '@/border.js';
import { BULB } from '@/modulators/chase.js';

const setting = {} as never;
const b = board(20, 7);

describe('the steady border', () => {
  it('plays a shader patch on every subject for the gpu engine, lighting cells and resting dots', () => {
    const { patch, subjects } = steadyOf(b, true);
    expect('with' in patch).toBe(true);
    expect(subjects).toBe(everyOf(b));
    expect(patch.at(0.3, b.cells[0] as never, setting)).toEqual({ lit: 1, tint: BULB });
    expect(patch.at(0.3, b.dots[0] as never, setting)).toEqual({ lit: 0, tint: [0, 0, 0, 0] });
  });

  it('plays the plain patch on the cells for the stock mixer', () => {
    const { patch, subjects } = steadyOf(b, false);
    expect('with' in patch).toBe(false);
    expect(subjects).toBe(b.cells);
    expect(patch.at(0.3, b.cells[0] as never, setting)).toEqual({ lit: 1, tint: BULB });
  });
});
