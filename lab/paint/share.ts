import { GRIDS, type GridName } from '@/index.js';
import { fromBase64url, toBase64url } from '../base64url.js';
import { type Layout, MAX_COLS, type Picture } from './model.js';

/** What a link opens: a board and what's painted on it. */
export interface Linked {
  layout: Layout;
  picture: Picture;
}

const KIND = 'picture';

/**
 * `linked` packed for the URL hash, as JSON with its dots grouped by how they light:
 * `[hex, level, "x,y x,y …"]`.
 */
export function encode({ layout, picture }: Linked): string {
  const groups = new Map<string, [number, number, string[]]>();
  for (const [at, d] of Object.entries(picture)) {
    const id = `${d.hex}/${d.level}`;
    const g = groups.get(id) ?? [d.hex, d.level, []];
    g[2].push(at);
    groups.set(id, g);
  }
  const dots = [...groups.values()].map(([hex, level, at]) => [hex, level, at.join(' ')]);
  const json = JSON.stringify({ bree: KIND, ...layout, dots });
  return toBase64url(new TextEncoder().encode(json));
}

const whole = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** The picture a URL hash holds, or null when it holds none; dots it can't read are skipped. */
export function decode(hash: string): Linked | null {
  const text = hash.replace(/^#/, '');
  if (!text) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fromBase64url(text)));
  } catch {
    return null;
  }
  if (data?.bree !== KIND || !whole(data.cols, 4, MAX_COLS) || !whole(data.rows, 4, 120))
    return null;
  const grid =
    typeof data.grid === 'string' && Object.hasOwn(GRIDS, data.grid) ? data.grid : 'square';
  const picture: Picture = {};
  for (const g of Array.isArray(data.dots) ? data.dots : []) {
    if (!Array.isArray(g) || typeof g[2] !== 'string') continue;
    const [hex, level] = g;
    if (!whole(hex, 0, 0xffffff) || typeof level !== 'number' || !(level >= 0 && level <= 1))
      continue;
    for (const at of g[2].split(' ')) if (/^-?\d+,-?\d+$/.test(at)) picture[at] = { hex, level };
  }
  return {
    layout: { cols: data.cols as number, rows: data.rows as number, grid: grid as GridName },
    picture,
  };
}
