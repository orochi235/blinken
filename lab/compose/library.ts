import { createContext, useContext, useSyncExternalStore } from 'react';
import { EFFECTS, type EffectSpec } from '@/index.js';
import { effectOf, entriesOf, isObj } from './readers.js';

/** The browser-storage key the effects library is kept under, which every lab page reads. */
export const LIBRARY = 'blinken-effects-library';

/** The effects designed on the effects page, by name: what compose offers beside the built-ins. */
export type Library = Readonly<Record<string, EffectSpec>>;

/** The library's effect `name`: its own, never one an object inherits, such as `toString`. */
export const shelved = (shelf: Library, name: string): EffectSpec | undefined =>
  Object.hasOwn(shelf, name) ? shelf[name] : undefined;

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
  `${JSON.stringify({ blinken: 'effects', version: 1, effects }, null, 2)}\n`;

/** Where a library keeps its effects between visits, and hears another page's writes to them. */
export interface LibraryStorage {
  read(): Library;
  write(next: Library): void;
  watch?(fn: () => void): void;
}

/** This browser's storage, which every lab page reads and writes; whatever fails to read is left out. */
const browserStorage: LibraryStorage = {
  read() {
    try {
      const raw = localStorage.getItem(LIBRARY);
      return raw ? parseLibrary(raw).effects : {};
    } catch {
      return {};
    }
  },
  write(next) {
    try {
      localStorage.setItem(LIBRARY, libraryJson(next));
    } catch {}
  },
  // Another page's write arrives as a storage event, so both pages see one library.
  watch(fn) {
    if (typeof window !== 'undefined')
      window.addEventListener('storage', (e) => {
        if (e.key === LIBRARY) fn();
      });
  },
};

/** A name nothing in `taken` or the built-ins holds: `base`, else `base 2`, `base 3`, … */
export function freeLibraryName(base: string, taken: Library = library.get()): string {
  const used = (n: string) => Object.hasOwn(taken, n) || Object.hasOwn(EFFECTS, n);
  if (!used(base)) return base;
  for (let n = 2; ; n++) if (!used(`${base} ${n}`)) return `${base} ${n}`;
}

export type EffectsLibrary = ReturnType<typeof createLibrary>;

/** An effects library kept in `storage`, or with none, held in memory starting from `effects`. */
export function createLibrary({
  storage,
  effects = {},
}: {
  storage?: LibraryStorage;
  effects?: Library;
} = {}) {
  const listeners = new Set<() => void>();
  let shelf: Library = storage ? storage.read() : effects;
  const notify = () => {
    for (const l of listeners) l();
  };
  const write = (next: Library) => {
    shelf = next;
    storage?.write(next);
    notify();
  };
  storage?.watch?.(() => {
    shelf = storage.read();
    notify();
  });
  return {
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
      if (
        !to ||
        to === '__proto__' ||
        freeLibraryName(to, shelf) !== to ||
        !Object.hasOwn(shelf, from)
      )
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
}

/** The effects library every lab page shares, kept in this browser. */
export const library = createLibrary({ storage: browserStorage });

/** The library the components under it edit: the page's own unless a provider gives another. */
export const LibraryContext = createContext<EffectsLibrary>(library);

export const useLibraryStore = (): EffectsLibrary => useContext(LibraryContext);

export function useLibrary(): Library {
  const store = useLibraryStore();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
