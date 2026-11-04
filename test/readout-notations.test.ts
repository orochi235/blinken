import { describe, expect, it } from 'vitest';
import type { DisplayType, SegShape } from '@/readout/type.js';
import { bargraph, bcd, dice, tally } from '@/readout/types/counts.js';
import { matrix } from '@/readout/types/matrix.js';
import { nixie } from '@/readout/types/nixie.js';
import { cistercian, kaktovik, maya, rods } from '@/readout/types/numerals.js';
import { braille, morse, ogham, semaphore } from '@/readout/types/scripts.js';

const ALL: DisplayType[] = [
  nixie,
  cistercian,
  maya,
  kaktovik,
  rods,
  braille,
  ogham,
  morse,
  semaphore,
  dice,
  tally,
  bcd,
  bargraph,
  matrix,
];

const names = (cells: ReadonlySet<string>[]) => cells.map((c) => [...c].sort());
const sorted = (s: string) => (s ? s.split(' ').sort() : []);

/** A shape's extent, strokes and discs included. */
function bounds(s: SegShape): [number, number, number, number] {
  if (s.kind === 'disc') return [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r];
  const pts =
    s.kind === 'bar'
      ? [
          [s.x1, s.y1],
          [s.x2, s.y2],
        ]
      : s.points;
  const h = s.w / 2;
  const xs = pts.map((p) => p[0] as number);
  const ys = pts.map((p) => p[1] as number);
  return [Math.min(...xs) - h, Math.min(...ys) - h, Math.max(...xs) + h, Math.max(...ys) + h];
}

describe('notation encoders', () => {
  it('writes 1993 as one Cistercian glyph', () => {
    expect(names(cistercian.encode(1993, 1, 'right'))).toEqual([
      ['h-l', 'h-t', 'h-v', 'k-t', 'stem', 't-l', 't-t', 't-v', 'u-d'],
    ]);
  });

  it('packs four places per Cistercian cell', () => {
    const [hi, lo] = names(cistercian.encode(12_0005, 2, 'right'));
    expect(hi).toEqual(['stem', 't-t', 'u-l']);
    expect(lo).toEqual(['stem', 'u-t', 'u-u']);
  });

  it('shows Maya zero as the shell', () => {
    expect(names(maya.encode(0, 1, 'right'))).toEqual([['shell']]);
    expect(names(maya.encode(27, 2, 'right'))).toEqual([['d0'], ['b0', 'd0', 'd1']]);
  });

  it('writes 2026 in Kaktovik as 5, 1, 6', () => {
    expect(names(kaktovik.encode(2026, 3, 'right'))).toEqual([['f0'], ['s0'], ['f0', 's0']]);
    expect(names(kaktovik.encode(19, 1, 'right'))).toEqual([
      ['f0', 'f1', 'f2', 's0', 's1', 's2', 's3'],
    ]);
  });

  it('stands units and hundreds and lays tens and thousands', () => {
    expect(names(rods.encode(1729, 4, 'right'))).toEqual([
      ['h0'],
      ['r0', 'r1', 'top'],
      ['h0', 'h1'],
      ['r0', 'r1', 'r2', 'r3', 'top'],
    ]);
  });

  it('spells B in Morse as dash, dot, dot, dot', () => {
    expect(names(morse.encode('B', 1, 'left'))).toEqual([['dash0', 'dot1', 'dot2', 'dot3']]);
  });

  it('writes b in Braille as dots 1 and 2, and digits after the number sign', () => {
    expect(names(braille.encode('b', 1, 'left'))).toEqual([['d1', 'd2']]);
    expect(names(braille.encode('12a', 4, 'left'))).toEqual([
      sorted('d3 d4 d5 d6'),
      ['d1'],
      ['d1', 'd2'],
      ['d5', 'd6'],
    ]);
  });

  it('signals R in semaphore with both arms straight out', () => {
    expect(names(semaphore.encode('R', 1, 'left'))).toEqual([['E', 'W', 'hub']]);
  });

  it('lights the Ogham stem in every lettered cell', () => {
    expect(names(ogham.encode('BRI', 4, 'left'))).toEqual([
      ['r0', 'stem'],
      ['stem', 'x0', 'x1', 'x2', 'x3', 'x4'],
      ['n0', 'n1', 'n2', 'n3', 'n4', 'stem'],
      [],
    ]);
  });

  it('fills tally gates of five', () => {
    expect(names(tally.encode(7, 2, 'right'))).toEqual([
      ['s0', 's1', 's2', 's3', 'slash'],
      ['s0', 's1'],
    ]);
  });

  it('lights round(v × cells) bars from the left', () => {
    const lit = bargraph.encode(0.7, 10, 'left').filter((c) => c.has('bar'));
    expect(lit).toHaveLength(7);
    expect(bargraph.encode(0.7, 10, 'left')[6]?.has('bar')).toBe(true);
    expect(bargraph.encode('x', 3, 'left').every((c) => c.size === 0)).toBe(true);
  });

  it('shows digits as dice pips and BCD lamps', () => {
    expect(names(dice.encode(5, 1, 'right'))).toEqual([sorted('tl tr c bl br')]);
    expect(names(bcd.encode(93, 2, 'right'))).toEqual([
      ['1', '8'],
      ['1', '2'],
    ]);
  });

  it('draws text in the standard 5 × 7 face', () => {
    const [i] = names(matrix.encode('i', 1, 'left'));
    expect(i).toContain('2,3');
    expect(i).not.toContain('0,3');
    expect(i).toHaveLength(11);
  });

  it('lights one Nixie numeral per digit', () => {
    expect(names(nixie.encode(1984, 4, 'right'))).toEqual([['1'], ['9'], ['8'], ['4']]);
    expect(names(nixie.encode('4.2', 3, 'right'))).toEqual([['4'], [], ['2']]);
  });

  it('blanks number types for values they cannot write', () => {
    for (const t of [cistercian, maya, kaktovik, rods, tally])
      for (const v of [-3, 1.5, 'abc', ''])
        expect(t.encode(v, 2, 'right').every((c) => c.size === 0)).toBe(true);
  });

  it('keeps the last cells of a number too long', () => {
    expect(names(maya.encode(20 ** 3, 2, 'right'))).toEqual([['shell'], ['shell']]);
  });
});

