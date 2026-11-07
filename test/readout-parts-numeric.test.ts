import { describe, expect, it } from 'vitest';
import type { DisplayType } from '@/readout/type.js';
import { dl34, dl330m, hp50827415, PART_SEVEN } from '@/readout/types/parts-numeric.js';

const PARTS: readonly DisplayType[] = [dl330m, hp50827415, dl34];
const SEGS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'];

const one = (t: DisplayType, v: string) => [...(t.encode(v, 1, 'left')[0] ?? [])].sort();
const sorted = (s: string) => s.split(' ').sort();

describe.each(PARTS)('$name', (t) => {
  it('has the datasheet’s segments a to g and a decimal point, and no colon', () => {
    expect(t.cell.lights.map((l) => l.name).sort()).toEqual([...SEGS].sort());
  });

  it('keeps every shape inside its cell', () => {
    for (const l of t.cell.lights)
      for (const s of l.shapes) {
        const pts =
          s.kind === 'disc'
            ? [[s.x - s.r, s.y - s.r] as const, [s.x + s.r, s.y + s.r] as const]
            : s.kind === 'bar'
              ? [[s.x1, s.y1] as const, [s.x2, s.y2] as const]
              : s.points;
        for (const [x, y] of pts) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(t.cell.width);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(t.cell.height);
        }
      }
  });

  it('spells digits and hex as the seven-segment code does', () => {
    expect(one(t, '0')).toEqual(sorted('a b c d e f'));
    expect(one(t, '1')).toEqual(sorted('b c'));
    expect(one(t, '4')).toEqual(sorted('b c f g'));
    expect(one(t, '7')).toEqual(sorted('a b c'));
    expect(one(t, 'b')).toEqual(sorted('c d e f g'));
    expect(one(t, 'c')).toEqual(sorted('d e g'));
    expect(one(t, '-')).toEqual(['g']);
  });

  it('puts a decimal point on the cell before it, and shows a colon as nothing', () => {
    const cells = t.encode('3.14', 3, 'right').map((s) => [...s].sort());
    expect(cells[0]).toEqual(sorted('a b c d g dp'));
    expect(cells[1]).toEqual(sorted('b c'));
    expect(one(t, ':')).toEqual([]);
  });

  it('encodes its whole character set', () => {
    for (const [ch, lights] of Object.entries(PART_SEVEN)) {
      const lit = one(t, ch);
      expect(lit).toEqual(lights ? sorted(lights) : []);
      if (ch !== ' ') expect(lit.length).toBeGreaterThan(0);
    }
  });

  it('carries its part’s red', () => {
    expect(t.color).toBeDefined();
    expect((t.color ?? 0) >> 16).toBe(0xff);
  });
});

describe('the character set', () => {
  it('covers the digits and the hex letters', () => {
    for (const ch of '0123456789AbCcdEF')
      expect(PART_SEVEN[ch] ?? PART_SEVEN[ch.toUpperCase()]).toBeTruthy();
  });
});

describe('the parts’ looks', () => {
  it('drops the HP decimal point below the digit, the others onto the baseline', () => {
    const dpY = (t: DisplayType) => {
      const s = t.cell.lights.find((l) => l.name === 'dp')?.shapes[0];
      return s?.kind === 'disc' ? s.y : s?.kind === 'bar' ? s.y1 : Number.NaN;
    };
    expect(dpY(hp50827415)).toBeGreaterThan(19);
    expect(dpY(dl330m)).toBeLessThan(17.5);
    expect(dpY(dl34)).toBeLessThan(17.5);
  });

  it('draws each DL-34 segment as four dots', () => {
    for (const l of dl34.cell.lights.filter((l) => l.name !== 'dp'))
      expect(l.shapes).toHaveLength(4);
  });
});
