import { useSyncExternalStore } from 'react';
import {
  type Board,
  board,
  EFFECTS,
  type LayerName,
  type Marquee,
  type Pass,
  type PassStep,
  SIZE,
} from '@/index.js';
import { gestureKey } from './gesture.js';
import { type ComposeState, layerOf } from './state.js';
import { open, save } from './storage.js';
import { createUndo, type Undo } from './undo.js';

/** What the sign does after an edit: play again from a step, update one layer, or nothing. */
export type After = { replay: number | 'picked' } | { layer: LayerName } | { follow: true } | null;

interface Live {
  opened: ReturnType<typeof open>;
  state: ComposeState;
  solo: boolean;
  sign: Marquee | null;
  listeners: Set<() => void>;
  undo: Undo;
}

/** The step being edited, kept inside the program. */
export const pickedOf = (s: ComposeState): number =>
  Math.max(0, Math.min(s.editing.step ?? 0, s.program.length - 1));

const copy = (s: ComposeState): ComposeState => ({
  ...s,
  effects: { ...s.effects },
  program: [...s.program],
  layers: { ...s.layers },
  editing: { ...s.editing },
});

/** Opens the picked step's effect in the designer, yours or a built-in. */
function follow(s: ComposeState): void {
  const effect = s.program[pickedOf(s)]?.effect;
  s.editing.effect =
    typeof effect === 'string' &&
    (Object.hasOwn(s.effects, effect) || Object.hasOwn(EFFECTS, effect))
      ? effect
      : undefined;
}

/** Everything the store holds, kept across a hot reload so the sign stays attached and undo keeps its steps. */
const live: Live = import.meta.hot?.data.live ?? begin();
if (import.meta.hot) import.meta.hot.data.live = live;

function begin(): Live {
  // A link wins over the draft, then is taken out of the address so a reload keeps later edits.
  const opened = open(location.hash);
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  // Undo reads the state through this object, so it is made before the history that needs it.
  const l = { opened, state: opened.state, solo: false, sign: null, listeners: new Set() } as Live;
  l.undo = createUndo({
    get: () => l.state,
    set: (next) => {
      l.state = next;
    },
  });
  follow(l.state);
  save(l.state);
  return l;
}

export const opened = live.opened;

/** Plays the whole program again from step `from`, so the pass always spans every step. */
function replay(from: number): void {
  const { sign } = live;
  if (!sign) return;
  sign.setEffects(live.state.effects);
  sign.restart(0);
  if (live.solo || from <= 0) return;
  const at = sign.pass()?.steps.find((s) => s.step >= from);
  if (at) sign.seek(at.start);
}

function setLayers(): void {
  for (const [name, layer] of Object.entries(live.state.layers))
    live.sign?.setLayer(name, layer.on, layer.params);
}

const notify = () => {
  for (const l of live.listeners) l();
};

/** Shows an undo or redo: every listener, every layer, and the program from the picked step. */
function stepped(): void {
  notify();
  setLayers();
  replay(pickedOf(live.state));
  save(live.state);
}

/** The program the sign plays: the whole of it, or the picked step alone. */
export const playing = () => {
  const step = live.state.program[pickedOf(live.state)];
  return live.solo && step ? [step] : live.state.program;
};

/** The composition every panel edits, and what each edit tells the sign. */
export const compose = {
  get: () => live.state,
  subscribe(fn: () => void) {
    live.listeners.add(fn);
    return () => live.listeners.delete(fn);
  },
  /**
   * Applies `fn` to a copy of the state, which it may change in place, then tells the sign.
   * `follow` opens the picked step's effect and replays from it.
   */
  edit(fn: (s: ComposeState) => void, after: After = { replay: 'picked' }) {
    const before = live.state;
    const next = copy(before);
    fn(next);
    if (after && 'follow' in after) follow(next);
    live.state = next;
    live.undo.record(before, gestureKey());
    notify();
    if (after && 'layer' in after) {
      const layer = layerOf(live.state, after.layer);
      live.sign?.setLayer(after.layer, layer.on, layer.params);
    } else if (after) {
      replay('replay' in after && after.replay !== 'picked' ? after.replay : pickedOf(live.state));
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
  seek: (ms: number, hold = false) => live.sign?.seek(ms, { hold }),
  /** The program step a step of the pass plays: soloed, the pass is the picked step alone. */
  stepOf: (p: PassStep): number => (live.solo ? pickedOf(live.state) : p.step),
  /** Hands the store the sign the page drew, or null when it is gone. */
  attach(next: Marquee | null) {
    live.sign = next;
    setLayers();
    notify();
  },
};

/** The board of a sign the marquee's default size, for while none is attached. */
const DEFAULT_BOARD = board(SIZE.cols, SIZE.rows);
const boardNow = () => live.sign?.board ?? DEFAULT_BOARD;

/** The board of the sign the page drew, which a new size replaces. */
export const useBoard = (): Board => useSyncExternalStore(compose.subscribe, boardNow, boardNow);

export const useCompose = (): ComposeState =>
  useSyncExternalStore(compose.subscribe, compose.get, compose.get);
