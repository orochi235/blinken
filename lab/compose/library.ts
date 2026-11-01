import { useSyncExternalStore } from 'react';
import { EFFECTS, type EffectSpec } from '@/index.js';
import { effectOf, entriesOf, isObj } from './readers.js';

/** The browser-storage key the effects library is kept under, which every lab page reads. */
export const LIBRARY = 'bree-effects-library';

/** The effects designed on the effects page, by name: what compose offers beside the built-ins. */
export type Library = Readonly<Record<string, EffectSpec>>;

/** The library's effect `name`: its own, never one an object inherits, such as `toString`. */
export const shelved = (shelf: Library, name: string): EffectSpec | undefined =>
  Object.hasOwn(shelf, name) ? shelf[name] : undefined;

const listeners = new Set<() => void>();
let shelf: Library = read();

/** The library as storage holds it, each effect checked as a link's is; whatever fails is left out. */
function read(): Library {
  try {
    const raw = localStorage.getItem(LIBRARY);
    return raw ? parseLibrary(raw).effects : {};
  } catch {
    return {};
  }
}

/** Effects read from untrusted JSON, with what couldn't be used named in `dropped`. */
export function parseLibrary(json: string): { effects: Library; dropped: string[]; read: boolean } {
  const dropped: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { effects: {}, dropped, read: false };
  }
  if (!isObj(data) || !isObj(data.effects)) return { effects: {}, dropped, read: false };
  const effects: Record<string, EffectSpec> = {};
  for (const [name, v] of entriesOf(data.effects, 'the effects', dropped)) {
    const spec = effectOf(name, v, dropped);
    if (spec) effects[name] = { ...spec, name };
  }
  return { effects, dropped, read: true };
}

/** Effects as the JSON a library file holds. */
export const libraryJson = (effects: Library): string =>
  `${JSON.stringify({ bree: 'effects', version: 1, effects }, null, 2)}\n`;

const notify = () => {
  for (const l of listeners) l();
};

function write(next: Library): void {
  shelf = next;
  try {
    localStorage.setItem(LIBRARY, libraryJson(next));
  } catch {}
  notify();
}

// Another page's write arrives as a storage event, so both pages see one library.
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== LIBRARY) return;
    shelf = read();
    notify();
  });

/** A name nothing in the library or the built-ins holds: `base`, else `base 2`, `base 3`, … */
export function freeLibraryName(base: string, taken: Library = shelf): string {
  const used = (n: string) => Object.hasOwn(taken, n) || Object.hasOwn(EFFECTS, n);
  if (!used(base)) return base;
  for (let n = 2; ; n++) if (!used(`${base} ${n}`)) return `${base} ${n}`;
}

/** The effects library every lab page shares, kept in this browser. */
export const library = {
  get: (): Library => shelf,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** Keeps `spec` under its name, in place of any effect by that name. */
  put(spec: EffectSpec) {
    write({ ...shelf, [spec.name]: spec });
  },
  remove(name: string) {
    const { [name]: _, ...rest } = shelf;
    write(rest);
  },
  /** Gives an effect another name; false, changing nothing, when that name is empty or taken. */
  rename(from: string, to: string): boolean {
    if (to === from) return true;
    if (!to || to === '__proto__' || freeLibraryName(to) !== to || !Object.hasOwn(shelf, from))
      return false;
    const { [from]: spec, ...rest } = shelf;
    write({ ...rest, [to]: { ...(spec as EffectSpec), name: to } });
    return true;
  },
  /** Puts the whole library back as `next`, for undo. */
  replace(next: Library) {
    write(next);
  },
  /**
   * Adds `incoming` to the library: one the library holds the same of changes nothing, and one
   * whose name is taken by a different effect comes in under a free name. Says what it was named.
   */
  merge(incoming: Library): Record<string, string> {
    const next: Record<string, EffectSpec> = { ...shelf };
    const named: Record<string, string> = {};
    for (const [name, spec] of Object.entries(incoming)) {
      const same = next[name] && JSON.stringify(next[name]) === JSON.stringify(spec);
      const to = same ? name : freeLibraryName(name, next);
      next[to] = { ...spec, name: to };
      named[name] = to;
    }
    write(next);
    return named;
  },
};

export const useLibrary = (): Library =>
  useSyncExternalStore(library.subscribe, library.get, library.get);
