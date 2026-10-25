import type { Pass } from '@/index.js';
import type { Player } from './player.js';

const watchers = new Map<(pass: Pass | null) => void, Player>();
let raf = 0;

const tick = () => {
  raf = requestAnimationFrame(tick);
  for (const [w, player] of watchers) w(player.pass());
};

/** Calls `fn` every animation frame with where `player`'s pass stands, until the returned stop. */
export function watchPass(player: Player, fn: (pass: Pass | null) => void): () => void {
  watchers.set(fn, player);
  if (watchers.size === 1) raf = requestAnimationFrame(tick);
  return () => {
    watchers.delete(fn);
    if (watchers.size === 0) cancelAnimationFrame(raf);
  };
}

/** The scene of `pass` playing at its `at`: the last one past its end, undefined with none. */
export const sceneAt = (pass: Pass) =>
  pass.scenes.find((s) => pass.at >= s.start && pass.at < s.start + s.ms) ?? pass.scenes.at(-1);
