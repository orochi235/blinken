import { type Bitmap, type GridName, lookOn, rasterize } from '@/index.js';
import { type Dot, key, type Layout, type Stamp } from './model.js';

const bitmaps = new Map<string, Bitmap>();
/**
 * `s`'s text laid out in its face as `grid` shows it, kept so a drag doesn't lay it out again each
 * frame.
 */
function bitmapOf(s: Stamp, grid: GridName): Bitmap {
  const k = `${grid}\n${s.face}\n${s.text}`;
  let bm = bitmaps.get(k);
  if (!bm) {
    if (bitmaps.size > 200) bitmaps.clear();
    bm = rasterize(s.text, lookOn({ grid }, { face: s.face }));
    bitmaps.set(k, bm);
  }
  return bm;
}

/** Every dot `s` lights, at its place on the board and the level it lights at. */
export function stampDots(s: Stamp, layout: Layout): Record<string, Dot> {
  const bm = bitmapOf(s, layout.grid);
  const out: Record<string, Dot> = {};
  for (let y = 0; y < bm.rows; y++)
    for (let x = 0; x < bm.cols; x++) {
      const v = bm.level(x, y);
      const bx = s.x + x;
      const by = s.y + y;
      if (v <= 0 || bx < 0 || by < 0 || bx >= layout.cols || by >= layout.rows) continue;
      out[key(bx, by)] = { hex: s.hex, level: v * s.level };
    }
  return out;
}

/** The dots `s` spans on `grid`, lit or not: its top left and how many across and down. */
export function stampBox(
  s: Stamp,
  grid: GridName,
): { x: number; y: number; cols: number; rows: number } {
  const bm = bitmapOf(s, grid);
  return { x: s.x, y: s.y, cols: Math.max(bm.cols, 1), rows: Math.max(bm.rows, 1) };
}
