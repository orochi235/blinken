import { type Face, type FaceName, faceOf } from './faces.js';

/** The sign's default height, and the body height of the drawn faces. */
export const ROWS = 7;

/**
 * How text is drawn besides its face. `reverse` lights the message's box and leaves the glyphs
 * dark. Each glyph is kerned by its shape: it slides left until, in every row they share, its ink is
 * a blank from the ink before it. `monospace` advances every glyph by the face's widest instead.
 */
export interface TextStyle {
  readonly reverse?: boolean;
  readonly monospace?: boolean;
}

/** A face and a style; a program scene is one. Default: the standard face, plain. */
export interface Look {
  readonly face?: FaceName | Face;
  readonly style?: TextStyle;
}

/** A run of columns. */
export interface Span {
  readonly x: number;
  readonly width: number;
}

/** Text laid out as lit dots, `cols` × `rows`; a glyph the face lacks is a blank. */
export interface Bitmap {
  readonly cols: number;
  /** Ghost rows at the top and bottom of `rows`: drawn, but not counted when lines are spaced. */
  readonly above: number;
  readonly below: number;
  readonly rows: number;
  /**
   * Each letter's columns, in order: its glyph and a blank beside it. One letter of the same look
   * rasterized alone draws the same dots at the same place in its own span. Kerned letters' spans
   * can overlap.
   */
  readonly letters: readonly Span[];
  readonly face: Face;
  readonly style: TextStyle;
  /** Whether the dot at column `x`, row `y` is lit; anything outside the text is dark. */
  lit(x: number, y: number): boolean;
  /**
   * The index of the letter whose span holds column `x`, or -1 outside them all. Given row `y`, a
   * lit dot is its own letter's where kerned spans overlap; elsewhere the later span has it.
   */
  letterAt(x: number, y?: number): number;
}

/** A glyph's dots and the columns of it that are drawn. */
function cut(face: Face, ch: string, monospace: boolean) {
  const rows = face.glyph(ch) ?? face.glyph(' ') ?? [];
  if (monospace) return { rows, from: 0, width: face.width };
  const inked = Array.from({ length: face.width }, (_, x) => rows.some((r) => r[x] === '#'));
  const from = inked.indexOf(true);
  if (from < 0) return { rows, from: 0, width: Math.ceil(face.width / 2) };
  return { rows, from, width: inked.lastIndexOf(true) - from + 1 };
}

type Cut = ReturnType<typeof cut>;

/** Each glyph's first column: fixed pitch, or kerned against the ink of every glyph before it. */
function layout(glyphs: readonly Cut[], rows: number, monospace: boolean): number[] {
  const xs: number[] = [];
  // The rightmost ink placed so far in each row; a space counts as ink in every row.
  const reach = new Array<number>(rows).fill(Number.NEGATIVE_INFINITY);
  let start = 0;
  let next = 0;
  for (const g of glyphs) {
    const ink = Array.from({ length: rows }, (_, y) => {
      const r = g.rows[y] ?? '';
      for (let x = 0; x < g.width; x++) if (r[g.from + x] === '#') return x;
      return -1;
    });
    let x = next;
    if (!monospace && ink.some((i) => i >= 0)) {
      const fits = ink.map((i, y) =>
        i < 0 ? Number.NEGATIVE_INFINITY : (reach[y] as number) + 2 - i,
      );
      x = Math.max(start, Math.min(next, Math.max(...fits)));
    }
    xs.push(x);
    for (let y = 0; y < rows; y++) {
      const r = g.rows[y] ?? '';
      let right = ink.every((i) => i < 0) ? g.width - 1 : -1;
      for (let u = g.width - 1; u >= 0 && right < 0; u--) if (r[g.from + u] === '#') right = u;
      if (right >= 0) reach[y] = Math.max(reach[y] as number, x + right);
    }
    start = x;
    next = Math.max(next, x + g.width + 1);
  }
  return xs;
}

export function rasterize(text: string, look: Look = {}): Bitmap {
  const face = faceOf(look.face);
  const style = look.style ?? {};
  const rows = face.rows;
  const glyphs = [...text.toUpperCase()].map((ch) => cut(face, ch, style.monospace ?? false));
  const xs = layout(glyphs, rows, style.monospace ?? false);
  // Reversed, a blank column leads so the first glyph has a lit edge before it as the last has after.
  const pad = style.reverse && glyphs.length > 0 ? 1 : 0;
  const plain = glyphs.reduce((n, g, k) => Math.max(n, (xs[k] as number) + g.width + 1), 0);
  const cols = plain + pad;
  const bits = new Uint8Array(cols * rows);
  const owner = new Int32Array(cols).fill(-1);
  const inkOwner = new Int32Array(cols * rows).fill(-1);
  const letters: Span[] = [];
  glyphs.forEach((g, k) => {
    const at = xs[k] as number;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < g.width; x++)
        if (g.rows[y]?.[g.from + x] === '#') {
          bits[y * cols + pad + at + x] = 1;
          inkOwner[y * cols + pad + at + x] = k;
        }
    // A reversed letter's span starts at the blank before it; the last also keeps the one after.
    const width = g.width + 1 + (pad && k === glyphs.length - 1 ? 1 : 0);
    letters.push({ x: at, width });
    owner.fill(k, at, at + width);
  });
  if (style.reverse) for (let i = 0; i < bits.length; i++) bits[i] = bits[i] ? 0 : 1;
  return {
    cols,
    rows,
    above: face.above ?? 0,
    below: face.below ?? 0,
    letters,
    face,
    style,
    lit: (x, y) => x >= 0 && x < cols && y >= 0 && y < rows && bits[y * cols + x] === 1,
    letterAt: (x, y) => {
      if (x < 0 || x >= cols) return -1;
      const ink = y !== undefined && y >= 0 && y < rows ? (inkOwner[y * cols + x] as number) : -1;
      return ink >= 0 ? ink : (owner[x] as number);
    },
  };
}

export { CHARS, FACE_NAMES, FACES, type Face, type FaceName, faceOf } from './faces.js';
