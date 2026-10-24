import {
  EFFECTS,
  type EffectSpec,
  MODULATORS,
  MOVES,
  type ModulatorName,
  type MoveName,
  type Piece,
  type Slot,
} from '@/index.js';
import { type ComposeState, freeName } from '../state.js';
import { compose, pickedOf } from '../store.js';

/** The picked step plays whatever the designer has open, so an edit there is heard at once. */
function playOpen(s: ComposeState): void {
  const i = pickedOf(s);
  const step = s.program[i];
  const open = s.editing.effect;
  if (step && open !== undefined) s.program[i] = { ...step, effect: open };
}

/** Changes the state from the designer, then plays the picked step on the open effect. */
export const designerEdit = (fn: (s: ComposeState) => void) =>
  compose.edit((s) => {
    fn(s);
    playOpen(s);
  });

/** Replaces the open effect with `fn` of it. */
export const editEffect = (fn: (spec: EffectSpec) => EffectSpec) =>
  designerEdit((s) => {
    const n = s.editing.effect;
    if (n === undefined) return;
    const own = s.effects[n];
    if (own) {
      s.effects[n] = fn(own);
      return;
    }
    // A built-in is never changed: the first edit makes a copy, which the picked step then plays.
    const built = builtinOf(n);
    if (!built) return;
    const name = freeName(s, `${n} copy`);
    s.effects[name] = fn({ ...built, name });
    s.editing.effect = name;
  });

/** The built-in effect named `name`, if there is one. */
export const builtinOf = (name: string): EffectSpec | undefined =>
  Object.hasOwn(EFFECTS, name) ? EFFECTS[name as keyof typeof EFFECTS] : undefined;

/** Opens `name` in the designer, or nothing. */
export const openEffect = (name: string | undefined) =>
  designerEdit((s) => {
    s.editing.effect = name;
  });

const MOD = 'mod:';

/** The pieces a slot may hold, as Select options: its own moves, then every modulator. */
export const pieceOptions = (slot: Slot) => [
  {
    title: 'moves',
    options: (Object.keys(MOVES) as MoveName[])
      .filter((name) => MOVES[name].slot === slot)
      .map((name) => ({ value: name, label: name })),
  },
  {
    title: 'modulators',
    options: (Object.keys(MODULATORS) as ModulatorName[]).map((name) => ({
      value: MOD + name,
      label: name,
    })),
  },
];

/** The Select key naming a piece. */
export const keyOf = (piece: Piece) => ('mod' in piece ? MOD + piece.mod : piece.move);

/** The fresh piece a Select key names. */
export const pieceOf = (key: string): Piece =>
  key.startsWith(MOD) ? { mod: key.slice(MOD.length) as ModulatorName } : { move: key as MoveName };
