import type { Backend, Gpu } from '@/index.js';

/** The backend a sign is asked for: one by name, or `auto` for the best this page can do. */
export type Choice = 'auto' | Backend;
export const CHOICES: readonly Choice[] = ['auto', 'webgpu', 'webgl', '2d'];

/** What `choice` comes to once the page's WebGPU request has settled: WebGPU without a handle is auto. */
export const choiceOn = (choice: Choice, handle: Gpu | null | undefined): Choice =>
  choice === 'webgpu' && handle === null ? 'auto' : choice;

/** Whether a sign for `choice` uses the page's WebGPU handle, so must wait for its request. */
export const usesGpu = (choice: Choice): boolean => choice === 'auto' || choice === 'webgpu';

/** What a sign is given for `choice`. */
export function drawWith(choice: Choice, handle: Gpu | null): { gpu?: Gpu; backend?: Backend } {
  const on = choiceOn(choice, handle);
  if (on === 'webgpu') return { gpu: handle as Gpu, backend: 'webgpu' };
  if (on === 'auto') return handle ? { gpu: handle } : {};
  return { backend: on };
}

/**
 * What thumbnails and readouts draw with. A page holds only 12 WebGL contexts and the composer
 * shows dozens of these, which would leave the main sign none to switch to.
 */
export const SMALL_SIGNS: Backend = '2d';
