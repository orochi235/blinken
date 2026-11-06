import { describe, expect, it } from 'vitest';
import type { DisplayType } from '@/readout/type.js';
import { fourteen, sixteen, twentytwo } from '@/readout/types/alpha.js';
import { TYPES } from '@/readout/types/index.js';
import { eight, half, nine, seven } from '@/readout/types/segments.js';

const ALL: readonly DisplayType[] = [seven, eight, nine, half, fourteen, sixteen, twentytwo];
const TEXT = [seven, eight, nine, fourteen, sixteen, twentytwo];
const UPPER = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const LOWER = [...'abcdefghijklmnopqrstuvwxyz'];
const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));

const lit = (t: DisplayType, v: string | number, cells: number, align = t.align) =>
  t.encode(v, cells, align).map((s) => [...s].sort());
const one = (t: DisplayType, ch: string | number) => lit(t, ch, 1, 'left')[0] ?? [];
const sorted = (s: string) => s.split(' ').sort();

describe('seven', () => {
  it('lights 12:34 with the colon on the second cell', () => {
    expect(lit(seven, '12:34', 4, 'right')).toEqual([
      sorted('b c'),
      sorted('a b g e d colon'),
      sorted('a b g c d'),
      sorted('f g b c'),
    ]);
  });

  it('puts a decimal point on the cell before it', () => {
    const [first, second] = lit(seven, '1.5', 2, 'right');
    expect(first).toContain('dp');
    expect(second).not.toContain('dp');
  });

  it('shows an unknown character blank', () => {
    expect(lit(seven, 'Q', 1)).toEqual([[]]);
  });

  it('keeps the last cells of a number and the first of text', () => {
    expect(lit(seven, 123456, 4, 'right')).toEqual(lit(seven, '3456', 4, 'right'));
    expect(lit(seven, 'HELLO', 3, 'left')).toEqual(lit(seven, 'HEL', 3, 'left'));
  });

  it('shows hex in either case, and tells C from c', () => {
    for (const ch of '0123456789ABCDEFabcdef') expect(one(seven, ch).length).toBeGreaterThan(0);
    for (const ch of 'ABDEF') expect(one(seven, ch.toLowerCase())).toEqual(one(seven, ch));
    expect(one(seven, 'c')).not.toEqual(one(seven, 'C'));
    expect(one(seven, 'o')).not.toEqual(one(seven, 'O'));
  });
});

describe('eight and nine', () => {
  it('draws eight’s 4 with the diagonal', () => {
    expect(one(eight, '4')).toEqual(sorted('h g b c'));
    expect(one(eight, '5')).toEqual(one(seven, '5'));
  });

  it('slants nine’s 7 and draws its Z with the diagonals', () => {
    expect(one(nine, '7')).toContain('i');
    expect(one(nine, 'Z')).toEqual(sorted('a b i d'));
  });
});

describe('half', () => {
  it('lights a 1, a minus, both or neither', () => {
    expect(one(half, '1')).toEqual(['one']);
    expect(one(half, '-')).toEqual(['minus']);
    expect(one(half, '-1')).toEqual(['minus', 'one']);
    expect(one(half, -1)).toEqual(['minus', 'one']);
    expect(one(half, '')).toEqual([]);
    expect(one(half, '7')).toEqual([]);
  });

  it('pads to its cells on its alignment', () => {
    expect(lit(half, '1', 2, 'right')).toEqual([[], ['one']]);
  });
});

