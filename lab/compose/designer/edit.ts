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
import { freeLibraryName, shelved } from '../library.js';
import type { Designer } from './open.js';

/** Replaces the open effect with `fn` of it; a built-in is copied into the library first. */
export const editEffect = (designer: Designer, fn: (spec: EffectSpec) => EffectSpec) =>
  designer.change(() => {
    const { library } = designer;
    const n = designer.open();
    if (n === undefined) return;
    const own = shelved(library.get(), n);
    if (own) {
      library.put(fn(own));
      return;
    }
    // A built-in is never changed: the first edit makes a copy, which is then what is open.
    const built = builtinOf(n);
    if (!built) return;
    const name = freeLibraryName(`${n} copy`, library.get());
    library.put(fn({ ...built, name }));
    designer.setOpen(name);
  });

/** The built-in effect named `name`, if there is one. */
export const builtinOf = (name: string): EffectSpec | undefined =>
  Object.hasOwn(EFFECTS, name) ? EFFECTS[name as keyof typeof EFFECTS] : undefined;

/** Opens `name` in the designer, or nothing. */
export const openEffect = (designer: Designer, name: string | undefined) => designer.setOpen(name);

/** Starts a new effect in the library, standing still for two seconds, and opens it. */
export const newEffect = (designer: Designer) =>
  designer.change(() => {
    const { library } = designer;
    const name = freeLibraryName('effect', library.get());
    library.put({ name, active: [{ move: 'stand' }], hold: 2000 });
    designer.setOpen(name);
  });

/** Takes the open effect out of the library; a composition playing it keeps its own copy. */
export const deleteOpen = (designer: Designer) =>
  designer.change(() => {
    const { library } = designer;
    const n = designer.open();
    if (n === undefined || !Object.hasOwn(library.get(), n)) return;
    library.remove(n);
    designer.setOpen(undefined);
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

/**
 * Gives the open effect another name; a built-in is copied under it instead. Says false, changing
 * nothing, when the name is empty or taken. A composition playing it keeps its copy under the old.
 */
export function renameEffect(designer: Designer, from: string, to: string): boolean {
  const { library } = designer;
  if (to === from) return true;
  if (!to || to === '__proto__' || freeLibraryName(to, library.get()) !== to) return false;
  designer.change(() => {
    if (Object.hasOwn(library.get(), from)) library.rename(from, to);
    else {
      const built = builtinOf(from);
      if (!built) return;
      library.put({ ...built, name: to });
    }
    designer.setOpen(to);
  });
  return true;
}
