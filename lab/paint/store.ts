import { useSyncExternalStore } from 'react';
import { GRIDS, type GridName } from '@/index.js';
import type { Layout, Picture } from './painter.js';

const KEY = 'bree:paint';
/** How many strokes undo reaches back; older ones drop off. */
const DEPTH = 100;

interface Saved {
  layout: Layout;
  picture: Picture;
}

const whole = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) ? Math.min(Math.max(v, lo), hi) : fallback;

function load(): Saved {
  let raw: Partial<Saved> = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
  } catch {}
  const l = (raw.layout ?? {}) as Partial<Layout>;
  const grid: GridName = l.grid && Object.hasOwn(GRIDS, l.grid) ? l.grid : 'hex';
  return {
    layout: { cols: whole(l.cols, 4, 200, 48), rows: whole(l.rows, 4, 120, 32), grid },
    picture: raw.picture && typeof raw.picture === 'object' ? raw.picture : {},
  };
}

let state = load();
let past: Picture[] = [];
let future: Picture[] = [];
const listeners = new Set<() => void>();

function commit(next: Saved): void {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  for (const l of listeners) l();
}

function remember(): void {
  past = [...past.slice(-(DEPTH - 1)), state.picture];
  future = [];
}

/** The page's layout and picture, kept in local storage, with undo by stroke. */
export const paint = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setLayout(layout: Layout) {
    commit({ ...state, layout });
  },
  setPicture(picture: Picture) {
    remember();
    commit({ ...state, picture });
  },
  clear() {
    if (Object.keys(state.picture).length === 0) return;
    paint.setPicture({});
  },
  canUndo: () => past.length > 0,
  canRedo: () => future.length > 0,
  undo() {
    const prev = past.at(-1);
    if (!prev) return;
    past = past.slice(0, -1);
    future = [...future, state.picture];
    commit({ ...state, picture: prev });
  },
  redo() {
    const next = future.at(-1);
    if (!next) return;
    future = future.slice(0, -1);
    past = [...past, state.picture];
    commit({ ...state, picture: next });
  },
};

export const usePaint = () => useSyncExternalStore(paint.subscribe, paint.get);
