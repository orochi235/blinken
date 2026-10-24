import type { Face } from '../faces.js';

/** A face drawn from a table of glyphs, as tall and wide as its largest. */
export const tableFace = (
  name: string,
  about: string,
  table: Readonly<Record<string, readonly string[]>>,
): Face => {
  const all = Object.values(table);
  return {
    name,
    about,
    rows: Math.max(0, ...all.map((g) => g.length)),
    width: Math.max(0, ...all.flatMap((g) => g.map((row) => row.length))),
    glyph: (ch) => (Object.hasOwn(table, ch) ? table[ch] : undefined),
  };
};

/**
 * A 7-row face packed as hex: each glyph is `width` columns of two hex digits, bit 0 the top row,
 * one glyph after another in the order of `chars`.
 */
export const hexFace = (
  name: string,
  about: string,
  chars: string,
  width: number,
  data: string,
): Face => {
  const rows: Record<string, readonly string[]> = {};
  [...chars].forEach((ch, i) => {
    const cols = Array.from({ length: width }, (_, x) =>
      Number.parseInt(data.slice((i * width + x) * 2, (i * width + x) * 2 + 2), 16),
    );
    rows[ch] = Array.from({ length: 7 }, (_, y) =>
      cols.map((c) => ((c >> y) & 1 ? '#' : '.')).join(''),
    );
  });
  return tableFace(name, about, rows);
};
