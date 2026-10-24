import {
  board,
  FACES,
  type FaceName,
  MOVES,
  type NumberParam,
  rasterize,
  rowsToShow,
  type TextStyle,
} from '@/index.js';

/** What a face's row scrolls in while hovered: every letter of a word that tells faces apart. */
const SPECIMEN = 'HAMBURGEFONSTIV';
/** How long the scroll waits on each column, ms: the move's own default. */
const STEP_MS = (MOVES['scroll-across'].params.step as NumberParam).value;
/** Where the row's name rests: its left edge one column in. */
export const REST = 1;

type Look = { face: FaceName; style?: TextStyle };

/** Spaces in `look` added to `text` until it spans at least `cols` columns. */
const padTo = (text: string, look: Look, cols: number) => {
  let out = text;
  while (rasterize(out, look).cols < cols) out += ' ';
  return out;
};

/**
 * A face row's reel: its name, the specimen, and its name again, on one scroll across a sign
 * `cols` wide, in `style`. At `from` the first name rests with the specimen just off the right
 * edge; at `to` the second name rests in the same place with the specimen gone off the left, so the two frames
 * match and the reel loops between them without a seam.
 */
export function reelOf(name: FaceName, cols: number, style?: TextStyle) {
  const look: Look = { face: name, style };
  const lead = padTo(name, look, cols - REST);
  const tail = padTo(`${lead}${SPECIMEN}`, look, rasterize(`${lead}${SPECIMEN}`, look).cols + 2);
  const text = `${tail}${name}`;
  const at = board(cols, FACES[name].rows, false);
  const rows = Math.max(
    rowsToShow(at, rasterize(name, look)),
    rowsToShow(at, rasterize(SPECIMEN, look)),
  );
  const when = (offset: number) => restAt(cols, offset);
  return { text, rows, from: when(0), to: when(rasterize(tail, look).cols) };
}

/** When a scroll on a sign `cols` wide rests text that starts `offset` columns in. */
// The scroll's left edge stands at `cols - n` through the nth column's wait.
const restAt = (cols: number, offset: number) => (cols - REST + offset + 0.5) * STEP_MS;

/**
 * A way off the reel from `at` ms: the reel's text as far as the sign shows it then, and right
 * after it another copy of the name, which the scroll carries on in to rest by `end`.
 */
export function exitOf(
  name: FaceName,
  cols: number,
  style: TextStyle | undefined,
  text: string,
  at: number,
) {
  const look: Look = { face: name, style };
  // The sign's right edge, in the text's own columns.
  const right = Math.floor(at / STEP_MS);
  let kept = '';
  for (const ch of text) {
    if (rasterize(kept, look).cols >= right) break;
    kept += ch;
  }
  const lead = padTo(kept, look, right);
  return { text: `${lead}${name}`, end: restAt(cols, rasterize(lead, look).cols) };
}