describe('the alphanumerics', () => {
  for (const t of [fourteen, sixteen, twentytwo]) {
    it(`${t.name} shows every capital, each differently`, () => {
      const sets = UPPER.map((ch) => one(t, ch).join(' '));
      for (const s of sets) expect(s).not.toBe('');
      expect(new Set(sets).size).toBe(UPPER.length);
    });

    it(`${t.name} shows every digit`, () => {
      for (const ch of '0123456789') expect(one(t, ch).length).toBeGreaterThan(0);
    });
  }

  it('fourteen and sixteen show lowercase as capitals', () => {
    for (const t of [fourteen, sixteen]) expect(one(t, 'q')).toEqual(one(t, 'Q'));
  });

  it('puts fourteen’s comma and point on the cell before them', () => {
    expect(lit(fourteen, 'A,B.', 2, 'left')).toEqual([
      [...one(fourteen, 'A'), 'comma'].sort(),
      [...one(fourteen, 'B'), 'dp'].sort(),
    ]);
  });

  it('splits sixteen’s top and bottom bars', () => {
    expect(one(sixteen, 'A')).toEqual(expect.arrayContaining(['a1', 'a2']));
    expect(one(sixteen, '[')).toEqual(sorted('a2 d2 i l'));
  });

  it('gives twentytwo a distinct lowercase, descending below the baseline', () => {
    const sets = LOWER.map((ch) => one(twentytwo, ch).join(' '));
    for (const s of sets) expect(s).not.toBe('');
    expect(new Set(sets).size).toBe(LOWER.length);
    for (const ch of LOWER)
      expect(one(twentytwo, ch)).not.toEqual(one(twentytwo, ch.toUpperCase()));
    const down = new Set(['n', 'o', 'p', 'q1', 'q2', 'r']);
    for (const ch of 'gjpqy') expect(one(twentytwo, ch).some((n) => down.has(n))).toBe(true);
    for (const ch of 'aceosx') expect(one(twentytwo, ch).some((n) => down.has(n))).toBe(false);
    expect(twentytwo.cell.height).toBeGreaterThan(sixteen.cell.height);
  });
});

describe('every type', () => {
  for (const t of ALL) {
    const names = t.cell.lights.map((l) => l.name);

    it(`${t.name} names each light once`, () => {
      expect(new Set(names).size).toBe(names.length);
    });

    it(`${t.name} lights only lights it has, for any printable character`, () => {
      const have = new Set(names);
      for (const ch of [...ASCII, '°']) for (const n of one(t, ch)) expect(have.has(n)).toBe(true);
    });

    it(`${t.name} returns exactly its cells and never throws`, () => {
      for (const v of ['', 'x', '~~~~~~~~~~', 'é漢', -0.5, 1e21, Number.NaN]) {
        expect(t.encode(v, 5, 'left')).toHaveLength(5);
        expect(t.encode(v, 5, 'right')).toHaveLength(5);
      }
    });
  }

  it('every bar-segment type shares the family look', () => {
    for (const t of ALL) {
      expect([t.gap, t.ends, t.socket, t.glow]).toEqual([2.5, 'point', 'segment', 1]);
    }
    for (const t of TEXT.slice(0, 3)) expect(t.align).toBe('right');
    for (const t of TEXT.slice(3)) expect(t.align).toBe('left');
  });
});

describe('cell text', () => {
  it('gives each cell the characters it shows, a mark riding on the cell before it', () => {
    expect(TYPES.seven.text?.('12.5', 5, 'right')).toEqual(['', '', '1', '2.', '5']);
    expect(TYPES.seven.text?.('12:30', 4, 'right')).toEqual(['1', '2:', '3', '0']);
    expect(TYPES.fourteen.text?.('HI,', 3, 'left')).toEqual(['H', 'I,', '']);
  });

  it('keeps the cells a long value keeps', () => {
    expect(TYPES.seven.text?.('123456', 4, 'right')).toEqual(['3', '4', '5', '6']);
    expect(TYPES.matrix.text?.('HELLO', 3, 'left')).toEqual(['H', 'E', 'L']);
  });

  it('is there only for types that spell letters or numbers', () => {
    const spelling = Object.values(TYPES)
      .filter((t) => t.text)
      .map((t) => t.name)
      .sort();
    expect(spelling).toEqual(
      [
        'eight',
        'fourteen',
        'half',
        'matrix',
        'nine',
        'nixie',
        'seven',
        'sixteen',
        'triangles',
        'triangles-fine',
        'twentytwo',
      ].sort(),
    );
  });
});

describe('cell places', () => {
  it('puts each character in the cell its text shows it in, a mark on its cell', () => {
    expect(TYPES.seven.places?.('12.5', 5, 'right')).toEqual([2, 3, 3, 4]);
    expect(TYPES.fourteen.places?.('HI', 4, 'left')).toEqual([0, 1]);
  });

  it('gives -1 to a character the readout cuts off', () => {
    expect(TYPES.seven.places?.('12345', 3, 'right')).toEqual([-1, -1, 0, 1, 2]);
    expect(TYPES.matrix.places?.('HELLO', 3, 'left')).toEqual([0, 1, 2, -1, -1]);
  });
});
