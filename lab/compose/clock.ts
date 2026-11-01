import { createTicker, type Pass } from '@/index.js';
import type { Player } from './player.js';

/** One frame loop for every readout that follows a pass, shared rather than one each. */
const ticker = createTicker();

/** Calls `fn` every animation frame with where `player`'s pass stands, until the returned stop. */
export const watchPass = (player: Player, fn: (pass: Pass | null) => void): (() => void) =>
  ticker.add(() => fn(player.pass()));

/** The scene of `pass` playing at its `at`: the last one past its end, undefined with none. */
export const sceneAt = (pass: Pass) =>
  pass.scenes.find((s) => pass.at >= s.start && pass.at < s.start + s.ms) ?? pass.scenes.at(-1);
