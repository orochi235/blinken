import { decode, defaultState, encode } from './share.js';
import type { ComposeState } from './state.js';

/** The browser-storage key the current draft is kept under. */
export const DRAFT = 'bree-compose-draft';
/** Where the drafts links replaced are kept, newest first, so opening a link never loses one. */
export const PREVIOUS = 'bree-compose-draft-previous';
/** How many displaced drafts are kept. */
export const KEPT = 5;

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

/** The displaced drafts, newest first; a value from before the list was kept reads as one. */
const previous = (): string[] => {
  const raw = kept(PREVIOUS);
  if (raw === null) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (Array.isArray(list)) return list.filter((d): d is string => typeof d === 'string');
  } catch {}
  return [raw];
};

const keep = (list: string[]): void => {
  try {
    if (list.length) localStorage.setItem(PREVIOUS, JSON.stringify(list.slice(0, KEPT)));
    else localStorage.removeItem(PREVIOUS);
  } catch {}
};

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
  const link = encode(linked.state);
  if (draft && draft !== link)
    keep([draft, ...previous().filter((d) => d !== draft && d !== link)]);
  save(linked.state);
  return { state: linked.state, dropped: linked.dropped, unreadable: false };
}

/** Whether a draft a link replaced is kept. */
export const hasPrevious = (): boolean => previous().length > 0;

/**
 * Swaps the newest displaced draft back in and keeps the current one as the oldest, so restoring
 * again steps further back and, past the oldest, comes round to where it started.
 */
export function restorePrevious(): ComposeState | null {
  const list = previous();
  const at = list.findIndex((p) => decode(p).read);
  if (at < 0) return null;
  const newest = list[at] as string;
  const rest = list.slice(at + 1);
  const d = decode(newest);
  const draft = kept(DRAFT);
  keep(draft && draft !== newest ? [...rest.filter((p) => p !== draft), draft] : rest);
  save(d.state);
  return d.state;
}
