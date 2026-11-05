import { useSyncExternalStore } from 'react';
import { FACE_NAMES, type FaceName, GRIDS, type GridName } from '@/index.js';
import {
  type Dot,
  LAMPS,
  type LampSettings,
  type Layout,
  MAX_COLS,
  type Picture,
  type Stamp,
} from './model.js';
import { decode, type Linked } from './share.js';

const KEY = 'bree:paint';
/** How many strokes undo reaches back; older ones drop off. */
const DEPTH = 100;
/** Version 2 lights each dot at a level, and moved every board onto the square grid. */
const VERSION = 2;

interface Saved {
  v: number;
  layout: Layout;
  picture: Picture;
  stamps: Stamp[];
  lamps: LampSettings;
}

/** What undo walks back through. */
interface Drawing {
  picture: Picture;
  stamps: Stamp[];
}

const whole = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) ? Math.min(Math.max(v, lo), hi) : fallback;
const real = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : fallback;

function dotOf(v: unknown): Dot | null {
  if (typeof v === 'number') return { hex: v, level: 1 };
  if (v && typeof v === 'object' && typeof (v as Dot).hex === 'number')
    return { hex: (v as Dot).hex, level: real((v as Dot).level, 0, 1, 1) };
  return null;
}

function stampOf(v: unknown): Stamp | null {
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

function load(): Saved {
  let raw: Partial<Saved> = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
  } catch {}
  const l = (raw.layout ?? {}) as Partial<Layout>;
  const old = (raw.v ?? 1) < VERSION;
  const grid: GridName = !old && l.grid && Object.hasOwn(GRIDS, l.grid) ? l.grid : 'square';
  const picture: Picture = {};
  for (const [k, v] of Object.entries(raw.picture ?? {})) {
    const d = dotOf(v);
    if (d) picture[k] = d;
  }
  const m = (raw.lamps ?? {}) as Partial<LampSettings>;
  return {
    v: VERSION,
    layout: { cols: whole(l.cols, 4, MAX_COLS, 48), rows: whole(l.rows, 4, 120, 32), grid },
    picture,
    stamps: (Array.isArray(raw.stamps) ? raw.stamps : []).flatMap((s) => stampOf(s) ?? []),
    lamps: {
      size: real(m.size, 2, 60, LAMPS.size),
      gap: real(m.gap, 0, 60, LAMPS.gap),
      fit: typeof m.fit === 'boolean' ? m.fit : LAMPS.fit,
      brightness: real(m.brightness, 0, 3, LAMPS.brightness),
      glow: real(m.glow, 0, 4, LAMPS.glow),
    },
  };
}

let state = load();
/** The stamp the text tool has picked up; not saved, and not undone. */
let picked: string | null = null;
let past: Drawing[] = [];
let future: Drawing[] = [];
/** What the last undo step was for, so a run of edits to one thing is undone as one. */
let lastEdit: string | undefined;
const listeners = new Set<() => void>();
let snapshot: Saved & { picked: string | null } = { ...state, picked };

function commit(next: Saved): void {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  emit();
}

function emit(): void {
  snapshot = { ...state, picked };
  for (const l of listeners) l();
}

const drawing = (): Drawing => ({ picture: state.picture, stamps: state.stamps });

/** Saves the drawing as an undo step, unless it continues the edit `run` names. */
function remember(run?: string): void {
  if (run === undefined || run !== lastEdit) {
    past = [...past.slice(-(DEPTH - 1)), drawing()];
    future = [];
  }
  lastEdit = run;
}

function restore(d: Drawing): void {
  lastEdit = undefined;
  if (picked && !d.stamps.some((s) => s.id === picked)) picked = null;
  commit({ ...state, ...d });
}

/** The page's layout, picture, stamps and lamps, kept in local storage, with undo by stroke. */
export const paint = {
  get: () => snapshot,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setLayout(layout: Layout) {
    commit({ ...state, layout });
  },
  setLamps(lamps: LampSettings) {
    commit({ ...state, lamps });
  },
  setPicture(picture: Picture) {
    remember();
    commit({ ...state, picture });
  },
  setStamps(stamps: Stamp[], run?: string) {
    remember(run);
    commit({ ...state, stamps });
  },
  addStamp(stamp: Omit<Stamp, 'id'>) {
    const id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    picked = id;
    paint.setStamps([...state.stamps, { ...stamp, id }]);
  },
  /** Changes the picked stamp; a run of changes to it undoes as one. */
  editPicked(change: Partial<Omit<Stamp, 'id'>>) {
    if (!picked) return;
    const id = picked;
    paint.setStamps(
      state.stamps.map((s) => (s.id === id ? { ...s, ...change } : s)),
      `edit ${id}`,
    );
  },
  removePicked() {
    if (!picked) return;
    const id = picked;
    picked = null;
    paint.setStamps(state.stamps.filter((s) => s.id !== id));
  },
  /** Lays the picked stamp's dots into the picture, where painting reaches them. */
  stampDown(dots: Picture) {
    if (!picked) return;
    const id = picked;
    picked = null;
    remember();
    commit({
      ...state,
      picture: { ...state.picture, ...dots },
      stamps: state.stamps.filter((s) => s.id !== id),
    });
  },
  pick(id: string | null) {
    picked = id;
    lastEdit = undefined;
    emit();
  },
  /** Replaces the board and drawing with `linked`; undo brings the drawing back. */
  open(linked: Linked) {
    picked = null;
    remember();
    commit({ ...state, layout: linked.layout, picture: linked.picture, stamps: [] });
  },
  clear() {
    if (Object.keys(state.picture).length === 0 && state.stamps.length === 0) return;
    picked = null;
    remember();
    commit({ ...state, picture: {}, stamps: [] });
  },
  canUndo: () => past.length > 0,
  canRedo: () => future.length > 0,
  undo() {
    const prev = past.at(-1);
    if (!prev) return;
    past = past.slice(0, -1);
    future = [...future, drawing()];
    restore(prev);
  },
  redo() {
    const next = future.at(-1);
    if (!next) return;
    future = future.slice(0, -1);
    past = [...past, drawing()];
    restore(next);
  },
};

export const usePaint = () => useSyncExternalStore(paint.subscribe, paint.get);

const linked = decode(location.hash);
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
if (linked) paint.open(linked);
