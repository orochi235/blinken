import type { StagedStep } from './program.js';

/** One step of a pass: which step of the program it is, and where it plays in the pass, ms. */
export interface PassStep {
  readonly step: number;
  readonly start: number;
  readonly ms: number;
}

/** Where the pass playing now stands: ms into it, how long it is, and its steps end to end. */
export interface Pass {
  readonly at: number;
  readonly length: number;
  readonly steps: readonly PassStep[];
}

/** Staged steps laid end to end, numbered by their place in the program, `offset` steps in. */
export function layOut(
  staged: readonly StagedStep[],
  offset: number,
): { steps: PassStep[]; length: number } {
  let start = 0;
  const steps = staged.map((s) => {
    const out = { step: s.step + offset, start, ms: s.staged.ms };
    start += s.staged.ms;
    return out;
  });
  return { steps, length: start };
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
