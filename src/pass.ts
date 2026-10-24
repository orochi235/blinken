import type { Stretch } from './effects.js';
import type { Slot } from './moves/index.js';
import type { StagedScene } from './program.js';

/** One scene of a pass: which scene of the program it is, and where it and its parts play, ms. */
export interface PassScene {
  readonly scene: number;
  readonly start: number;
  readonly ms: number;
  readonly parts: Readonly<Record<Slot, Stretch>>;
}

/** Where the pass playing now stands: ms into it, how long it is, and its scenes end to end. */
export interface Pass {
  readonly at: number;
  readonly length: number;
  readonly scenes: readonly PassScene[];
}

/** Staged scenes laid end to end, numbered by their place in the program, `offset` scenes in. */
export function layOut(
  staged: readonly StagedScene[],
  offset: number,
): { scenes: PassScene[]; length: number } {
  let start = 0;
  const scenes = staged.map((s) => {
    const at = start;
    const parts = Object.fromEntries(
      Object.entries(s.staged.parts).map(([slot, p]) => [slot, { start: at + p.start, ms: p.ms }]),
    ) as Record<Slot, Stretch>;
    const out = { scene: s.scene + offset, start, ms: s.staged.ms, parts };
    start += s.staged.ms;
    return out;
  });
  return { scenes, length: start };
}

/**
 * A pass's own clock, read off the mix clock: where the pass stood at mix time `mix`, and how fast
 * it moves from there. Before the mix's first sync `mix` is NaN, and `settle` fixes it at that sync.
 */
export class PassClock {
  private mix = Number.NaN;
  private at = 0;
  private rate = 1;

  /** The pass is at `at` at mix time `now`, moving at `rate` from there. */
  set(now: number, at = 0, rate = 1): void {
    this.mix = now;
    this.at = at;
    this.rate = rate;
  }

  /** A pass set before the mix's first sync starts at it. */
  settle(now: number): void {
    if (Number.isNaN(this.mix)) this.mix = now;
  }

  read(now: number): number {
    return Number.isNaN(this.mix) ? this.at : this.at + (now - this.mix) * this.rate;
  }
}
