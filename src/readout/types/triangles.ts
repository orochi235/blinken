import { type Face, faceOf } from '../../faces.js';
import { triangleAt } from '../../grid.js';
import { type DisplayType, type SegLight, type Spelling, spellEncoder } from '../type.js';

/** A cell of `cols` × `rows` triangles of the tiling, each a light named `k,r`. */
function cellOf(cols: number, rows: number): DisplayType['cell'] {
  const lights: SegLight[] = [];
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++)
      lights.push({
        name: `${k},${r}`,
        shapes: [{ kind: 'tri', points: triangleAt(k, r).corners }],
      });
  const { corners } = triangleAt(cols - 1, rows - 1);
  return {
    width: Math.max(...corners.map(([x]) => x)),
    height: Math.max(...corners.map(([, y]) => y)),
    lights,
  };
}

/** A spelling lighting each cell's triangles where `face`'s glyph for its character is lit. */
const glyphSpelling = (face: Face): Spelling => ({
  tokens: (value) => [...String(value)],
  lights(ch) {
    const on = new Set<string>();
    for (const [r, row] of (face.glyph(ch.toUpperCase()) ?? []).entries())
      for (const [k, c] of [...row].entries()) if (c === '#') on.add(`${k},${r}`);
    return on;
  },
});

/** A type's coding from `glyphSpelling`. */
const glyphCoding = (face: Face) => {
  const spell = glyphSpelling(face);
  return { encode: spellEncoder(spell), spell };
};

/** Each cell a run of the tiling whose width is even, so the next cell carries on the tiling. */
const family = {
  selection: 'invert',
  gap: -0.5,
  ends: 'round',
  socket: 'segment',
  glow: 1,
  align: 'left',
} as const;

const doubled = faceOf('standard');

/**
 * blinken's 5 × 7 letters on the triangle tiling, each dot of a glyph lighting the two triangles at
 * its place, and a blank dot after it.
 */
export const triangles: DisplayType = {
  name: 'triangles',
  cell: cellOf(12, doubled.rows),
  ...family,
  ...glyphCoding({
    ...doubled,
    glyph: (ch) => doubled.glyph(ch)?.map((r) => [...r].map((c) => c + c).join('')),
  }),
};

/** Letters drawn at triangle resolution from 16-segment strokes, as the `strokes` face draws them. */
export const trianglesFine: DisplayType = {
  name: 'triangles-fine',
  cell: cellOf(faceOf('strokes').width, faceOf('strokes').rows),
  ...family,
  ...glyphCoding(faceOf('strokes')),
};
