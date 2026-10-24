import { type Face, type FaceName, faceOf } from './faces.js';

/** How many rows a line of text takes on a board: every built-in face's height. */
export const ROWS = 7;

/**
 * How text is drawn besides its face. `reverse` lights the message's box and leaves the glyphs
 * dark; `proportional` advances each glyph by its own inked width and a blank instead of the
 * face's widest.
 */
export interface TextStyle {
  readonly reverse?: boolean;
  readonly proportional?: boolean;
}

/** A face and a style; a program step is one. Default: the standard face, plain. */
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
  readonly rows: number;
  /**
   * Each letter's columns, in order: its glyph and a blank beside it. One letter of the same look
   * rasterized alone draws the same dots at the same place in its own span.
   */
  readonly letters: readonly Span[];
  readonly face: Face;
  readonly style: TextStyle;
  /** Whether the dot at column `x`, row `y` is lit; anything outside the text is dark. */
  lit(x: number, y: number): boolean;
  /** The index of the letter whose span holds column `x`, or -1 outside them all. */
  letterAt(x: number): number;
}

/** A glyph's dots and the columns of it that are drawn. */
function cut(face: Face, ch: string, proportional: boolean) {
  const rows = face.glyph(ch) ?? face.glyph(' ') ?? [];
  if (!proportional) return { rows, from: 0, width: face.width };
  const inked = Array.from({ length: face.width }, (_, x) => rows.some((r) => r[x] === '#'));
  const from = inked.indexOf(true);
  if (from < 0) return { rows, from: 0, width: Math.ceil(face.width / 2) };
  return { rows, from, width: inked.lastIndexOf(true) - from + 1 };
}

export function rasterize(text: string, look: Look = {}): Bitmap {
  const face = faceOf(look.face);
  const style = look.style ?? {};
  const rows = face.rows;
  const glyphs = [...text.toUpperCase()].map((ch) => cut(face, ch, style.proportional ?? false));
  // Reversed, a blank column leads so the first glyph has a lit edge before it as the last has after.
  const pad = style.reverse && glyphs.length > 0 ? 1 : 0;
  const plain = glyphs.reduce((n, g) => n + g.width + 1, 0);
  const cols = plain + pad;
  const bits = new Uint8Array(cols * rows);
  const owner = new Int32Array(cols).fill(-1);
  const letters: Span[] = [];
  let at = 0;
  glyphs.forEach((g, k) => {
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < g.width; x++)
        if (g.rows[y]?.[g.from + x] === '#') bits[y * cols + pad + at + x] = 1;
    // A reversed letter's span starts at the blank before it; the last also keeps the one after.
    const width = g.width + 1 + (pad && k === glyphs.length - 1 ? 1 : 0);
    letters.push({ x: at, width });
    owner.fill(k, at, at + width);
    at += g.width + 1;
  });
  if (style.reverse) for (let i = 0; i < bits.length; i++) bits[i] = bits[i] ? 0 : 1;
  return {
    cols,
    rows,
    letters,
    face,
    style,
    lit: (x, y) => x >= 0 && x < cols && y >= 0 && y < rows && bits[y * cols + x] === 1,
    letterAt: (x) => (x >= 0 && x < cols ? (owner[x] as number) : -1),
  };
}

export { CHARS, FACE_NAMES, FACES, type Face, type FaceName, faceOf } from './faces.js';
