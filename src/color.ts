import { toHex } from '@msb235/blits';

const pose = [0, 0, 0, 0];

/**
 * The hex a dot shows: its tint, the four values from `at` in `tint`, with OKLab `a` and `b` turned
 * by `hue` degrees and scaled by `chroma`. `fallback` when nothing tinted it.
 */
export function dotColor(
  tint: ArrayLike<number>,
  at: number,
  hue: number,
  chroma: number,
  fallback: number,
): number {
  const w = tint[at + 3] ?? 0;
  if (!(w > 0)) return fallback;
  const turn = (hue * Math.PI) / 180;
  const cos = Math.cos(turn) * chroma;
  const sin = Math.sin(turn) * chroma;
  const a = tint[at + 1] ?? 0;
  const b = tint[at + 2] ?? 0;
  pose[0] = tint[at] ?? 0;
  pose[1] = a * cos - b * sin;
  pose[2] = a * sin + b * cos;
  pose[3] = w;
  return toHex(pose);
}
