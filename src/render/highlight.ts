import type { SignColumns } from '../draw.js';

/** Swaps the `invert` of each dot `mask` marks, clamped to 0..1 first, as the WebGPU gather does. */
export function swapMarked(cols: SignColumns, mask: Uint8Array): void {
  for (let i = 0; i < mask.length; i++)
    if (mask[i]) cols.invert[i] = 1 - Math.min(1, Math.max(0, cols.invert[i] ?? 0));
}
