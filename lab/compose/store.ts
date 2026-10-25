import { useMemo, useSyncExternalStore } from 'react';
import { type Board, board, type Marquee, type Pass, type PassScene, SIZE } from '@/index.js';
import { gestureKey } from './gesture.js';
import { type Library, library } from './library.js';
import type { ComposeState } from './state.js';
import { open, save } from './storage.js';
import { createUndo, type Undo } from './undo.js';

/** What the sign does after an edit: play again from a scene, or nothing. */
export type After = { replay: number | 'picked' } | null;

interface Live {
  opened: ReturnType<typeof open>;
  state: ComposeState;
  solo: boolean;
  /** The rate the sign plays at. */
  rate: number;
  sign: Marquee | null;
  /** Whether the scrubber holds the sign still, which a sign built to replace it keeps. */
  held: boolean;
  /** Where the last sign's pass stood when it was taken down, for the next one to play on from. */
  resume: number | undefined;
  listeners: Set<() => void>;
  undo: Undo;
}

/** The scene being edited, kept inside the program. */
export const pickedOf = (s: ComposeState): number =>
  Math.max(0, Math.min(s.editing.scene ?? 0, s.program.length - 1));

const copy = (s: ComposeState): ComposeState => ({
  ...s,
  effects: { ...s.effects },
  program: [...s.program],
  editing: { ...s.editing },
});

/** Everything the store holds, kept across a hot reload so the sign stays attached and undo keeps its scenes. */
const live: Live = import.meta.hot?.data.live ?? begin();
if (import.meta.hot) import.meta.hot.data.live = live;

function begin(): Live {
  // A link wins over the draft, then is taken out of the address so a reload keeps later edits.
  const opened = open(location.hash);
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  // Undo reads the state through this object, so it is made before the history that needs it.
  const l = {
    opened,
    state: opened.state,
    solo: false,
    rate: 1,
    sign: null,
    held: false,
    resume: undefined,
    listeners: new Set(),
  } as Live;
  l.undo = createUndo({
    get: () => l.state,
    set: (next) => {
      l.state = next;
    },
  });
  save(l.state);
  return l;
}

export const opened = live.opened;

/** Plays the whole program again from scene `from`, so the pass always spans every scene. */
function replay(from: number): void {
  const { sign } = live;
  if (!sign) return;
  sign.setEffects(live.state.effects);
  live.held = false;
  sign.restart(0);
  if (live.solo || from <= 0) return;
  const at = sign.pass()?.scenes.find((s) => s.scene >= from);
  if (at) sign.seek(at.start);
}

const notify = () => {
  for (const l of live.listeners) l();
};

/** Shows an undo or redo: every listener, and the program from the picked scene. */
function stepped(): void {
  notify();
  replay(pickedOf(live.state));
  save(live.state);
}

/** The program the sign plays: the whole of it, or the picked scene alone. */
export const playing = () => {
  const scene = live.state.program[pickedOf(live.state)];
  return live.solo && scene ? [scene] : live.state.program;
};

