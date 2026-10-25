import { type Face, type FaceName, faceOf } from './faces.js';

/** The sign's default height, and the body height of the drawn faces. */
export const ROWS = 7;

/**
 * How text is drawn besides its face. `outline` draws each letter hollow: the ring of dots
 * around it lit and the letter dark. `shadow` lays a dim copy of each letter one dot down and right, behind it. Each glyph, outline
 * and shadow included, is kerned by its shape: it slides left until its ink is a blank from the
 * ink before it in the same row and the rows either side, so no two letters touch, even at a
 * corner. `monospace` advances every glyph by its widest instead.
 */
export interface TextStyle {
  readonly monospace?: boolean;
  readonly outline?: boolean;
  readonly shadow?: boolean;
}

/** How brightly a shadow lights, against the letters' 1. */
export const SHADOW = 0.35;

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
  /**
   * Ghost rows at the top and bottom of `rows`: drawn, but not counted when lines are spaced. An
   * outline adds one at each, and a shadow one at the bottom.
   */
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
  /** How brightly the dot at column `x`, row `y` lights, 0 to 1; anything outside the text is 0. */
  level(x: number, y: number): number;
  /** Whether the dot at column `x`, row `y` lights at all. */
  lit(x: number, y: number): boolean;
  /**
   * The index of the letter whose span holds column `x`, or -1 outside them all. Given row `y`, a
   * lit dot is its own letter's where kerned spans overlap; elsewhere the later span has it.
   */
  letterAt(x: number, y?: number): number;
}

/** A glyph as the levels of its dots, a row each, every row `width` long. */
interface Glyph {
  readonly width: number;
  readonly cells: readonly (readonly number[])[];
}

const inked = (g: Glyph) => g.cells.some((r) => r.some((v) => v > 0));

/** A glyph's drawn columns: all of its face's width at fixed pitch, else those holding ink. */
function cut(face: Face, ch: string, monospace: boolean): Glyph {
  const rows = face.glyph(ch) ?? face.glyph(' ') ?? [];
  const ink = Array.from({ length: face.width }, (_, x) => rows.some((r) => r[x] === '#'));
  const blank = !ink.includes(true);
  const from = monospace || blank ? 0 : ink.indexOf(true);
  const width = monospace
    ? face.width
    : blank
      ? Math.ceil(face.width / 2)
      : ink.lastIndexOf(true) - from + 1;
  const cells = Array.from({ length: face.rows }, (_, y) =>
    Array.from({ length: width }, (_, x) => (rows[y]?.[from + x] === '#' ? 1 : 0)),
  );
  return { width, cells };
}

/** `g` grown by `left`, `right`, `top` and `bottom` blank dots, each cell from `at` of the old. */
function grow(
  g: Glyph,
  [top, right, bottom, left]: readonly number[],
  at: (v: (y: number, x: number) => number, y: number, x: number) => number,
): Glyph {
  const v = (y: number, x: number) => g.cells[y]?.[x] ?? 0;
  const width = g.width + (left as number) + (right as number);
  const rows = g.cells.length + (top as number) + (bottom as number);
  const cells = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: width }, (_, x) => at(v, y - (top as number), x - (left as number))),
  );
  return { width, cells };
}

/**
 * A glyph as `style` dresses it: outlined, then shadowed. A blank keeps its width, only taking the
 * rows the others gain.
 */
function dress(g: Glyph, style: TextStyle): Glyph {
  const blank = !inked(g);
  let out = g;
  if (style.outline)
    out = grow(out, blank ? [1, 0, 1, 0] : [1, 1, 1, 1], (v, y, x) => {
      if (v(y, x) > 0) return 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if (v(y + dy, x + dx) > 0) return 1;
      return 0;
    });
  if (style.shadow)
    out = grow(out, blank ? [0, 0, 1, 0] : [0, 1, 1, 0], (v, y, x) =>
      v(y, x) > 0 ? v(y, x) : v(y - 1, x - 1) > 0 ? SHADOW : 0,
    );
  return out;
}

/** Each glyph's first column: fixed pitch, or kerned against the ink of every glyph before it. */
function layout(glyphs: readonly Glyph[], rows: number, monospace: boolean): number[] {
  const xs: number[] = [];
  // The rightmost ink placed so far in each row; a space counts as ink in every row.
  const reach = new Array<number>(rows).fill(Number.NEGATIVE_INFINITY);
  let start = 0;
  let next = 0;
  for (const g of glyphs) {
    const ink = g.cells.map((r) => r.findIndex((v) => v > 0));
    const blank = ink.every((i) => i < 0);
    let x = next;
    if (!monospace && !blank) {
      // A blank to the ink before in the rows above and below too, so letters never touch corners.
      const near = (y: number) =>
        Math.max(...[y - 1, y, y + 1].map((r) => reach[r] ?? Number.NEGATIVE_INFINITY));
      const fits = ink.map((i, y) => (i < 0 ? Number.NEGATIVE_INFINITY : near(y) + 2 - i));
      x = Math.max(start, Math.min(next, Math.max(...fits)));
    }
    xs.push(x);
    g.cells.forEach((r, y) => {
      let right = blank ? g.width - 1 : -1;
      for (let u = g.width - 1; u >= 0 && right < 0; u--) if ((r[u] as number) > 0) right = u;
      if (right >= 0) reach[y] = Math.max(reach[y] as number, x + right);
    });
    start = x;
    next = Math.max(next, x + g.width + 1);
  }
  return xs;
}

export function rasterize(text: string, look: Look = {}): Bitmap {
  const face = faceOf(look.face);
  const style = look.style ?? {};
  const monospace = style.monospace ?? false;
  const glyphs = [...text.toUpperCase()].map((ch) => dress(cut(face, ch, monospace), style));
  const top = style.outline ? 1 : 0;
  const rows = face.rows + top + (style.outline ? 1 : 0) + (style.shadow ? 1 : 0);
  const xs = layout(glyphs, rows, monospace);
  const cols = glyphs.reduce((n, g, k) => Math.max(n, (xs[k] as number) + g.width + 1), 0);
  const levels = new Float32Array(cols * rows);
  const owner = new Int32Array(cols).fill(-1);
  const inkOwner = new Int32Array(cols * rows).fill(-1);
  const letters: Span[] = [];
  glyphs.forEach((g, k) => {
    const at = xs[k] as number;
    g.cells.forEach((r, y) => {
      r.forEach((v, x) => {
        const i = y * cols + at + x;
        // A letter stands in front of the shadow of the one before it.
        if (v > (levels[i] as number)) {
          levels[i] = v;
          inkOwner[i] = k;
        }
      });
    });
    const width = g.width + 1;
    letters.push({ x: at, width });
    owner.fill(k, at, at + width);
  });
  const level = (x: number, y: number) =>
    x >= 0 && x < cols && y >= 0 && y < rows ? (levels[y * cols + x] as number) : 0;
  return {
    cols,
    rows,
    above: (face.above ?? 0) + top,
    below: (face.below ?? 0) + rows - face.rows - top,
    letters,
    face,
    style,
    level,
    lit: (x, y) => level(x, y) > 0,
    letterAt: (x, y) => {
      if (x < 0 || x >= cols) return -1;
      const ink = y !== undefined && y >= 0 && y < rows ? (inkOwner[y * cols + x] as number) : -1;
      return ink >= 0 ? ink : (owner[x] as number);
    },
  };
}

export { CHARS, FACE_NAMES, FACES, type Face, type FaceName, faceOf } from './faces.js';
