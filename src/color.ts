import { oklab, toHex } from '@msb235/blits';

const pose = [0, 0, 0, 0];
let plainHex = Number.NaN;
let plain = [0, 0, 0, 0];

/**
 * The hex a dot shows: its tint, the four values from `at` in `tint`, or `fallback` when nothing
 * tinted it, with OKLab `a` and `b` turned by `hue` degrees and scaled by `chroma`.
 */
export function dotColor(
  tint: ArrayLike<number>,
  at: number,
  hue: number,
  chroma: number,
  fallback: number,
): number {
  let src: ArrayLike<number> = tint;
  if (!((tint[at + 3] ?? 0) > 0)) {
    if (hue === 0 && chroma === 1) return fallback;
    if (fallback !== plainHex) {
      plainHex = fallback;
      plain = oklab(fallback);
    }
    src = plain;
    at = 0;
  }
  const turn = (hue * Math.PI) / 180;
  const cos = Math.cos(turn) * chroma;
  const sin = Math.sin(turn) * chroma;
  const a = src[at + 1] ?? 0;
  const b = src[at + 2] ?? 0;
  pose[0] = src[at] ?? 0;
  pose[1] = a * cos - b * sin;
  pose[2] = a * sin + b * cos;
  pose[3] = src[at + 3] ?? 0;
  return toHex(pose);
}
