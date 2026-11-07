import {
  type Backend,
  type Board,
  board,
  type Marquee,
  type Pass,
  type PassScene,
  SIZE,
} from '@/index.js';
import type { Choice } from '../backend.js';
import { gestureKey } from './gesture.js';
import { type Library, library as shared, shelved } from './library.js';
import { type Carried, carried, carrier } from './player.js';
import { defaultState } from './share.js';
import type { ComposeState } from './state.js';
import * as storage from './storage.js';
import { createUndo, type Undo } from './undo.js';

/** What the sign does after an edit: play again from a scene, or nothing. */
export type After = { replay: number | 'picked' } | null;

/** The composition a store opened with, and what the link it opened from left out. */
export type Opened = ReturnType<typeof storage.open>;

/** Where a store reads the effects designed on the effects page. */
export interface LibrarySource {
  get(): Library;
  subscribe(fn: () => void): () => unknown;
}

export interface ComposeStoreOptions {
  /**
   * Opens from the address's link or the draft, takes the link out of the address, and keeps the
   * draft and the backend in browser storage. Off, the store touches neither.
   */
  persist?: boolean;
  /** What a store that does not persist opens with: the default composition, else. */
  opened?: Partial<Opened>;
  /** The effects library; the one every lab page shares, else. */
  library?: LibrarySource;
  /** Where a hot reload keeps the store's state: a `live` there is taken up, else one is put there. */
  keep?: { live?: unknown };
}

interface Live extends Carried {
  opened: Opened;
  state: ComposeState;
  solo: boolean;
  /** The backend the sign is asked to draw with. */
  backend: Choice;
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

/** Every effect a scene can play: the composition's own copies, then the library's others. */
export const effectsOf = (s: ComposeState, shelf: Library): Library => ({ ...shelf, ...s.effects });

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
    const spec = shelved(shelf, name);
    if (!spec || JSON.stringify(spec) === JSON.stringify(s.effects[name])) continue;
    next.effects[name] = spec;
    changed = true;
  }
  return changed ? next : null;
}

const nothing = () => {};

/** What a store keeps in browser storage, or nothing for one that does not persist. */
const keeperOf = (persist: boolean) =>
  persist
    ? {
        save: storage.save,
        saveChoice: storage.saveChoice,
        hasPrevious: storage.hasPrevious,
        restorePrevious() {
          if (storage.restorePrevious()) location.reload();
        },
      }
    : { save: nothing, saveChoice: nothing, hasPrevious: () => false, restorePrevious: nothing };

function begin(persist: boolean, given: Partial<Opened> = {}): Live {
  let opened: Opened;
  if (persist) {
    // A link wins over the draft, then is taken out of the address so a reload keeps later edits.
    opened = storage.open(location.hash);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  } else opened = { state: defaultState(), dropped: [], unreadable: false, ...given };
  // Undo reads the state through this object, so it is made before the history that needs it.
  const l = {
    ...carried(),
    opened,
    state: opened.state,
    solo: false,
    backend: persist ? storage.loadChoice() : 'auto',
    listeners: new Set(),
  } as Live;
  l.undo = createUndo({
    get: () => l.state,
    set: (next) => {
      l.state = next;
    },
  });
  return l;
}

/** The board of a sign the marquee's default size, for while none is attached. */
const DEFAULT_BOARD = board(SIZE.cols, SIZE.rows);

/** A composition every panel edits, and what each edit tells the sign it plays on. */
export function createComposeStore({
  persist = false,
  opened: given,
  library = shared,
  keep,
}: ComposeStoreOptions = {}) {
  const kept = keeperOf(persist);
  const live = (keep?.live as Live | undefined) ?? begin(persist, given);
  if (keep) keep.live = live;
  kept.save(live.state);
  const carry = carrier(live);

  /** Plays the whole program again from scene `from`, so the pass always spans every scene. */
  const replay = (from: number) => {
    const { sign } = live;
    if (!sign) return;
    sign.setEffects(live.state.effects);
    live.held = false;
    sign.restart(0);
    if (live.solo || from <= 0) return;
    const at = sign.pass()?.scenes.find((s) => s.scene >= from);
    if (at) sign.seek(at.start);
  };
  const notify = () => {
    for (const l of live.listeners) l();
  };
  /** Shows an undo or redo: every listener, and the program from the picked scene. */
  const stepped = () => {
    notify();
    replay(pickedOf(live.state));
    kept.save(live.state);
  };

  const store = {
    opened: live.opened,
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
      if (after) replay(after.replay !== 'picked' ? after.replay : pickedOf(live.state));
      kept.save(live.state);
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
    /** The program the sign plays: the whole of it, or the picked scene alone. */
    playing() {
      const scene = live.state.program[pickedOf(live.state)];
      return live.solo && scene ? [scene] : live.state.program;
    },
    setSolo(on: boolean) {
      live.solo = on;
      replay(pickedOf(live.state));
    },
    restart: () => replay(pickedOf(live.state)),
    /** Where the sign's pass stands, or null with no sign or nothing playing. */
    pass: (): Pass | null => carry.pass(),
    /** Moves the sign's pass to `ms`, held there with `hold`. */
    seek: (ms: number, hold = false) => carry.seek(ms, hold),
    /** The program scene a scene of the pass plays: soloed, the pass is the picked scene alone. */
    sceneOf: (p: PassScene): number => (live.solo ? pickedOf(live.state) : p.scene),
    /** The rate the sign plays at, which a sign built later takes too. */
    rate: () => carry.rate(),
    setRate(rate: number) {
      carry.setRate(rate);
      notify();
    },
    /** The backend the sign is asked to draw with, which builds it again on a fresh canvas. */
    backend: (): Choice => live.backend ?? 'auto',
    setBackend(choice: Choice) {
      live.backend = choice;
      kept.saveChoice(choice);
      notify();
    },
    /** The sign the page drew, or null while there is none. */
    sign: () => live.sign,
    /** The board of the sign the page drew, or one the default size while there is none. */
    board: (): Board => live.sign?.board ?? DEFAULT_BOARD,
    /** The backend the sign actually draws with, null while there is no sign. */
    drawing: (): Backend | null => live.sign?.backend ?? null,
    /**
     * Hands the store the sign the page drew, or null when it is gone. A sign built to replace one
     * plays on from where the last one's pass stood, still held if it was.
     */
    attach(next: Marquee | null) {
      carry.attach(next);
      notify();
    },
    library,
    /** Sets the picked scene playing `name`, taking the library's copy into the composition. */
    playEffect(name: string): void {
      store.edit((s) => {
        const at = pickedOf(s);
        const scene = s.program[at];
        if (!scene) return;
        const spec = shelved(library.get(), name);
        if (spec) s.effects[name] = spec;
        // Tuning belongs to the effect it was set for.
        const { params: _, ...rest } = scene;
        s.program[at] = scene.effect === name ? scene : { ...rest, effect: name };
      });
    },
    /** Whether a draft a link replaced is kept. */
    hasPrevious: kept.hasPrevious,
    /** Swaps in the last draft a link replaced, reopening the page on it. */
    restorePrevious: kept.restorePrevious,
  };

  // An edit on the effects page, in this tab or another, reaches the composition as it lands. It is
  // the library's change, not the composition's, so it stays out of the composition's undo.
  library.subscribe(() => {
    const next = adopted(live.state, library.get());
    if (next) {
      live.state = next;
      kept.save(next);
      notify();
      replay(pickedOf(next));
    } else notify();
  });

  return store;
}

export type ComposeStore = ReturnType<typeof createComposeStore>;