describe('notation cells', () => {
  it('stacks Nixie numerals back to front, each a stroke of ≥ 2 points', () => {
    expect(nixie.cell.lights.map((l) => l.name)).toEqual('1 6 2 7 5 0 4 9 8 3'.split(' '));
    for (const l of nixie.cell.lights)
      for (const s of l.shapes) {
        expect(s.kind).toBe('poly');
        if (s.kind === 'poly') expect(s.points.length).toBeGreaterThanOrEqual(2);
      }
  });

  for (const t of ALL) {
    it(`${t.name}: light names are unique and every shape sits in its cell`, () => {
      const lightNames = t.cell.lights.map((l) => l.name);
      expect(new Set(lightNames).size).toBe(lightNames.length);
      for (const l of t.cell.lights) {
        expect(l.shapes.length).toBeGreaterThan(0);
        for (const s of l.shapes) {
          const [x0, y0, x1, y1] = bounds(s);
          expect(x0).toBeGreaterThanOrEqual(-1e-9);
          expect(y0).toBeGreaterThanOrEqual(-1e-9);
          expect(x1).toBeLessThanOrEqual(t.cell.width + 1e-9);
          expect(y1).toBeLessThanOrEqual(t.cell.height + 1e-9);
        }
      }
    });

    it(`${t.name}: every name it lights is a light of its cell`, () => {
      const known = new Set(t.cell.lights.map((l) => l.name));
      const samples = ['0', '7', '19', '1993', '9999', 'BREE', 'hello 42', 'ᚁᚍ', '0.5', '1'];
      for (const v of samples)
        for (const cell of t.encode(v, 6, t.align))
          for (const n of cell) expect(known).toContain(n);
    });
  }
});
