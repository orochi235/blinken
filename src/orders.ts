import { type Board, type Led, leftOf, type Subject } from './board.js';
import { ADVANCE, type Bitmap } from './font.js';
import { hash } from './hash.js';

export type OrderBy =
  | 'together'
  | 'column'
  | 'column-reverse'
  | 'center'
  | 'row'
  | 'letter'
  | 'random';

/** When, or at what phase, each dot of the sign does something: a rank per subject, spread by `lag`. */
export interface Order {
  readonly by: OrderBy;
  /** Delay per rank. Default 0. */
  readonly lag?: number;
  /** Which shuffle `random` makes. Default 1. */
  readonly seed?: number;
}

/** A message placed on a board. */
export interface Placed {
  readonly board: Board;
  readonly text: Bitmap;
  readonly left: number;
}

/** The message standing centered on the board. */
export const place = (board: Board, text: Bitmap): Placed => ({
  board,
  text,
  left: leftOf(board, text),
});

const shuffle = (cols: number, seed: number): readonly number[] => {
  const order = Array.from({ length: cols }, (_, x) => x).sort(
    (a, b) => hash(a, seed, cols) - hash(b, seed, cols) || a - b,
  );
  const ranks = new Array<number>(cols);
  order.forEach((x, rank) => {
    ranks[x] = rank;
  });
  return ranks;
};

/** The rank of a subject: an integer from 0, equal ranks acting together. */
export function rankOf(order: Order, at: Placed): (s: Subject) => number {
  const { cols } = at.board;
  const colOf = (s: Led) => Math.min(cols - 1, Math.max(0, Math.round(s.x)));
  const pick = (dot: (s: Led) => number) => (s: Subject) => {
    if (order.by === 'together') return 0;
    return s.kind === 'cell' ? s.i : dot(s);
  };
  switch (order.by) {
    case 'together':
      return pick(() => 0);
    case 'column':
      return pick(colOf);
    case 'column-reverse':
      return pick((s) => cols - 1 - colOf(s));
    case 'center':
      return pick((s) => Math.floor(Math.abs(colOf(s) - (cols - 1) / 2)));
    case 'row':
      return pick((s) => s.y);
    case 'letter': {
      const letters = Math.max(1, at.text.cols / ADVANCE);
      return pick((s) => Math.min(letters - 1, Math.max(0, Math.floor((s.x - at.left) / ADVANCE))));
    }
    case 'random': {
      const ranks = shuffle(cols, order.seed ?? 1);
      return pick((s) => ranks[colOf(s)] as number);
    }
  }
}

/** The delay of a subject: its rank times the lag. */
export function delayOf(order: Order, at: Placed): (s: Subject) => number {
  const rank = rankOf(order, at);
  const lag = order.lag ?? 0;
  return (s) => rank(s) * lag;
}

/** The largest delay over the board's dots. */
export function spanOf(order: Order, at: Placed): number {
  const delay = delayOf(order, at);
  return at.board.dots.reduce((m, d) => Math.max(m, delay(d)), 0);
}

/** The board's dots grouped by rank, lowest rank first, empty groups dropped. */
export function groupsOf(order: Order, at: Placed): readonly (readonly Led[])[] {
  const rank = rankOf(order, at);
  const groups = new Map<number, Led[]>();
  for (const dot of at.board.dots) {
    const r = rank(dot);
    const g = groups.get(r);
    if (g) g.push(dot);
    else groups.set(r, [dot]);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g);
}
