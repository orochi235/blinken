/** Inputs whose edits arrive as a run of small changes while focus stays in them. */
const RUNS = new Set(['text', 'search', 'number', 'range']);

let press = 0;
let down = false;
let focus = 0;

// A control may commit its last value on the same pointerup, so the press ends a turn later.
const lift = () => setTimeout(() => (down = false));
if (typeof window !== 'undefined') {
  addEventListener('pointerdown', () => {
    press += 1;
    down = true;
  });
  addEventListener('pointerup', lift);
  addEventListener('pointercancel', lift);
  addEventListener('focusin', () => (focus += 1));
}

/**
 * The gesture an edit belongs to, so undo takes a gesture's edits as one step: everything one
 * pointer press changes, or what is typed or nudged into one field while it keeps focus.
 * Undefined for an edit standing alone, such as a button's.
 */
export function gestureKey(): string | undefined {
  if (down) return `press:${press}`;
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && RUNS.has(el.type)))
    return `focus:${focus}`;
  return undefined;
}
