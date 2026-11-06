import { GRIDS } from '@/index.js';
import { type Dot, key, type Layout, type Picture } from './model.js';

const same = (a: Dot | undefined, b: Dot | undefined) =>
  a === b || (!!a && !!b && a.hex === b.hex && a.level === b.level);

/**
 * `picture` with the region around dot `[x, y]` set to `to`, or turned off when `to` is null: every
 * dot reached through neighbors lit the same as it, or unlit like it. Neighbors are the places
 * nearest on the board's grid: four on the square grid, six on hex, three on triangles.
 */
export function floodFill(
  picture: Picture,
  layout: Layout,
  [x, y]: [number, number],
  to: Dot | null,
): Picture {
  const { cols, rows } = layout;
  const on = (cx: number, cy: number) => cx >= 0 && cx < cols && cy >= 0 && cy < rows;
  const from = picture[key(x, y)];
  if (!on(x, y) || same(from, to ?? undefined)) return picture;

  const grid = GRIDS[layout.grid];
  const span = (dx: number, dy: number, cx: number, cy: number) => {
    const [ax, ay] = grid(cx, cy);
    const [bx, by] = grid(cx + dx, cy + dy);
    return Math.hypot(bx - ax, by - ay);
  };
  const near: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -2; dx <= 2; dx++) if (dx || dy) near.push([dx, dy]);
  // The nearest any place sits to another, measured from both parities so triangles count.
  const step = Math.min(...near.flatMap(([dx, dy]) => [span(dx, dy, 2, 2), span(dx, dy, 3, 2)]));

  const next = { ...picture };
  const seen = new Set([key(x, y)]);
  const queue: [number, number][] = [[x, y]];
  for (let at = queue.pop(); at; at = queue.pop()) {
    const [cx, cy] = at;
    if (to) next[key(cx, cy)] = to;
    else delete next[key(cx, cy)];
    for (const [dx, dy] of near) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = key(nx, ny);
      if (seen.has(k) || !on(nx, ny) || span(dx, dy, cx, cy) > step * 1.01) continue;
      seen.add(k);
      if (same(picture[k], from)) queue.push([nx, ny]);
    }
  }
  return next;
}
