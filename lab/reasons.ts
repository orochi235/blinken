import { gpuOf } from '@msb235/blits/gpu';
import type { Marquee } from '@/index.js';

/**
 * Why each voice of `m`'s last frame stayed on the CPU, as blits gives it; null where the blits in
 * use has no `reasons()` or `m` draws without WebGPU.
 */
export function reasonsOf(m: Marquee): readonly unknown[] | null {
  if (m.backend !== 'webgpu') return null;
  const side = gpuOf(m.mix) as { reasons?: () => readonly unknown[] };
  return side.reasons?.() ?? null;
}
