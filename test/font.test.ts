import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { EFFECTS } from '@/builtins.js';
import { stageEffect } from '@/effects.js';
import { CHARS, FACE_NAMES, FACES, type Face, faceOf, rasterize } from '@/font.js';
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
  it('give every built-in face 7 rows and a glyph for every character', () => {
    expect(FACE_NAMES.slice(0, 4)).toEqual(['standard', 'slim', 'wide', 'bold']);
    const widths: Record<string, number> = { standard: 5, slim: 3, wide: 10, bold: 6 };
    for (const name of FACE_NAMES) {
      const face = FACES[name];
      expect(face.rows, name).toBe(7);
      if (name in widths) expect(face.width).toBe(widths[name]);
      for (const ch of [...CHARS, ' ']) {
        const g = face.glyph(ch) as readonly string[];
        expect(g, `${name} ${ch}`).toHaveLength(7);
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
    expect(picture('I', { face: 'bold' })).toEqual([
      '.####..',
      '..##...',
      '..##...',
      '..##...',
      '..##...',
      '..##...',
      '.####..',
    ]);
    expect(rasterize('II', { face: 'bold' }).cols).toBe(14);
  });

  it('lays slim letters four columns apart', () => {
    expect(rasterize('HELLO', { face: 'slim' }).cols).toBe(20);
  });

  it('takes a face given in full, and throws on a name no face has', () => {
    const tiny: Face = { name: 'tiny', rows: 2, width: 1, glyph: () => ['#', '#'] };
    expect(picture('AB', { face: tiny })).toEqual(['#.#.', '#.#.']);
    expect(() => faceOf('gothic' as never)).toThrow('no face named gothic');
  });
});

describe('styles', () => {
  it('reverse lights the box and leaves the glyphs dark, with a lit column either side', () => {
    expect(picture('I', { style: { reverse: true } })).toEqual([
      '##...##',
      '###.###',
      '###.###',
      '###.###',
      '###.###',
      '###.###',
      '##...##',
    ]);
    expect(rasterize('', { style: { reverse: true } }).cols).toBe(0);
  });

  it('proportional advances each glyph by its inked width and a blank', () => {
    expect(picture('I1', { style: { proportional: true } })).toEqual([
      '###..#..',
      '.#..##..',
      '.#...#..',
      '.#...#..',
      '.#...#..',
      '.#...#..',
      '###.###.',
    ]);
    // A space has no ink, so it takes half the face's width.
    expect(rasterize(' ', { style: { proportional: true } }).cols).toBe(4);
    expect(rasterize('MI', { style: { proportional: true } }).cols).toBe(6 + 4);
  });

  it('spans each letter, so a letter rasterized alone lines up inside its span', () => {
    for (const style of [{}, { reverse: true }, { proportional: true }]) {
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
    const at = placeText(b, 'MI', { style: { proportional: true } });
    const rank = rankOf({ by: 'letter' }, at);
    const dot = (x: number) => b.dots[x] as never;
    expect(rank(dot(at.left + 5))).toBe(0);
    expect(rank(dot(at.left + 6))).toBe(1);
    expect(rank(dot(at.left + 9))).toBe(1);
  });
});

describe('a face that does not fit', () => {
  const tall: Face = { name: 'tall', rows: 9, width: 5, glyph: () => Array(9).fill('#####') };

  it('is left out of the program, as a move without room is', () => {
    const b = board(80, 7);
    const staged = stageProgram(b, [
      { text: 'A', hex: 0, effect: 'hold', face: tall },
      { text: 'B', hex: 0, effect: 'hold', face: 'slim' },
    ]);
    expect(staged.map((s) => s.scene)).toEqual([1]);
  });

  it('warns when the effect is staged for it', () => {
    const at = placeText(board(80, 7), 'A', { face: tall });
    expect(stageEffect(EFFECTS.hold, at, 0).warnings).toContainEqual({
      text: "the tall face is 9 rows tall, taller than the sign's 7-row lines, so the scene is skipped",
    });
  });

  it('fits a board whose lines are as tall as it', () => {
    expect(
      stageProgram(board(80, 7), [{ text: 'A', hex: 0, effect: 'hold', face: 'wide' }]),
    ).toHaveLength(1);
  });
});
