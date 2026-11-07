import { describe, expect, it } from 'vitest';
import type { DisplayType } from '@/readout/type.js';
import { dl3416, hdsp211x, hdsp2000 } from '@/readout/types/parts-matrix.js';

const lit = (t: DisplayType, ch: string) => [...(t.encode(ch, 1, 'left')[0] ?? [])].sort();
const sorted = (s: string) => s.split(' ').filter(Boolean).sort();

/** A glyph's dots, as the datasheet draws it: seven rows of five, `#` lit. */
const dots = (rows: string) =>
  rows
    .split(' ')
    .flatMap((row, y) => [...row].flatMap((c, x) => (c === '#' ? [`${x},${y}`] : [])))
    .sort();

const ASCII = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String.fromCharCode(from + i));
const HP_SET = [...'◀¿ÑñαβδΔηθλμπσΣτφΩÅåÄäÖöÜü→√²£¥▒', ...ASCII(0x20, 0x7e)];
const DL_SET = ASCII(0x20, 0x5f);

describe('hdsp211x', () => {
  it('draws its ROM’s glyphs', () => {
    expect(lit(hdsp211x, 'A')).toEqual(dots('.###. #...# #...# ##### #...# #...# #...#'));
    expect(lit(hdsp211x, 'G')).toEqual(dots('.###. #...# #.... #.... #..## #...# .###.'));
    expect(lit(hdsp211x, '?')).toEqual(dots('.###. #...# ....# ...#. ..#.. ..... ..#..'));
    expect(lit(hdsp211x, 'g')).toEqual(dots('..... ..... .#### #...# .#### ....# ..##.'));
    expect(lit(hdsp211x, 'Ä')).toEqual(dots('.#.#. ..... .###. #...# ##### #...# #...#'));
    expect(lit(hdsp211x, '¥')).toEqual(dots('#...# .#.#. ..#.. ..#.. .###. ..#.. ..#..'));
    expect(lit(hdsp211x, '▒')).toEqual(dots('.#.#. #.#.# .#.#. #.#.# .#.#. #.#.# .#.#.'));
  });

  it('is a 5 × 7 grid of round dots', () => {
    expect(hdsp211x.cell.lights).toHaveLength(35);
    expect(hdsp211x.cell.lights.every((l) => l.shapes[0]?.kind === 'disc')).toBe(true);
  });
});

describe('hdsp2000', () => {
  it('draws its application note’s decoder table', () => {
    expect(lit(hdsp2000, 'A')).toEqual(lit(hdsp211x, 'A'));
    expect(lit(hdsp2000, 'G')).toEqual(dots('.###. #...# #.... #.... #..## #...# .####'));
    expect(lit(hdsp2000, '?')).toEqual(dots('.###. #...# #...# ...#. ..#.. ..... ..#..'));
    expect(lit(hdsp2000, 'α')).toEqual(dots('..... ..... .##.# #..#. #..#. #..#. .##.#'));
  });

  it('shares the HDSP-211x’s font but for ? and G', () => {
    const differ = HP_SET.filter((ch) => lit(hdsp2000, ch).join() !== lit(hdsp211x, ch).join());
    expect(differ).toEqual(['?', 'G']);
  });

  it('is a 5 × 7 grid of square dies', () => {
    expect(hdsp2000.cell.lights).toHaveLength(35);
    expect(hdsp2000.ends).toBe('square');
  });
});

describe('dl3416', () => {
  it('draws its datasheet’s glyphs', () => {
    expect(lit(dl3416, 'A')).toEqual(sorted('a1 a2 b c e f g1 g2'));
    expect(lit(dl3416, '0')).toEqual(sorted('a1 d1 e f i l'));
    expect(lit(dl3416, '"')).toEqual(sorted('f i'));
    expect(lit(dl3416, '&')).toEqual(sorted('a1 c d1 d2 e g1 h i m'));
    expect(lit(dl3416, '<')).toEqual(sorted('d1 d2 j k'));
    expect(lit(dl3416, '.')).toEqual(['dp']);
  });

  it('shows lowercase as uppercase', () => {
    expect(lit(dl3416, 'q')).toEqual(lit(dl3416, 'Q'));
  });
});

describe.each([
  ['hdsp211x', hdsp211x, HP_SET],
  ['hdsp2000', hdsp2000, HP_SET],
  ['dl3416', dl3416, DL_SET],
] as const)('%s', (_, type, set) => {
  const names = new Set(type.cell.lights.map((l) => l.name));

  it('encodes every character of its set', () => {
    for (const ch of set) {
      const on = lit(type, ch);
      if (ch !== ' ') expect(on.length, ch).toBeGreaterThan(0);
      for (const n of on) expect(names.has(n), `${ch}: ${n}`).toBe(true);
      expect(type.spell?.shown?.(ch)).toBe(ch);
    }
  });
});
