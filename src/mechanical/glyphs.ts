import type { CellStyle } from './style.js';

/** A box on the canvas, in device pixels. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A glyph that draws itself: an icon, a picture, anything a canvas can paint in its box. */
export interface DrawnGlyph {
  /** What a value names it by. */
  readonly name: string;
  draw(ctx: CanvasRenderingContext2D, box: Box, style: CellStyle): void;
}

/** One card of a flap or face of a reel: text drawn in the cell's font, or a glyph that draws itself. */
export type Glyph = string | DrawnGlyph;

/** A reel's or flap's glyphs in the order it turns through them; a string is one glyph a character. */
export type Glyphs = string | readonly Glyph[];

export const nameOf = (g: Glyph): string => (typeof g === 'string' ? g : g.name);

/** `glyphs` as a list, a string split into its characters. */
export const listOf = (glyphs: Glyphs): readonly Glyph[] =>
  typeof glyphs === 'string' ? [...glyphs] : glyphs;

/**
 * `value` as glyph names, one per cell: an array names them outright; a string or number is split
 * by the longest glyph name matching at each place, case-insensitively where that's all that
 * differs, skipping a character no glyph names.
 */
export function spellOut(
  value: string | number | readonly string[],
  names: readonly string[],
): string[] {
  if (Array.isArray(value)) return [...value];
  const text = String(value);
  const byLength = [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length);
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const hit =
      byLength.find((n) => text.startsWith(n, i)) ??
      byLength.find((n) => text.slice(i, i + n.length).toUpperCase() === n.toUpperCase());
    if (hit === undefined) {
      i += 1;
      continue;
    }
    out.push(hit);
    i += hit.length;
  }
  return out;
}

/** `names` fitted to `cells`, padded with `pad` on the side `align` leaves open, trimmed likewise. */
export function pack(
  names: readonly string[],
  cells: number,
  align: 'left' | 'right',
  pad: string,
): string[] {
  const kept =
    names.length > cells
      ? align === 'right'
        ? names.slice(-cells)
        : names.slice(0, cells)
      : names;
  const fill = Array.from({ length: cells - kept.length }, () => pad);
  return align === 'right' ? [...fill, ...kept] : [...kept, ...fill];
}

/** How many steps forward, wrapping, from glyph `a` to glyph `b` of `n`. */
export const stepsFrom = (a: number, b: number, n: number) =>
  n <= 0 ? 0 : (((b - a) % n) + n) % n;
