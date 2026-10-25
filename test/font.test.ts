import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { EFFECTS } from '@/builtins.js';
import { stageEffect } from '@/effects.js';
import { CHARS, FACE_NAMES, FACES, type Face, faceOf, rasterize, SHADOW } from '@/font.js';
import { placeText, rankOf } from '@/orders.js';
import { stageProgram } from '@/program.js';

/** A bitmap's dots as rows of `#` and `.`. */
const picture = (text: string, look = {}) => {
  const b = rasterize(text, look);
  return Array.from({ length: b.rows }, (_, y) =>
    Array.from({ length: b.cols }, (_, x) => (b.lit(x, y) ? '#' : '.')).join(''),
  );
};

describe('faces', () => {
  it('give every built-in face a glyph of its own height for every character', () => {
    expect(FACE_NAMES.slice(0, 4)).toEqual(['standard', 'slim', 'wide', 'bold']);
    const widths: Record<string, number> = { standard: 5, slim: 3, wide: 10, bold: 6 };
    for (const name of FACE_NAMES) {
      const face = FACES[name];
      if (name in widths) {
        expect(face.rows).toBe(7);
        expect(face.width).toBe(widths[name]);
      }
      for (const ch of [...CHARS, ' ']) {
        const g = face.glyph(ch) as readonly string[];
        expect(g, `${name} ${ch}`).toHaveLength(face.rows);
        for (const row of g) expect(row.length, `${name} ${ch}`).toBe(face.width);
      }
    }
  });

  it('draws every character but the space with some dot lit, in every face', () => {
    for (const name of FACE_NAMES)
      for (const ch of CHARS)
        expect(
          picture(ch, { face: name }).some((r) => r.includes('#')),
          `${name} ${ch}`,
        ).toBe(true);
  });

  it('gives each slim letter its own pattern', () => {
    const seen = new Map<string, string>();
    for (const ch of CHARS) {
      const key = picture(ch, { face: 'slim' }).join('/');
      expect(seen.get(key), `${ch} looks like ${seen.get(key)}`).toBeUndefined();
      seen.set(key, ch);
    }
  });

  it('doubles every column of the standard face for wide', () => {
    const standard = picture('A');
    expect(picture('A', { face: 'wide' })).toEqual(
      standard.map((r) =>
        [...r.slice(0, 5)]
          .map((c) => c + c)
          .join('')
          .concat('.'),
      ),
    );
  });

  it('lights each lit dot and the one to its right for bold, a column wider', () => {
    expect(picture('I', { face: 'bold', style: { monospace: true } })).toEqual([
      '.####..',
      '..##...',
      '..##...',
      '..##...',
      '..##...',
      '..##...',
      '.####..',
    ]);
    expect(rasterize('II', { face: 'bold', style: { monospace: true } }).cols).toBe(14);
  });

  it('lays monospace slim letters four columns apart', () => {
    expect(rasterize('HELLO', { face: 'slim', style: { monospace: true } }).cols).toBe(20);
  });

  it('takes a face given in full, and throws on a name no face has', () => {
    const tiny: Face = { name: 'tiny', rows: 2, width: 1, glyph: () => ['#', '#'] };
    expect(picture('AB', { face: tiny })).toEqual(['#.#.', '#.#.']);
    expect(() => faceOf('gothic' as never)).toThrow('no face named gothic');
  });
});

