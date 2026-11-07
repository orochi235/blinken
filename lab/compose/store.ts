import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { Backend, Board } from '@/index.js';
import type { Choice } from '../backend.js';
import { type ComposeStore, createComposeStore, effectsOf } from './create-store.js';
import type { Library } from './library.js';
import type { ComposeState } from './state.js';

export {
  type After,
  type ComposeStore,
  type ComposeStoreOptions,
  createComposeStore,
  effectsOf,
  type LibrarySource,
  pickedOf,
} from './create-store.js';

let page: ComposeStore | undefined;

/**
 * The page's composition, kept in browser storage, and kept across a hot reload so the sign stays
 * attached and undo keeps its scenes. Made on first use, so a module that only imports the panels
 * neither reads the address nor writes a draft.
 */
export const pageStore = (): ComposeStore =>
  (page ??= createComposeStore({ persist: true, keep: import.meta.hot?.data }));

const Store = createContext<ComposeStore | null>(null);

/** Gives the panels under it `store` in place of the page's. */
export const ComposeProvider = ({
  store,
  children,
}: {
  store: ComposeStore;
  children: ReactNode;
}) => createElement(Store.Provider, { value: store }, children);

/** The store the panels edit: the nearest provider's, else the page's. */
export const useComposeStore = (): ComposeStore => useContext(Store) ?? pageStore();

export function useCompose(): ComposeState {
  const s = useComposeStore();
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}

/** The board of the sign the page drew, which a new size replaces. */
export function useBoard(): Board {
  const s = useComposeStore();
  return useSyncExternalStore(s.subscribe, s.board, s.board);
}

/** The backend the sign is asked to draw with. */
export function useChoice(): Choice {
  const s = useComposeStore();
  return useSyncExternalStore(s.subscribe, s.backend, s.backend);
}

/** The backend the sign actually draws with, null while there is no sign. */
export function useDrawing(): Backend | null {
  const s = useComposeStore();
  return useSyncExternalStore(s.subscribe, s.drawing, s.drawing);
}

/** Every effect a scene can play, as `effectsOf` gives them, kept current. */
export function useEffects(): Library {
  const state = useCompose();
  const { library } = useComposeStore();
  const shelf = useSyncExternalStore(library.subscribe, library.get, library.get);
  return useMemo(() => effectsOf(state, shelf), [state, shelf]);
}
