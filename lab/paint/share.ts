import { FACE_NAMES, type FaceName, GRIDS, type GridName } from '@/index.js';
import { fromBase64url, toBase64url } from '../base64url.js';
import { type Layout, MAX_COLS, type Picture, type Stamp } from './model.js';

/** What a link or a saved file opens: a board, what's painted on it, and text not yet stamped down. */
export interface Linked {
  layout: Layout;
  picture: Picture;
  stamps: Stamp[];
}

const KIND = 'picture';

/** `linked` as plain data, its dots grouped by how they light: `[hex, level, "x,y x,y …"]`. */
function dataOf({ layout, picture, stamps }: Linked) {
  const groups = new Map<string, [number, number, string[]]>();
  for (const [at, d] of Object.entries(picture)) {
    const id = `${d.hex}/${d.level}`;
    const g = groups.get(id) ?? [d.hex, d.level, []];
    g[2].push(at);
    groups.set(id, g);
  }
  const dots = [...groups.values()].map(([hex, level, at]) => [hex, level, at.join(' ')]);
  return { blinken: KIND, ...layout, dots, ...(stamps.length ? { stamps } : {}) };
}

/** `linked` packed for the URL hash. */
export const encode = (linked: Linked): string =>
  toBase64url(new TextEncoder().encode(JSON.stringify(dataOf(linked))));

/** `linked` as a saved file's text. */
export const toJson = (linked: Linked): string => `${JSON.stringify(dataOf(linked), null, 2)}\n`;

const isWhole = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const whole = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) ? Math.min(Math.max(v, lo), hi) : fallback;
const real = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : fallback;

/** A stamp from untrusted data, or null when it has no text or id. */
export function stampOf(v: unknown): Stamp | null {
  const s = v as Partial<Stamp> | null;
  if (!s || typeof s.text !== 'string' || typeof s.id !== 'string') return null;
  const face: FaceName = s.face && FACE_NAMES.includes(s.face) ? s.face : 'standard';
  return {
    id: s.id,
    text: s.text,
    face,
    x: whole(s.x, -400, 400, 0),
    y: whole(s.y, -400, 400, 0),
    hex: typeof s.hex === 'number' ? s.hex : 0xffffff,
    level: real(s.level, 0, 1, 1),
  };
}

/** What `data` holds, or null when it is no picture; dots and stamps it can't read are skipped. */
function parse(data: unknown): Linked | null {
  const d = data as Record<string, unknown> | null;
  if (d?.blinken !== KIND || !isWhole(d.cols, 4, MAX_COLS) || !isWhole(d.rows, 4, 120)) return null;
  const grid = typeof d.grid === 'string' && Object.hasOwn(GRIDS, d.grid) ? d.grid : 'square';
  const picture: Picture = {};
  for (const g of Array.isArray(d.dots) ? d.dots : []) {
    if (!Array.isArray(g) || typeof g[2] !== 'string') continue;
    const [hex, level] = g;
    if (!isWhole(hex, 0, 0xffffff) || typeof level !== 'number' || !(level >= 0 && level <= 1))
      continue;
    for (const at of g[2].split(' ')) if (/^-?\d+,-?\d+$/.test(at)) picture[at] = { hex, level };
  }
  return {
    layout: { cols: d.cols, rows: d.rows, grid: grid as GridName },
    picture,
    stamps: (Array.isArray(d.stamps) ? d.stamps : []).flatMap((s) => stampOf(s) ?? []),
  };
}

/** The picture a URL hash holds, or null when it holds none. */
export function decode(hash: string): Linked | null {
  const text = hash.replace(/^#/, '');
  if (!text) return null;
  try {
    return parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fromBase64url(text))));
  } catch {
    return null;
  }
}

/** The picture a saved file's text holds, or null when it is no picture. */
export function fromJson(text: string): Linked | null {
  try {
    return parse(JSON.parse(text));
  } catch {
    return null;
  }
}
