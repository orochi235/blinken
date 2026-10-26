import { useSyncExternalStore } from 'react';
import { gestureKey } from '../gesture.js';
import { type Library, library } from '../library.js';

/** What the effects page has open and plays it on, and the library's undo history. */
interface Desk {
  open: string | undefined;
  text: string;
  /** The diagram node, and so the card, picked: a graph id. */
  picked: string | undefined;
  past: { library: Library; open: string | undefined; gesture?: string }[];
  future: { library: Library; open: string | undefined }[];
}

const LIMIT = 200;
const desk: Desk = { open: undefined, text: 'HELLO', picked: undefined, past: [], future: [] };
const listeners = new Set<() => void>();
let version = 0;
const notify = () => {
  version += 1;
  for (const l of listeners) l();
};
library.subscribe(notify);

/**
 * The effects page's own state: the effect it has open, the text it previews on, and undo over the
 * library. A gesture's edits undo as one step, as compose's do.
 */
export const designer = {
  open: () => desk.open,
  text: () => desk.text,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setOpen(name: string | undefined) {
    desk.open = name;
    desk.picked = undefined;
    notify();
  },
  picked: () => desk.picked,
  setPicked(id: string | undefined) {
    if (desk.picked === id) return;
    desk.picked = id;
    notify();
  },
  setText(text: string) {
    desk.text = text;
    notify();
  },
  /** Changes the library through `fn`, as one undo step with the edits of the same gesture. */
  change(fn: () => void) {
    const before = { library: library.get(), open: desk.open };
    const gesture = gestureKey();
    fn();
    if (library.get() === before.library && desk.open === before.open) return;
    const last = desk.past.at(-1);
    if (!(gesture !== undefined && last?.gesture === gesture))
      desk.past = [...desk.past.slice(-(LIMIT - 1)), { ...before, gesture }];
    desk.future = [];
    notify();
  },
  canUndo: () => desk.past.length > 0,
  canRedo: () => desk.future.length > 0,
  undo() {
    const step = desk.past.pop();
    if (!step) return;
    desk.future.push({ library: library.get(), open: desk.open });
    desk.open = step.open;
    // An undone edit can take the picked piece with it.
    desk.picked = undefined;
    library.replace(step.library);
  },
  redo() {
    const step = desk.future.pop();
    if (!step) return;
    desk.past.push({ library: library.get(), open: desk.open });
    desk.open = step.open;
    desk.picked = undefined;
    library.replace(step.library);
  },
};

/** Re-renders on anything the effects page's state or the library does. */
export const useDesk = (): number =>
  useSyncExternalStore(
    designer.subscribe,
    () => version,
    () => version,
  );
