import type { Backend, Gpu } from '@/index.js';

/** The backend a sign is asked for: one by name, or `auto` for the best this page can do. */
export type Choice = 'auto' | Backend;
export const CHOICES: readonly Choice[] = ['auto', 'webgpu', 'webgl', '2d'];

/** What a sign is given for `choice`. WebGPU without a handle reads as auto. */
export function drawWith(choice: Choice, handle: Gpu | null): { gpu?: Gpu; backend?: Backend } {
  if (choice === 'auto' || choice === 'webgpu') {
    if (!handle) return {};
    return choice === 'auto' ? { gpu: handle } : { gpu: handle, backend: 'webgpu' };
  }
  return { backend: choice };
}

/**
 * What thumbnails and readouts draw with. A page holds only 12 WebGL contexts and the composer
 * shows dozens of these, which would leave the main sign none to switch to.
 */
export const SMALL_SIGNS: Backend = '2d';
