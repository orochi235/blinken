import { board, frameOf, type GridName, gridOf, type Marquee } from '@msb235/blinken';

/** Sent to a live demo's root to pause it (`detail: true`) or resume it (`detail: false`). */
export const HOLD = 'blinken:hold';

export interface StageSize {
  cols: number;
  rows: number;
  /** False for a sign made with `border: false`. Default true. */
  border?: boolean;
  grid?: GridName;
}

/** A canvas in `root`, in a box shaped like the sign it will hold, so the sign fills it. */
export function stage(root: HTMLElement, { cols, rows, border = true, grid }: StageSize) {
  const { across, down } = frameOf(board(cols, rows, border, grid), gridOf(grid));
  const box = document.createElement('div');
  box.className = 'sign-box';
  box.style.setProperty('--aspect', `${across} / ${down}`);
  const canvas = document.createElement('canvas');
  box.append(canvas);
  root.append(box);
  return canvas;
}

/**
 * Calls `pause(true)` while the page's Pause button holds `root` or the window is out of focus,
 * and `pause(false)` when neither does; returns what stops listening.
 */
export function onHold(root: HTMLElement, pause: (paused: boolean) => void): () => void {
  let paused = false;
  let away = !document.hasFocus();
  const apply = () => pause(paused || away);
  const hold = (e: Event) => {
    paused = (e as CustomEvent<boolean>).detail;
    apply();
  };
  const blur = () => {
    away = true;
    apply();
  };
  const focus = () => {
    away = false;
    apply();
  };
  root.addEventListener(HOLD, hold);
  window.addEventListener('blur', blur);
  window.addEventListener('focus', focus);
  apply();
  return () => {
    root.removeEventListener(HOLD, hold);
    window.removeEventListener('blur', blur);
    window.removeEventListener('focus', focus);
  };
}

/** A row of controls under the demo's signs. */
export function controls(root: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'live-controls';
  root.append(row);
  return row;
}

/** A labeled control in `row`. */
export function field<T extends HTMLElement>(row: HTMLElement, label: string, input: T): T {
  const wrap = document.createElement('label');
  wrap.append(label, input);
  row.append(wrap);
  return input;
}

/** A checkbox, checked or not. */
export function checkbox(on = false): HTMLInputElement {
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = on;
  return box;
}

/** A range input over `min`..`max`. */
export function slider(min: number, max: number, step: number, value: number): HTMLInputElement {
  const range = document.createElement('input');
  range.type = 'range';
  Object.assign(range, {
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
  });
  return range;
}

/**
 * Pauses `sign` while the page's Pause button holds `root` or the window is out of focus, and
 * returns what stops it: `sign.destroy()`, after `also`.
 */
export function held(root: HTMLElement, sign: Marquee, also?: () => void): () => void {
  const stop = onHold(root, (paused) => sign.ramp(paused ? 0 : 1, 0));
  return () => {
    stop();
    also?.();
    sign.destroy();
  };
}
