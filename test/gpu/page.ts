// What the GPU tests build signs with: a canvas in its own box on the page, a device handle and a
// ticker stepped by hand.
import type { Gpu } from '@/render/gpu.js';
import type { Ticker } from '@/ticker.js';

/** A canvas inside a box of its own on the page. */
export function canvasIn(width: number, height: number): HTMLCanvasElement {
  const box = document.createElement('div');
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
  const canvas = document.createElement('canvas');
  box.append(canvas);
  document.body.append(box);
  return canvas;
}

/** `device` as the handle `gpu()` would give. */
export const handleOf = (device: GPUDevice): Gpu => ({
  device,
  format: navigator.gpu.getPreferredCanvasFormat(),
  lost: device.lost.then(() => {}),
});

/** A ticker the test steps by hand. */
export function manual(): Ticker & { step(now: number): void } {
  const fns = new Set<(now: number) => void>();
  return {
    add(fn) {
      fns.add(fn);
      return () => fns.delete(fn);
    },
    get size() {
      return fns.size;
    },
    step(now) {
      for (const fn of fns) fn(now);
    },
  };
}
