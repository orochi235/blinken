import type { Undoable } from './UndoBar.js';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const SKIPPED = new Set(['button', 'submit', 'reset', 'file']);

/**
 * Undo over the form controls inside `scope`: each committed change, a `change` event, is a step,
 * and stepping sets the controls back and fires `input` and `change` on each, so the page reacts as
 * it would to a person. A control inside `[data-no-undo]` is left out, for one that reloads the page.
 */
export function controlHistory(scope: HTMLElement, limit = 200): Undoable {
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const fn of listeners) fn();
  };
  const controls = () =>
    [...scope.querySelectorAll<Control>('input, select, textarea')].filter(
      (c) => !SKIPPED.has(c.type) && !c.closest('[data-no-undo]'),
    );
  const read = (c: Control) =>
    c instanceof HTMLInputElement && (c.type === 'checkbox' || c.type === 'radio')
      ? String(c.checked)
      : c.value;
  const write = (c: Control, v: string) => {
    if (c instanceof HTMLInputElement && (c.type === 'checkbox' || c.type === 'radio'))
      c.checked = v === 'true';
    else c.value = v;
  };
  /** Each control's value as of the last step, so a change knows what it changed from. */
  let known = new Map<Control, string>();
  const take = () => new Map(controls().map((c) => [c, read(c)]));
  const past: Map<Control, string>[] = [];
  const future: Map<Control, string>[] = [];
  let stepping = false;

  // The page sets controls itself too, after load and later, so what a change changed from is read
  // as a person reaches for a control: the focused one as it gains focus, before any typing into it.
  const settle = (e: Event) => {
    if (stepping) return;
    const now = take();
    const held = e.type === 'focusin' ? null : document.activeElement;
    for (const [c, v] of now) if (c !== held || !known.has(c)) known.set(c, v);
  };
  for (const type of ['pointerdown', 'focusin', 'keydown'])
    scope.addEventListener(type, settle, true);
  scope.addEventListener(
    'change',
    (e) => {
      if (stepping) return;
      const c = e.target as Control;
      if (!controls().includes(c)) return;
      const before = new Map(known);
      known = take();
      if (!before.has(c) || before.get(c) === known.get(c)) return;
      past.push(before);
      if (past.length > limit) past.shift();
      future.length = 0;
      notify();
    },
    true,
  );

  const go = (from: Map<Control, string>[], to: Map<Control, string>[]) => {
    const target = from.pop();
    if (!target) return;
    to.push(known);
    stepping = true;
    for (const [c, v] of target) {
      if (read(c) === v) continue;
      write(c, v);
      c.dispatchEvent(new Event('input', { bubbles: true }));
      c.dispatchEvent(new Event('change', { bubbles: true }));
    }
    stepping = false;
    known = take();
    notify();
  };

  return {
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    undo: () => go(past, future),
    redo: () => go(future, past),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
