import { describe, expect, it } from 'vitest';
import { board, type Cell } from '@/board.js';
import { rasterize } from '@/font.js';
import { delayOf, groupsOf, place, placeText, rankOf, spanOf } from '@/orders.js';

const at = place(board(20, 7), rasterize('AB'));
const dot = (x: number, y = 0) => {
  const found = at.board.dots.find((d) => d.x === x && d.y === y);
  if (!found) throw new Error(`no dot at ${x},${y}`);
  return found;
};

describe('orders', () => {
  it('ranks columns left to right and right to left', () => {
    expect(rankOf({ by: 'column' }, at)(dot(3))).toBe(3);
    expect(rankOf({ by: 'column-reverse' }, at)(dot(3))).toBe(16);
  });

  it('ranks by distance from the center', () => {
    const r = rankOf({ by: 'center' }, at);
    expect(r(dot(9))).toBe(0);
    expect(r(dot(10))).toBe(0);
    expect(r(dot(0))).toBe(9);
  });

  it('ranks by letter within the message', () => {
    const r = rankOf({ by: 'letter' }, at);
    expect(r(dot(at.left))).toBe(0);
    expect(r(dot(at.left + 6))).toBe(1);
    expect(r(dot(0))).toBe(0);
    expect(r(dot(19))).toBe(1);
  });

  it('makes random a permutation of columns, the same for a seed', () => {
    const ranks = (seed?: number) => {
      const r = rankOf({ by: 'random', seed }, at);
      return Array.from({ length: 20 }, (_, x) => r(dot(x)));
    };
    expect([...ranks(1)].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(ranks(1)).toEqual(ranks(1));
    expect(ranks(2)).not.toEqual(ranks(1));
  });

  it('delays by rank times lag and spans the largest delay', () => {
    const order = { by: 'column', lag: 10 } as const;
    expect(delayOf(order, at)(dot(4))).toBe(40);
    expect(spanOf(order, at)).toBe(190);
  });

  it('groups dots by rank in rank order', () => {
    const groups = groupsOf({ by: 'letter' }, at);
    expect(groups).toHaveLength(2);
    expect(groups.flat()).toHaveLength(20 * 7);
    expect(groupsOf({ by: 'together' }, at)).toHaveLength(1);
  });

  it('ranks border cells by index', () => {
    const [a, b, c] = at.board.cells as [Cell, Cell, Cell];
    for (const by of ['column', 'center', 'random'] as const) {
      const r = rankOf({ by }, at);
      expect([r(a), r(b), r(c)]).toEqual([0, 1, 2]);
    }
    expect(rankOf({ by: 'together' }, at)(c)).toBe(0);
  });

  it('places a typed message centered, labeled with its text', () => {
    const b = board(40, 7);
    const at = placeText(b, 'HI');
    expect(at).toMatchObject({ board: b, left: place(b, rasterize('HI')).left, label: 'HI' });
    expect(at.text.cols).toBe(rasterize('HI').cols);
  });
});
