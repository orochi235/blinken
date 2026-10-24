import { useSyncExternalStore } from 'react';
import { EFFECTS, type LayerName, type Marquee, type Pass, type PassStep } from '@/index.js';
import { type ComposeState, layerOf } from './state.js';
import { open, save } from './storage.js';

/** What the sign does after an edit: play again from a step, update one layer, or nothing. */
export type After = { replay: number | 'picked' } | { layer: LayerName } | { follow: true } | null;

// A link wins over the draft, then is taken out of the address so a reload keeps later edits.
export const opened = open(location.hash);
if (location.hash) history.replaceState(null, '', location.pathname + location.search);

let state: ComposeState = opened.state;
let solo = false;
let sign: Marquee | null = null;
const listeners = new Set<() => void>();

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

/** Plays the whole program again from step `from`, so the pass always spans every step. */
function replay(from: number): void {
  if (!sign) return;
  sign.setEffects(state.effects);
  sign.restart(0);
  if (solo || from <= 0) return;
  const at = sign.pass()?.steps.find((s) => s.step >= from);
  if (at) sign.seek(at.start);
}

/** The program the sign plays: the whole of it, or the picked step alone. */
export const playing = () => {
  const step = state.program[pickedOf(state)];
  return solo && step ? [step] : state.program;
};

/** The composition every panel edits, and what each edit tells the sign. */
export const compose = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /**
   * Applies `fn` to a copy of the state, which it may change in place, then tells the sign.
   * `follow` opens the picked step's effect and replays from it.
   */
  edit(fn: (s: ComposeState) => void, after: After = { replay: 'picked' }) {
    const next = copy(state);
    fn(next);
    if (after && 'follow' in after) follow(next);
    state = next;
    for (const l of listeners) l();
    if (after && 'layer' in after) {
      const layer = layerOf(state, after.layer);
      sign?.setLayer(after.layer, layer.on, layer.params);
    } else if (after) {
      replay('replay' in after && after.replay !== 'picked' ? after.replay : pickedOf(state));
    }
    save(state);
  },
  setSolo(on: boolean) {
    solo = on;
    replay(pickedOf(state));
  },
  restart: () => replay(pickedOf(state)),
  /** Where the sign's pass stands, or null with no sign or nothing playing. */
  pass: (): Pass | null => sign?.pass() ?? null,
  /** Moves the sign's pass to `ms`, held there with `hold`. */
  seek: (ms: number, hold = false) => sign?.seek(ms, { hold }),
  /** The program step a step of the pass plays: soloed, the pass is the picked step alone. */
  stepOf: (p: PassStep): number => (solo ? pickedOf(state) : p.step),
  /** Hands the store the sign the page drew, or null when it is gone. */
  attach(next: Marquee | null) {
    sign = next;
    if (!next) return;
    for (const [name, layer] of Object.entries(state.layers))
      next.setLayer(name, layer.on, layer.params);
  },
};

follow(state);
save(state);

export const useCompose = (): ComposeState =>
  useSyncExternalStore(compose.subscribe, compose.get, compose.get);
