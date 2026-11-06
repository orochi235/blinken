import type { Align } from './type.js';

/** Where a readout's tokens land: each in a cell, numbered line by line, `line * cells + column`. */
export interface Flowed {
  /** Each token's cell, or -1 where it shows nowhere: cut off, a line break, or a space wrapped at. */
  readonly at: readonly number[];
  /** For each caret place, 0 to the token count, the cell a caret there stands at, or null. */
  readonly carets: readonly (number | null)[];
  /** How many tokens that should show were cut off for want of room. */
  readonly cut: number;
}

/**
 * Lays `tokens` out in `lines` rows of `cells`, each row aligned on its own: a right-aligned row
 * keeps its last tokens where it runs over, a left-aligned one its first. With more than one line,
 * `\n` starts a new row, and with `wrap` a word that won't fit moves to the next row whole, a
 * word longer than a row broken across rows, and the space it wrapped at dropped. One line is laid
 * out as it is typed, a `\n` a character like any other.
 */
export function flow(
  tokens: readonly string[],
  cells: number,
  lines: number,
  align: Align,
  wrap: boolean,
): Flowed {
  const n = tokens.length;
  const multi = lines > 1;
  /** Each token's row and place in it; a line break or dropped space sits just past the row's end. */
  const lineOf = new Array<number>(n).fill(0);
  const posOf = new Array<number>(n).fill(0);
  /** Tokens that show nowhere though they take no room: line breaks and spaces wrapped at. */
  const gone = new Array<boolean>(n).fill(false);
  const lengths: number[] = [0];
  let line = 0;
  const put = (t: number) => {
    lineOf[t] = line;
    posOf[t] = lengths[line] as number;
    lengths[line] = (lengths[line] as number) + 1;
  };
  const breakLine = () => {
    line++;
    lengths[line] = 0;
  };
  const isBreak = (t: number) => multi && tokens[t] === '\n';
  const isSpace = (t: number) => tokens[t] === ' ';
  for (let t = 0; t < n; ) {
    if (isBreak(t)) {
      lineOf[t] = line;
      posOf[t] = lengths[line] as number;
      gone[t] = true;
      breakLine();
      t++;
      continue;
    }
    if (!multi || !wrap) {
      put(t);
      t++;
      continue;
    }
    if (isSpace(t)) {
      if ((lengths[line] as number) < cells) put(t);
      else {
        lineOf[t] = line;
        posOf[t] = lengths[line] as number;
        gone[t] = true;
        breakLine();
      }
      t++;
      continue;
    }
    let end = t;
    while (end < n && !isSpace(end) && !isBreak(end)) end++;
    const word = end - t;
    if ((lengths[line] as number) + word > cells && (lengths[line] as number) > 0 && word <= cells)
      breakLine();
    for (let k = t; k < end; k++) {
      if ((lengths[line] as number) >= cells) breakLine();
      put(k);
    }
    t = end;
  }
  const shiftOf = (l: number) => (align === 'right' ? cells - (lengths[l] ?? 0) : 0);
  const cellOf = (l: number, c: number) => (l < lines && c >= 0 && c < cells ? l * cells + c : -1);
  const at = tokens.map((_, t) =>
    gone[t] ? -1 : cellOf(lineOf[t] as number, shiftOf(lineOf[t] as number) + (posOf[t] as number)),
  );
  const cut = at.filter((k, t) => k < 0 && !gone[t]).length;
  const clamp = (l: number, c: number) =>
    l < lines && cells > 0 ? l * cells + Math.min(cells - 1, Math.max(0, c)) : null;
  const carets = Array.from({ length: n + 1 }, (_, p) => {
    if (p < n)
      return clamp(lineOf[p] as number, shiftOf(lineOf[p] as number) + (posOf[p] as number));
    if (n === 0) return clamp(0, shiftOf(0));
    const t = n - 1;
    if (isBreak(t)) return clamp((lineOf[t] as number) + 1, shiftOf((lineOf[t] as number) + 1));
    return clamp(lineOf[t] as number, shiftOf(lineOf[t] as number) + (posOf[t] as number) + 1);
  });
  return { at, carets, cut };
}
