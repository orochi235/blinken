import type { Marquee, Pass } from '@/index.js';

/** A sign the playback controls and the scrubber drive: compose's store, or the effects page's preview. */
export interface Player {
  /** Where the sign's pass stands, or null with no sign or nothing playing. */
  pass(): Pass | null;
  /** Moves the pass to `ms`, held there with `hold`. */
  seek(ms: number, hold?: boolean): void;
  /** Plays again from the start of whatever the sign is looping. */
  restart(): void;
  rate(): number;
  setRate(rate: number): void;
}

/** A player's sign and what carries over to the sign built to replace it. */
export interface Carried {
  sign: Marquee | null;
  /** The rate the sign plays at. */
  rate: number;
  /** Whether the scrubber holds the sign still. */
  held: boolean;
  /** Where the last sign's pass stood when it was taken down, for the next one to play on from. */
  resume: number | undefined;
}

export const carried = (): Carried => ({ sign: null, rate: 1, held: false, resume: undefined });

/**
 * A player over `c`, which may live where a hot reload keeps it. `attach` takes the sign the page
 * drew, or null as it goes; a new one plays on from where the last stood, at its rate, still held if
 * it was.
 */
export function carrier(c: Carried): Omit<Player, 'restart'> & {
  attach(next: Marquee | null): void;
} {
  return {
    pass: () => c.sign?.pass() ?? null,
    seek(ms, hold = false) {
      if (!c.sign) return;
      c.held = hold;
      c.sign.seek(ms, { hold });
    },
    rate: () => c.rate ?? 1,
    setRate(rate) {
      c.rate = rate;
      c.sign?.ramp(rate, 150);
    },
    attach(next) {
      if (!next) c.resume = c.sign?.pass()?.at;
      c.sign = next;
      if (next && c.rate !== 1) next.ramp(c.rate, 0);
      if (next && c.resume !== undefined) next.seek(c.resume, { hold: c.held });
    },
  };
}
