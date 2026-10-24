import type { Pass } from '@/index.js';
import { compose } from './store.js';

const watchers = new Set<(pass: Pass | null) => void>();
let raf = 0;

const tick = () => {
  raf = requestAnimationFrame(tick);
  const pass = compose.pass();
  for (const w of watchers) w(pass);
};

/** Calls `fn` every animation frame with where the sign's pass stands, until the returned stop. */
export function watchPass(fn: (pass: Pass | null) => void): () => void {
  watchers.add(fn);
  if (watchers.size === 1) raf = requestAnimationFrame(tick);
  return () => {
    watchers.delete(fn);
    if (watchers.size === 0) cancelAnimationFrame(raf);
  };
}

/** The scene of `pass` playing at its `at`: the last one past its end, undefined with none. */
export const sceneAt = (pass: Pass) =>
  pass.scenes.find((s) => pass.at >= s.start && pass.at < s.start + s.ms) ?? pass.scenes.at(-1);