describe('styles', () => {
  it('advances each glyph by its inked width and a blank', () => {
    expect(picture('I1')).toEqual([
      '###..#..',
      '.#..##..',
      '.#...#..',
      '.#...#..',
      '.#...#..',
      '.#...#..',
      '###.###.',
    ]);
    // A space has no ink, so it takes half the face's width.
    expect(rasterize(' ').cols).toBe(4);
    expect(rasterize('MI').cols).toBe(6 + 4);
  });

  it('kerns each glyph left until its ink is a blank from the ink before it in every shared row', () => {
    expect(picture('LT')).toEqual([
      '#...#####.',
      '#.....#...',
      '#.....#...',
      '#.....#...',
      '#.....#...',
      '#.....#...',
      '#####.#...',
    ]);
    // The serif J's descender tucks under the N, sharing three of its columns.
    const nj = rasterize('NJ', { face: 'nj serif' });
    expect(nj.letters.map((l) => l.x)).toEqual([0, 7]);
    expect(nj.letterAt(7, 8)).toBe(1);
    expect(nj.letterAt(7, 0)).toBe(0);
    // Nor may ink come within a dot diagonally: slim's O keeps clear of the L's foot.
    expect(rasterize('LO', { face: 'slim' }).letters.map((l) => l.x)).toEqual([0, 4]);
    // A space keeps its width: nothing slides into it.
    expect(rasterize('I I').letters.map((l) => l.x)).toEqual([0, 4, 8]);
  });

  it('outlines a letter hollow, a row above and below and a blank kept between letters', () => {
    const hi = rasterize('HI', { style: { outline: true } });
    expect(picture('HI', { style: { outline: true } })).toEqual([
      '###.###.#####.',
      '#.#.#.#.#...#.',
      '#.#.#.#.##.##.',
      '#.###.#..#.#..',
      '#.....#..#.#..',
      '#.###.#..#.#..',
      '#.#.#.#.##.##.',
      '#.#.#.#.#...#.',
      '###.###.#####.',
    ]);
    expect([hi.rows, hi.above, hi.below]).toEqual([9, 1, 1]);
  });

  it('lays a dim shadow a dot down and right, behind the letter', () => {
    const i = rasterize('I', { style: { shadow: true } });
    expect([i.cols, i.rows, i.below]).toEqual([5, 8, 1]);
    expect(i.level(0, 0)).toBe(1);
    expect(i.level(2, 1)).toBeCloseTo(SHADOW);
    expect(i.level(3, 7)).toBeCloseTo(SHADOW);
    // The letter covers its own shadow.
    expect(i.level(1, 1)).toBe(1);
    expect(i.lit(0, 7)).toBe(false);
  });

  it('monospace advances every glyph by the face’s widest and a blank', () => {
    expect(rasterize('MI', { style: { monospace: true } }).cols).toBe(6 + 6);
    expect(rasterize(' ', { style: { monospace: true } }).cols).toBe(6);
  });

  it('spans each letter, so a letter rasterized alone lines up inside its span', () => {
    for (const style of [{}, { outline: true }, { monospace: true }]) {
      const text = rasterize('WIN', { style });
      expect(text.letters.reduce((n, l) => n + l.width, 0)).toBe(text.cols);
      text.letters.forEach((span, k) => {
        const alone = rasterize('WIN'[k] as string, { style });
        for (let u = 0; u < span.width; u++) {
          expect(text.letterAt(span.x + u)).toBe(k);
          for (let y = 0; y < 7; y++) expect(alone.lit(u, y)).toBe(text.lit(span.x + u, y));
        }
      });
      expect(text.letterAt(-1)).toBe(-1);
      expect(text.letterAt(text.cols)).toBe(-1);
    }
  });

  it('orders letter by letter by each letter’s own span when proportional', () => {
    const b = board(40, 7);
    const at = placeText(b, 'MI');
    const rank = rankOf({ by: 'letter' }, at);
    const dot = (x: number) => b.dots[x] as never;
    expect(rank(dot(at.left + 5))).toBe(0);
    expect(rank(dot(at.left + 6))).toBe(1);
    expect(rank(dot(at.left + 9))).toBe(1);
  });
});

describe('a face taller than the sign', () => {
  const tall: Face = { name: 'tall', rows: 9, width: 5, glyph: () => Array(9).fill('#####') };

  it('still plays, showing the top of its letters', () => {
    const b = board(80, 7);
    const staged = stageProgram(b, [
      { text: 'A', hex: 0, effect: 'hold', face: tall },
      { text: 'B', hex: 0, effect: 'hold', face: 'slim' },
    ]);
    expect(staged.map((s) => s.scene)).toEqual([0, 1]);
    expect(placeText(b, 'A', { face: tall }).cut).toEqual([7, 8]);
  });

  it('warns how tall a sign shows all of it', () => {
    const at = placeText(board(80, 7), 'A', { face: tall });
    expect(stageEffect(EFFECTS.hold, at, 0).warnings).toContainEqual({
      text: 'A in the tall face runs off a 7-row sign; a sign 9 rows tall shows all of it',
      rows: 9,
    });
  });

  it('spaces lines by its body, with ghost rows in the gap between them', () => {
    const tailed: Face = {
      name: 'tailed',
      rows: 8,
      below: 1,
      width: 1,
      glyph: () => ['#', '.', '.', '.', '.', '.', '.', '#'],
    };
    const text = rasterize('A', { face: tailed });
    expect(placeText(board(80, 7), 'A', { face: tailed }).cut).toEqual([7]);
    const two = placeText(board(10, 15), 'A', { face: tailed });
    expect(two.lines).toBe(2);
    expect(two.cut).toEqual([]);
    const rows = board(10, 15)
      .dots.filter((d) => d.x === 0)
      .map((d) => two.rowOf(d));
    expect(rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6]);
    expect(text.rows).toBe(8);
  });

  it('fits a board whose lines are as tall as it', () => {
    expect(
      stageProgram(board(80, 7), [{ text: 'A', hex: 0, effect: 'hold', face: 'wide' }]),
    ).toHaveLength(1);
  });
});
