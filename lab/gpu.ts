import { useSyncExternalStore } from 'react';
import { type Gpu, gpu } from '@/index.js';

/** The page's one WebGPU device request, shared by every sign it makes; kept across a hot reload. */
export const labGpu: Promise<Gpu | null> = import.meta.hot?.data.gpu ?? gpu();
if (import.meta.hot) import.meta.hot.data.gpu = labGpu;

/** The handle once the request settles: null without WebGPU, undefined until then. */
let settled: Gpu | null | undefined;
const waiting = new Set<() => void>();
labGpu.then((g) => {
  settled = g;
  for (const fn of waiting) fn();
});

/** The page's WebGPU handle, undefined while it is still being asked for. */
export const useGpu = (): Gpu | null | undefined =>
  useSyncExternalStore(
    (fn) => {
      waiting.add(fn);
      return () => waiting.delete(fn);
    },
    () => settled,
  );
