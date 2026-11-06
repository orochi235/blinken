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
 * Pauses `sign` while the page's Pause button holds `root` or the window is out of focus, and
 * returns what stops it: `sign.destroy()`, after `also`.
 */
export function held(root: HTMLElement, sign: Marquee, also?: () => void): () => void {
  let paused = false;
  let away = !document.hasFocus();
  const apply = () => sign.ramp(paused || away ? 0 : 1, 0);
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
    also?.();
    sign.destroy();
  };
}
