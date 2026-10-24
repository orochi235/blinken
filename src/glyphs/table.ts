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
