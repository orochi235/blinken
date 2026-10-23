import { decode, defaultState, encode } from './share.js';
import type { ComposeState } from './state.js';

/** The browser-storage key the current draft is kept under. */
export const DRAFT = 'bree-compose-draft';
/** Where the draft a link replaced is kept, so opening a link never loses one. */
export const PREVIOUS = 'bree-compose-draft-previous';

/** Keeps the draft in browser storage; without storage it is simply not kept. */
export function save(state: ComposeState): void {
  try {
    localStorage.setItem(DRAFT, encode(state));
  } catch {}
}

const kept = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** The draft kept in browser storage, or null without one. */
export function load(): ComposeState | null {
  const draft = kept(DRAFT);
  const d = draft ? decode(draft) : null;
  return d?.read ? d.state : null;
}

/**
 * The composition a page opens with: a readable link's, after moving any different draft aside to
 * PREVIOUS; else the draft; else the default. `unreadable` says a link was there but read as none.
 */
export function open(hash: string): {
  state: ComposeState;
  dropped: string[];
  unreadable: boolean;
} {
  const linked = hash.replace(/^#/, '') ? decode(hash) : null;
  if (!linked?.read)
    return { state: load() ?? defaultState(), dropped: [], unreadable: linked !== null };
  const draft = kept(DRAFT);
  try {
    if (draft && draft !== encode(linked.state)) localStorage.setItem(PREVIOUS, draft);
  } catch {}
  save(linked.state);
  return { state: linked.state, dropped: linked.dropped, unreadable: false };
}

/** Whether a draft a link replaced is kept. */
export const hasPrevious = (): boolean => kept(PREVIOUS) !== null;

/** Swaps the draft a link replaced back in, keeping the link's as the previous one. */
export function restorePrevious(): ComposeState | null {
  const previous = kept(PREVIOUS);
  const d = previous ? decode(previous) : null;
  if (!d?.read) return null;
  const draft = kept(DRAFT);
  try {
    if (draft) localStorage.setItem(PREVIOUS, draft);
    else localStorage.removeItem(PREVIOUS);
  } catch {}
  save(d.state);
  return d.state;
}