/** The composition every panel edits, and what each edit tells the sign. */
export const compose = {
  get: () => live.state,
  subscribe(fn: () => void) {
    live.listeners.add(fn);
    return () => live.listeners.delete(fn);
  },
  /** Applies `fn` to a copy of the state, which it may change in place, then tells the sign. */
  edit(fn: (s: ComposeState) => void, after: After = { replay: 'picked' }) {
    const before = live.state;
    const next = copy(before);
    fn(next);
    live.state = next;
    live.undo.record(before, gestureKey());
    notify();
    if (after) {
      replay(after.replay !== 'picked' ? after.replay : pickedOf(live.state));
    }
    save(live.state);
  },
  /** The composition's undo history; selection and the sign's hardware are not in it. */
  history: live.undo.history,
  undo() {
    live.undo.history.undo();
    stepped();
  },
  redo() {
    live.undo.history.redo();
    stepped();
  },
  setSolo(on: boolean) {
    live.solo = on;
    replay(pickedOf(live.state));
  },
  restart: () => replay(pickedOf(live.state)),
  /** Where the sign's pass stands, or null with no sign or nothing playing. */
  pass: (): Pass | null => live.sign?.pass() ?? null,
  /** Moves the sign's pass to `ms`, held there with `hold`. */
  seek(ms: number, hold = false) {
    if (!live.sign) return;
    live.held = hold;
    live.sign.seek(ms, { hold });
  },
  /** The program scene a scene of the pass plays: soloed, the pass is the picked scene alone. */
  sceneOf: (p: PassScene): number => (live.solo ? pickedOf(live.state) : p.scene),
  /** The rate the sign plays at, which a sign built later takes too. */
  rate: () => live.rate ?? 1,
  setRate(rate: number) {
    live.rate = rate;
    live.sign?.ramp(rate, 150);
    notify();
  },
  /** The sign the page drew, or null while there is none. */
  sign: () => live.sign,
  /**
   * Hands the store the sign the page drew, or null when it is gone. A sign built to replace one
   * plays on from where the last one's pass stood, still held if it was.
   */
  attach(next: Marquee | null) {
    if (!next) live.resume = live.sign?.pass()?.at;
    live.sign = next;
    if (next && live.rate !== 1) next.ramp(live.rate, 0);
    if (next && live.resume !== undefined) next.seek(live.resume, { hold: live.held });
    notify();
  },
};

/**
 * `s` with each effect its program plays brought up to the library's, or null when none differs.
 * A composition keeps its own copy of every effect it plays, so a link carries them and an effect
 * the library loses plays on; the library's edits reach it here.
 */
function adopted(s: ComposeState, shelf: Library): ComposeState | null {
  const next = copy(s);
  let changed = false;
  for (const scene of s.program) {
    const name = String(scene.effect);
    const spec = shelf[name];
    if (!spec || JSON.stringify(spec) === JSON.stringify(s.effects[name])) continue;
    next.effects[name] = spec;
    changed = true;
  }
  return changed ? next : null;
}

// An edit on the effects page, in this tab or another, reaches the composition as it lands. It is
// the library's change, not the composition's, so it stays out of the composition's undo.
library.subscribe(() => {
  const next = adopted(live.state, library.get());
  if (next) {
    live.state = next;
    save(next);
    notify();
    replay(pickedOf(next));
  } else notify();
});

/** Every effect a scene can play: the composition's own copies, then the library's others. */
export const effectsOf = (s: ComposeState, shelf: Library): Library => ({ ...shelf, ...s.effects });

/** Sets the picked scene playing `name`, taking the library's copy into the composition. */
export function playEffect(name: string): void {
  compose.edit((s) => {
    const at = pickedOf(s);
    const scene = s.program[at];
    if (!scene) return;
    const spec = library.get()[name];
    if (spec) s.effects[name] = spec;
    // Tuning belongs to the effect it was set for.
    const { params: _, ...rest } = scene;
    s.program[at] = scene.effect === name ? scene : { ...rest, effect: name };
  });
}

/** The board of a sign the marquee's default size, for while none is attached. */
const DEFAULT_BOARD = board(SIZE.cols, SIZE.rows);
const boardNow = () => live.sign?.board ?? DEFAULT_BOARD;

/** The board of the sign the page drew, which a new size replaces. */
export const useBoard = (): Board => useSyncExternalStore(compose.subscribe, boardNow, boardNow);

export const useCompose = (): ComposeState =>
  useSyncExternalStore(compose.subscribe, compose.get, compose.get);

/** Every effect a scene can play, as `effectsOf` gives them, kept current. */
export function useEffects(): Library {
  const state = useCompose();
  const shelf = useSyncExternalStore(library.subscribe, library.get, library.get);
  return useMemo(() => effectsOf(state, shelf), [state, shelf]);
}
