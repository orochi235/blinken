import { useSyncExternalStore } from 'react';
import {
  TRANSITIONS,
  type TransitionEasing,
  type TransitionMove,
  type TransitionName,
  type TransitionOrder,
  type TransitionRecipe,
  TYPES,
  type TypeName,
} from '@/index.js';

const KEY = 'blinken:transitions';
const DEPTH = 200;

export const MOVES: readonly TransitionMove[] = ['cut', 'fade', 'step', 'scramble', 'count'];
export const ORDERS: readonly TransitionOrder[] = ['left', 'right', 'center', 'edges', 'random'];
export const EASINGS: readonly TransitionEasing[] = ['linear', 'in', 'out', 'in-out'];
/** The types a stage can show: those that spell. */
export const STAGE_TYPES = (Object.keys(TYPES) as TypeName[]).filter(
  (t) => TYPES[t].spell && t !== 'half',
);
export const BUILT_INS = Object.keys(TRANSITIONS) as TransitionName[];

/** What the stage plays the open transition on. */
export interface Stage {
  type: TypeName;
  cells: number;
  from: string;
  to: string;
  color: string;
}

export interface State {
  /** Transitions made here, by name. */
  saved: TransitionRecipe[];
  /** The one being edited: a saved one by name, or a built-in, read only until changed. */
  open: string;
  stage: Stage;
}

const STAGE: Stage = {
  type: 'sixteen',
  cells: 8,
  from: 'ARRIVALS',
  to: 'DELAYED',
  color: '#4fd8ff',
};

const isBuiltIn = (name: string): name is TransitionName => Object.hasOwn(TRANSITIONS, name);
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : fallback;
const pick = <T extends string>(v: unknown, of: readonly T[], fallback: T): T =>
  of.includes(v as T) ? (v as T) : fallback;

/** A recipe read back from storage, its fields checked and defaults left out. */
function recipeOf(v: unknown): TransitionRecipe | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.name !== 'string' || r.name === '' || isBuiltIn(r.name)) return null;
  return {
    name: r.name,
    ms: num(r.ms, 0, 10_000, 400),
    move: pick(r.move, MOVES, 'fade'),
    ...(r.order === undefined ? {} : { order: pick(r.order, ORDERS, 'left') }),
    ...(r.spread === undefined ? {} : { spread: num(r.spread, 0, 1, 0) }),
    ...(r.easing === undefined ? {} : { easing: pick(r.easing, EASINGS, 'linear') }),
    ...(typeof r.through === 'string' ? { through: r.through } : {}),
    ...(r.rolls === undefined ? {} : { rolls: num(r.rolls, 1, 100, 10) }),
  };
}

function load(): State {
  let raw: Partial<State> = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<State>;
  } catch {}
  const saved = (Array.isArray(raw.saved) ? raw.saved : []).flatMap((r) => recipeOf(r) ?? []);
  const s = (raw.stage ?? {}) as Partial<Stage>;
  const open = str(raw.open, 'flap');
  return {
    saved,
    open: isBuiltIn(open) || saved.some((r) => r.name === open) ? open : 'flap',
    stage: {
      type: pick(s.type, STAGE_TYPES, STAGE.type),
      cells: num(s.cells, 1, 24, STAGE.cells),
      from: str(s.from, STAGE.from),
      to: str(s.to, STAGE.to),
      color: /^#[0-9a-f]{6}$/i.test(str(s.color, '')) ? (s.color as string) : STAGE.color,
    },
  };
}

let state = load();
let past: State[] = [];
let future: State[] = [];
/** What the last undo step was for, so a run of edits to one field is undone as one. */
let lastEdit: string | undefined;
const listeners = new Set<() => void>();

function commit(next: State, run?: string): void {
  if (run === undefined || run !== lastEdit) {
    past = [...past.slice(-(DEPTH - 1)), state];
    future = [];
  }
  lastEdit = run;
  set(next);
}

function set(next: State): void {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  for (const l of listeners) l();
}

/** A name no built-in or saved transition has, from `base`. */
function freeName(base: string, saved: readonly TransitionRecipe[]): string {
  const taken = (n: string) => isBuiltIn(n) || saved.some((r) => r.name === n);
  if (!taken(base)) return base;
  const stem = base.replace(/ \d+$/, '');
  for (let i = 2; ; i++) if (!taken(`${stem} ${i}`)) return `${stem} ${i}`;
}

/** The recipe a name opens: a saved one, or a built-in's. */
export function recipeNamed(name: string, saved = state.saved): TransitionRecipe {
  return (
    saved.find((r) => r.name === name) ??
    (isBuiltIn(name) ? TRANSITIONS[name].recipe : TRANSITIONS.fade.recipe)
  );
}

/** The transitions page's state, kept in local storage, with undo by edit. */
export const transitions = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  isBuiltIn,
  open(name: string) {
    if (name !== state.open) commit({ ...state, open: name });
  },
  /**
   * Changes the open recipe. A built-in can't change, so its first edit saves a copy under a new
   * name and opens that; `run` names an edit whose steps undo as one, such as a slider's drag.
   */
  edit(change: Partial<TransitionRecipe>, run?: string) {
    const was = recipeNamed(state.open);
    if (isBuiltIn(state.open)) {
      const name = freeName(`${state.open} copy`, state.saved);
      const copy = { ...was, ...change, name };
      commit({ ...state, saved: [...state.saved, copy], open: name });
      lastEdit = run;
      return;
    }
    let next = { ...was, ...change };
    if (change.name !== undefined && change.name !== was.name) {
      const name = change.name.trim();
      if (name === '') return;
      next = {
        ...next,
        name: freeName(
          name,
          state.saved.filter((r) => r.name !== was.name),
        ),
      };
    }
    commit(
      {
        ...state,
        open: next.name,
        saved: state.saved.map((r) => (r.name === was.name ? next : r)),
      },
      run,
    );
  },
  /** Saves a copy of the open transition and opens it. */
  duplicate() {
    const name = freeName(`${state.open} copy`, state.saved);
    commit({
      ...state,
      saved: [...state.saved, { ...recipeNamed(state.open), name }],
      open: name,
    });
  },
  /** Deletes the open transition, if it is one made here, and opens the next. */
  remove() {
    const at = state.saved.findIndex((r) => r.name === state.open);
    if (at < 0) return;
    const saved = state.saved.filter((_, i) => i !== at);
    commit({ ...state, saved, open: saved[Math.min(at, saved.length - 1)]?.name ?? 'flap' });
  },
  setStage(change: Partial<Stage>, run?: string) {
    commit({ ...state, stage: { ...state.stage, ...change } }, run);
  },
  canUndo: () => past.length > 0,
  canRedo: () => future.length > 0,
  undo() {
    const prev = past.at(-1);
    if (!prev) return;
    past = past.slice(0, -1);
    future = [...future, state];
    lastEdit = undefined;
    set(prev);
  },
  redo() {
    const next = future.at(-1);
    if (!next) return;
    future = future.slice(0, -1);
    past = [...past, state];
    lastEdit = undefined;
    set(next);
  },
};

export const useTransitions = () => useSyncExternalStore(transitions.subscribe, transitions.get);
