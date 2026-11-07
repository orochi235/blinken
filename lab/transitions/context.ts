import { createContext, useContext, useSyncExternalStore } from 'react';
import { pageTransitions, type TransitionsStore } from './store.js';

const TransitionsContext = createContext<TransitionsStore | null>(null);

/** Gives the transitions controls inside it `value` in place of the page's own store. */
export const TransitionsProvider = TransitionsContext.Provider;

/** The store the transitions controls work on: a provider's, or the page's. */
export const useTransitionsStore = (): TransitionsStore =>
  useContext(TransitionsContext) ?? pageTransitions();

/** That store's state, following it. */
export function useTransitions() {
  const store = useTransitionsStore();
  return useSyncExternalStore(store.subscribe, store.get);
}
