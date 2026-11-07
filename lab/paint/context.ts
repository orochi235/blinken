import { createContext, useContext, useSyncExternalStore } from 'react';
import { type PaintStore, pagePaint } from './store.js';

const PaintContext = createContext<PaintStore | null>(null);

/** Gives the paint controls inside it `value` in place of the page's own store. */
export const PaintProvider = PaintContext.Provider;

/** The store the paint controls work on: a provider's, or the page's. */
export const usePaintStore = (): PaintStore => useContext(PaintContext) ?? pagePaint();

/** That store's state, following it. */
export function usePaint() {
  const store = usePaintStore();
  return useSyncExternalStore(store.subscribe, store.get);
}
